<?php

namespace App\Tests\Controller\Api;

use App\Entity\Badge;
use App\Entity\User;
use App\Entity\UserBadge;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class MeStatsControllerTest extends ApiTestCase
{
    public function testStatsReflectRealActivityAndIsolatePerUser(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1', 'stats-user-a@linguabot.fr');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, ['message' => 'Hello!']);
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        $sessionXp = $this->decodeResponse($client)['xpEarned'];
        self::assertGreaterThan(0, $sessionXp);

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

        // A badge earned directly (not through the 5-session trigger) so the
        // SQL join against user_badges/badges.xp_bonus can be verified
        // without orchestrating the full real trigger condition.
        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'stats-user-a@linguabot.fr']);
        $badge = $em->getRepository(Badge::class)->findOneBy(['code' => 'BADGE_SPEAKER']);
        self::assertNotNull($badge, 'BADGE_SPEAKER fixture not found - are GamificationFixtures loaded?');
        $em->persist((new UserBadge())->setUser($user)->setBadge($badge));
        $em->flush();

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=30', $token);
        self::assertResponseIsSuccessful();
        $stats = $this->decodeResponse($client);

        self::assertSame(30, $stats['days']);
        self::assertSame(1, $stats['sessionsCount']);
        self::assertSame(1, $stats['quizzesCompleted']);
        self::assertSame(0, $stats['challengesCompleted']);
        self::assertGreaterThanOrEqual(0, $stats['practiceSeconds']);
        self::assertNotEmpty($stats['categoryBreakdown']);
        self::assertNotEmpty($stats['history']);

        // Everything this user has ever earned happened seconds ago, well
        // inside the 30-day window - the period sum (5 source tables,
        // including badges/trophies) must fully reconcile with lifetime
        // User::totalXp, exactly the reconciliation the design relies on -
        // except for the +50 badge granted directly above (bypassing
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
        $scenarioIdB = $this->findAnyScenarioId($client, $tokenB);
        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioIdB}/sessions", $tokenB);
        $sessionIdB = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionIdB}/finish", $tokenB);

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=30', $tokenB);
        $statsB = $this->decodeResponse($client);
        self::assertSame(1, $statsB['sessionsCount']);
        self::assertSame(0, $statsB['quizzesCompleted']);
    }

    public function testExcludesActivityOutsideTheSelectedPeriod(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1', 'stats-period@linguabot.fr');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $twentyDaysAgo = (new \DateTimeImmutable())->modify('-20 days')->format('Y-m-d H:i:s');
        $em->getConnection()->executeStatement(
            'UPDATE sessions SET started_at = :d WHERE id = :id',
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

        $this->jsonRequest($client, 'GET', '/api/me/stats?days=30', $token);
        $stats30 = $this->decodeResponse($client);
        self::assertSame(1, $stats30['sessionsCount']);
    }

    private const M0_1_ANSWERS = [
        'hello', 'goodbye', 'thank you', 'please', 'good night',
        'how are you', 'nice to meet you', 'see you soon', 'excuse me', 'good evening',
    ];

    private function findAnyScenarioId(mixed $client, string $token): int
    {
        $this->jsonRequest($client, 'GET', '/api/scenarios', $token);
        $scenarios = $this->decodeResponse($client);
        foreach ($scenarios as $scenario) {
            if (!$scenario['locked']) {
                return $scenario['id'];
            }
        }

        self::fail('No unlocked scenario found - are fixtures loaded in the test database?');
    }

    private function findQuizModuleId(mixed $client, string $token, string $code): int
    {
        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        foreach ($this->decodeResponse($client) as $module) {
            if ($module['code'] === $code) {
                return $module['id'];
            }
        }

        self::fail("Quiz module {$code} not found - are fixtures loaded in the test database?");
    }
}
