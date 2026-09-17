<?php

namespace App\Tests\Controller\Api;

use App\Entity\Badge;
use App\Entity\Level;
use App\Entity\User;
use App\Entity\UserBadge;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class MeStatsControllerTest extends ApiTestCase
{
    public function testStatsReflectRealActivityAndIsolatePerUser(): void
    {
        $client = static::createClient();
        // A0 first (default registration level) - the quiz is A0-only (see
        // QuizController::modules()), so it must be completed before the
        // level bump below, exactly like a real learner would: pass the
        // quiz while still A0, then move on to scenario sessions once past it.
        $token = $this->registerAndGetToken($client, 'stats-user-a@linguabot.fr');

        $moduleId = $this->findQuizModuleId($client, $token, 'M0-1');
        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);
        $answers = [];
        foreach ($questions as $index => $question) {
            $answers[(string) $question['id']] = self::M0_1_ANSWERS[$index];
        }
        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, ['moduleId' => $moduleId, 'answers' => $answers]);
        $quizXp = $this->decodeResponse($client)['xpEarned'];
        self::assertGreaterThan(0, $quizXp);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'stats-user-a@linguabot.fr']);
        $levelA1 = $em->getRepository(Level::class)->findOneBy(['code' => 'A1']);
        $user->setLevel($levelA1);
        $em->flush();

        $missionId = $this->findAnyA1MissionId($client, $token);
        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$sessionId}/message", $token, ['message' => 'Hello!']);
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$sessionId}/finish", $token);
        $sessionXp = $this->decodeResponse($client)['xpEarned'];
        self::assertGreaterThan(0, $sessionXp);

        // A badge earned directly (not through the 5-session trigger) so the
        // SQL join against user_badges/badges.xp_bonus can be verified
        // without orchestrating the full real trigger condition. Re-fetched
        // fresh here (not reusing $user/$em from above) - the several
        // jsonRequest() calls since then each go through a fresh kernel
        // sub-request, which leaves the earlier entity manager reference
        // stale/detached (confirmed by reproducing "a new entity was found
        // through the relationship" otherwise).
        $em2 = self::getContainer()->get(EntityManagerInterface::class);
        $freshUser = $em2->getRepository(User::class)->findOneBy(['email' => 'stats-user-a@linguabot.fr']);
        $badge = $em2->getRepository(Badge::class)->findOneBy(['code' => 'BADGE_SPEAKER']);
        self::assertNotNull($badge, 'BADGE_SPEAKER fixture not found - are GamificationFixtures loaded?');
        $em2->persist((new UserBadge())->setUser($freshUser)->setBadge($badge));
        $em2->flush();

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=30', $token);
        self::assertResponseIsSuccessful();
        $stats = $this->decodeResponse($client);

        self::assertSame(30, $stats['days']);
        self::assertSame(1, $stats['sessionsCount']);
        self::assertSame(1, $stats['quizzesCompleted']);
        self::assertSame(0, $stats['challengesCompleted']);
        self::assertGreaterThanOrEqual(0, $stats['practiceSeconds']);
        self::assertNotEmpty($stats['worldBreakdown']);
        // Audit P1-09: one point per calendar day in the window, zero-filled,
        // not just the (2, here) days that actually had activity - otherwise
        // a chart connecting them draws a straight line across the gap.
        self::assertCount(30, $stats['history']);
        self::assertSame(
            (new \DateTimeImmutable())->format('Y-m-d'),
            $stats['history'][\count($stats['history']) - 1]['day'],
            'The window must end on today, zero-filled through it.',
        );

        // Audit P1-11 reconciliation check: events/tables are the source of
        // truth, User::totalXp is a read-cache of their sum, and the two
        // must never drift apart. Everything this user has ever earned
        // happened seconds ago, well inside the 30-day window - the period
        // sum (5 source tables, including badges/trophies) must fully
        // reconcile with lifetime User::totalXp - except for the +50 badge
        // granted directly above (bypassing
        // GamificationService, which is the only thing that ever
        // increments User::totalXp), so that +50 is added back by hand
        // here. Everything else (session + quiz + whatever gamification
        // auto-triggered along the way, e.g. a level-up badge) is real,
        // not hand-predicted.
        $this->jsonRequest($client, 'GET', '/api/me', $token);
        $me = $this->decodeResponse($client);
        self::assertGreaterThanOrEqual($sessionXp + $quizXp, $me['totalXp']);
        self::assertSame($me['totalXp'] + 50, $stats['xpEarned']);

        // A second, unrelated user with their own session must never leak
        // into the first user's stats.
        $tokenB = $this->registerAndGetTokenAtLevel($client, 'A1', 'stats-user-b@linguabot.fr');
        $missionIdB = $this->findAnyA1MissionId($client, $tokenB);
        $this->jsonRequest($client, 'POST', "/api/missions/{$missionIdB}/sessions", $tokenB);
        $sessionIdB = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$sessionIdB}/finish", $tokenB);

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=30', $tokenB);
        $statsB = $this->decodeResponse($client);
        self::assertSame(1, $statsB['sessionsCount']);
        self::assertSame(0, $statsB['quizzesCompleted']);
    }

    public function testExcludesActivityOutsideTheSelectedPeriod(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1', 'stats-period@linguabot.fr');
        $missionId = $this->findAnyA1MissionId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$sessionId}/finish", $token);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $twentyDaysAgo = (new \DateTimeImmutable())->modify('-20 days')->format('Y-m-d H:i:s');
        $em->getConnection()->executeStatement(
            'UPDATE mission_sessions SET started_at = :d WHERE id = :id',
            ['d' => $twentyDaysAgo, 'id' => $sessionId],
        );

        // Only the session's own date is backdated - any gamification XP
        // that auto-triggered when it was finished (e.g. a level-up badge)
        // keeps its own real earned_at "now", so it deliberately stays
        // in-window here. That's a separate, correctly-dated source, not a
        // leak of the session itself - this test only asserts on
        // sessionsCount, which the backdate directly controls.
        $this->jsonRequest($client, 'GET', '/api/me/stats?days=7', $token);
        $stats7 = $this->decodeResponse($client);
        self::assertSame(0, $stats7['sessionsCount']);
        // Audit P1-09: zero-filled for every one of the 7 days, not just
        // days with activity (there are none, backdated out of window).
        self::assertCount(7, $stats7['history']);

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=30', $token);
        $stats30 = $this->decodeResponse($client);
        self::assertSame(1, $stats30['sessionsCount']);
        self::assertCount(30, $stats30['history']);
    }

    public function testSevenDayWindowIsInclusiveOfExactlySevenCalendarDaysNotEight(): void
    {
        // Audit P1-10: "days=7" must mean [today-6, today] (7 dates), not
        // [today-7, today] (8 dates) - a session dated exactly 6 days ago is
        // in-window, one dated exactly 7 days ago is not.
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1', 'stats-boundary@linguabot.fr');
        $missionId = $this->findAnyA1MissionId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $insideSessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$insideSessionId}/finish", $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $outsideSessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$outsideSessionId}/finish", $token);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $sixDaysAgo = (new \DateTimeImmutable())->modify('-6 days')->format('Y-m-d H:i:s');
        $sevenDaysAgo = (new \DateTimeImmutable())->modify('-7 days')->format('Y-m-d H:i:s');
        $em->getConnection()->executeStatement(
            'UPDATE mission_sessions SET started_at = :d WHERE id = :id',
            ['d' => $sixDaysAgo, 'id' => $insideSessionId],
        );
        $em->getConnection()->executeStatement(
            'UPDATE mission_sessions SET started_at = :d WHERE id = :id',
            ['d' => $sevenDaysAgo, 'id' => $outsideSessionId],
        );

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=7', $token);
        $stats = $this->decodeResponse($client);

        self::assertSame(1, $stats['sessionsCount'], 'Only the session from exactly 6 days ago should be in-window.');
    }

    private const M0_1_ANSWERS = [
        'hello', 'goodbye', 'thank you', 'please', 'good night',
        'how are you', 'nice to meet you', 'see you soon', 'excuse me', 'good evening',
    ];

    private function findAnyA1MissionId(mixed $client, string $token): int
    {
        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $missions = $this->decodeResponse($client)['rooms'][0]['situations'][0]['missions'];

        foreach ($missions as $mission) {
            if ('A1' === $mission['level']) {
                return $mission['id'];
            }
        }

        self::fail('No A1 mission found in the pilot world fixtures.');
    }

    private function findQuizModuleId(mixed $client, string $token, string $code): int
    {
        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        foreach ($this->decodeResponse($client)['modules'] as $module) {
            if ($module['code'] === $code) {
                return $module['id'];
            }
        }

        self::fail("Quiz module {$code} not found - are fixtures loaded in the test database?");
    }
}
