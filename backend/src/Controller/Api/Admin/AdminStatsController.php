<?php

namespace App\Controller\Api\Admin;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * CDCF §3.9 Module 5. One connection, hand-written SQL: these are exactly
 * the kind of cross-table aggregate reads DQL/QueryBuilder gets awkward for,
 * and this project only ever targets PostgreSQL anyway.
 */
final class AdminStatsController
{
    #[Route('/api/admin/stats', name: 'api_admin_stats', methods: ['GET'])]
    public function __invoke(Connection $connection): JsonResponse
    {
        $usersCount = (int) $connection->fetchOne('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
        $sessionsCount = (int) $connection->fetchOne('SELECT COUNT(*) FROM mission_sessions');
        $completedSessionsCount = (int) $connection->fetchOne("SELECT COUNT(*) FROM mission_sessions WHERE status = 'completed'");
        $completionRate = $sessionsCount > 0 ? round(100 * $completedSessionsCount / $sessionsCount, 1) : 0.0;

        $levelDistribution = $connection->fetchAllAssociative(
            <<<'SQL'
                SELECT l.code, COUNT(u.id) AS user_count
                FROM levels l
                LEFT JOIN users u ON u.level_id = l.id AND u.deleted_at IS NULL
                GROUP BY l.code, l.order_num
                ORDER BY l.order_num
                SQL,
        );

        $sessionsByDay = $connection->fetchAllAssociative(
            <<<'SQL'
                SELECT DATE(started_at) AS day, COUNT(*) AS session_count
                FROM mission_sessions
                WHERE started_at >= CURRENT_DATE - INTERVAL '13 days'
                GROUP BY DATE(started_at)
                ORDER BY day ASC
                SQL,
        );

        // % of active users who completed *a* daily challenge today (CDCF
        // Module 5: "% d'utilisateurs actifs ayant fait le défi").
        $usersWhoCompletedToday = (int) $connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(DISTINCT cs.user_id)
                FROM challenge_sessions cs
                INNER JOIN daily_challenges dc ON dc.id = cs.challenge_id
                WHERE dc.challenge_date = CURRENT_DATE AND cs.completed_at IS NOT NULL
                SQL,
        );

        $xpDistributedToday = (int) $connection->fetchOne(
            <<<'SQL'
                SELECT
                    COALESCE((SELECT SUM(xp_earned) FROM mission_sessions WHERE DATE(ended_at) = CURRENT_DATE), 0)
                    + COALESCE((SELECT SUM(xp_earned) FROM quiz_attempts WHERE DATE(attempted_at) = CURRENT_DATE), 0)
                    + COALESCE((SELECT SUM(xp_earned) FROM challenge_sessions WHERE DATE(completed_at) = CURRENT_DATE), 0)
                SQL,
        );

        return new JsonResponse([
            'usersCount' => $usersCount,
            'sessionsCount' => $sessionsCount,
            'completedSessionsCount' => $completedSessionsCount,
            'completionRate' => $completionRate,
            'levelDistribution' => array_map(
                static fn (array $row) => ['level' => $row['code'], 'count' => (int) $row['user_count']],
                $levelDistribution,
            ),
            'sessionsByDay' => array_map(
                static fn (array $row) => ['day' => $row['day'], 'count' => (int) $row['session_count']],
                $sessionsByDay,
            ),
            'challengeParticipationRate' => $usersCount > 0
                ? round(100 * $usersWhoCompletedToday / $usersCount, 1)
                : 0.0,
            'xpDistributedToday' => $xpDistributedToday,
        ]);
    }
}
