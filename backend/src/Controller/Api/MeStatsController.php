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
        $from = (new \DateTimeImmutable())->modify("-{$days} days")->format('Y-m-d');

        $sessionsCount = (int) $connection->fetchOne(
            "SELECT COUNT(*) FROM sessions WHERE user_id = :userId AND status = 'completed' AND started_at >= :from",
            ['userId' => $userId, 'from' => $from],
        );

        $practiceSeconds = (int) $connection->fetchOne(
            <<<'SQL'
                SELECT COALESCE(SUM(duration_seconds), 0) FROM sessions
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

        $categoryBreakdown = $connection->fetchAllAssociative(
            <<<'SQL'
                SELECT sc.category, COUNT(*) AS session_count
                FROM sessions s
                INNER JOIN scenarios sc ON sc.id = s.scenario_id
                WHERE s.user_id = :userId AND s.status = 'completed' AND s.started_at >= :from
                GROUP BY sc.category
                SQL,
            ['userId' => $userId, 'from' => $from],
        );

        // Every source of XP that carries its own date, combined by day so
        // the top-line total and the daily history stay consistent with
        // each other - badges/trophies included, unlike a naive read of
        // just sessions/quiz_attempts/challenge_sessions, so this
        // reconciles fully with the learner's lifetime User::totalXp.
        $history = $connection->fetchAllAssociative(
            <<<'SQL'
                SELECT day, SUM(session_count) AS session_count, SUM(xp) AS xp
                FROM (
                    SELECT DATE(started_at) AS day, COUNT(*) AS session_count, COALESCE(SUM(xp_earned), 0) AS xp
                    FROM sessions
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
                ) combined
                GROUP BY day
                ORDER BY day ASC
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
            'categoryBreakdown' => array_map(
                static fn (array $row) => ['category' => $row['category'], 'count' => (int) $row['session_count']],
                $categoryBreakdown,
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
