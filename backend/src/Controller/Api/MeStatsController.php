<?php

namespace App\Controller\Api;

use App\Entity\User;
use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * V1.1 LOT 4: per-learner statistics, filtered to the authenticated user
 * only. Same rationale/style as Admin\AdminStatsController - hand-written
 * SQL via Connection for the cross-table/date-grouped aggregates, not
 * DQL/QueryBuilder.
 */
final class MeStatsController
{
    private const ALLOWED_DAYS = [7, 30, 365];

    #[Route('/api/me/stats', name: 'api_me_stats', methods: ['GET'])]
    public function __invoke(Request $request, #[CurrentUser] User $user, Connection $connection): JsonResponse
    {
        $days = (int) $request->query->get('days', 30);
        if (!\in_array($days, self::ALLOWED_DAYS, true)) {
            $days = 30;
        }
        $userId = $user->getId();
        // Audit P1-10: "days=7" must cover exactly 7 calendar dates
        // including today, i.e. [today-6, today] - `-{$days} days` (no -1)
        // combined with the inclusive `>= :from` below used to include an
        // 8th date (today-7), same off-by-one for 30/365.
        $from = (new \DateTimeImmutable())->modify(\sprintf('-%d days', $days - 1))->format('Y-m-d');

        $sessionsCount = (int) $connection->fetchOne(
            "SELECT COUNT(*) FROM mission_sessions WHERE user_id = :userId AND status = 'completed' AND started_at >= :from",
            ['userId' => $userId, 'from' => $from],
        );

        // mission_sessions has no duration_seconds column (unlike the
        // retired Session, whose value was optional/rarely populated
        // anyway) - derived directly from started_at/ended_at instead.
        $practiceSeconds = (int) $connection->fetchOne(
            <<<'SQL'
                SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))), 0) FROM mission_sessions
                WHERE user_id = :userId AND status = 'completed' AND started_at >= :from
                SQL,
            ['userId' => $userId, 'from' => $from],
        );

        // Distinct modules passed, not every attempt - same semantics as
        // QuizAttemptRepository::countDistinctPassedModules(), just period-scoped.
        $quizzesCompleted = (int) $connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(DISTINCT module_id) FROM quiz_attempts
                WHERE user_id = :userId AND passed = true AND attempted_at >= :from
                SQL,
            ['userId' => $userId, 'from' => $from],
        );

        $challengesCompleted = (int) $connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(*) FROM challenge_sessions cs
                INNER JOIN daily_challenges dc ON dc.id = cs.challenge_id
                WHERE cs.user_id = :userId AND cs.completed_at IS NOT NULL AND dc.challenge_date >= :from
                SQL,
            ['userId' => $userId, 'from' => $from],
        );

        // "categoryBreakdown" (quotidien/thematique) had no Mission
        // equivalent once Scenario was retired - the closest analogous
        // dimension in the V2 Adventure hierarchy is the World a mission
        // belongs to, so the breakdown is now by World title.
        $worldBreakdown = $connection->fetchAllAssociative(
            <<<'SQL'
                SELECT w.title AS world, COUNT(*) AS session_count
                FROM mission_sessions ms
                INNER JOIN missions mi ON mi.id = ms.mission_id
                INNER JOIN situations si ON si.id = mi.situation_id
                INNER JOIN rooms r ON r.id = si.room_id
                INNER JOIN worlds w ON w.id = r.world_id
                WHERE ms.user_id = :userId AND ms.status = 'completed' AND ms.started_at >= :from
                GROUP BY w.title
                SQL,
            ['userId' => $userId, 'from' => $from],
        );

        // Every source of XP that carries its own date, combined by day so
        // the top-line total and the daily history stay consistent with
        // each other - badges/trophies included, unlike a naive read of
        // just sessions/quiz_attempts/challenge_sessions, so this
        // reconciles fully with the learner's lifetime User::totalXp.
        //
        // Audit P1-09: LEFT JOINed against a generate_series of every
        // calendar day in the window (not just days with an event) so a
        // learner active on day 1 and day 30 gets 30 history points, not 2 -
        // a chart connecting the two real points would otherwise draw a
        // straight line across 28 days of invisible zero activity.
        $history = $connection->fetchAllAssociative(
            <<<'SQL'
                SELECT
                    gs.day::date::text AS day,
                    COALESCE(SUM(combined.session_count), 0) AS session_count,
                    COALESCE(SUM(combined.xp), 0) AS xp
                FROM generate_series(:from::date, CURRENT_DATE, '1 day') AS gs(day)
                LEFT JOIN (
                    SELECT DATE(started_at) AS day, COUNT(*) AS session_count, COALESCE(SUM(xp_earned), 0) AS xp
                    FROM mission_sessions
                    WHERE user_id = :userId AND status = 'completed' AND started_at >= :from
                    GROUP BY DATE(started_at)

                    UNION ALL

                    SELECT DATE(attempted_at) AS day, 0, COALESCE(SUM(xp_earned), 0)
                    FROM quiz_attempts
                    WHERE user_id = :userId AND attempted_at >= :from
                    GROUP BY DATE(attempted_at)

                    UNION ALL

                    SELECT dc.challenge_date AS day, 0, COALESCE(SUM(cs.xp_earned), 0)
                    FROM challenge_sessions cs
                    INNER JOIN daily_challenges dc ON dc.id = cs.challenge_id
                    WHERE cs.user_id = :userId AND cs.completed_at IS NOT NULL AND dc.challenge_date >= :from
                    GROUP BY dc.challenge_date

                    UNION ALL

                    SELECT DATE(ub.earned_at) AS day, 0, COALESCE(SUM(b.xp_bonus), 0)
                    FROM user_badges ub
                    INNER JOIN badges b ON b.id = ub.badge_id
                    WHERE ub.user_id = :userId AND ub.earned_at >= :from
                    GROUP BY DATE(ub.earned_at)

                    UNION ALL

                    SELECT DATE(ut.earned_at) AS day, 0, COALESCE(SUM(t.xp_reward), 0)
                    FROM user_trophies ut
                    INNER JOIN trophies t ON t.id = ut.trophy_id
                    WHERE ut.user_id = :userId AND ut.earned_at IS NOT NULL AND ut.earned_at >= :from
                    GROUP BY DATE(ut.earned_at)
                ) combined ON combined.day = gs.day
                GROUP BY gs.day
                ORDER BY gs.day ASC
                SQL,
            ['userId' => $userId, 'from' => $from],
        );

        $xpEarned = array_sum(array_map(static fn (array $row) => (int) $row['xp'], $history));

        return new JsonResponse([
            'days' => $days,
            'sessionsCount' => $sessionsCount,
            'practiceSeconds' => $practiceSeconds,
            'quizzesCompleted' => $quizzesCompleted,
            'challengesCompleted' => $challengesCompleted,
            'xpEarned' => $xpEarned,
            'worldBreakdown' => array_map(
                static fn (array $row) => ['world' => $row['world'], 'count' => (int) $row['session_count']],
                $worldBreakdown,
            ),
            'history' => array_map(
                static fn (array $row) => [
                    'day' => $row['day'],
                    'sessionsCount' => (int) $row['session_count'],
                    'xpEarned' => (int) $row['xp'],
                ],
                $history,
            ),
        ]);
    }
}
