<?php

namespace App\Repository;

use App\Entity\ChallengeSession;
use App\Entity\DailyChallenge;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ChallengeSession>
 */
class ChallengeSessionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ChallengeSession::class);
    }

    public function findOneForUserAndChallenge(User $user, DailyChallenge $challenge): ?ChallengeSession
    {
        return $this->findOneBy(['user' => $user, 'challenge' => $challenge]);
    }

    /**
     * Number of consecutive calendar days (ending today or yesterday - a
     * streak isn't broken just because today's challenge isn't done yet)
     * for which the user completed that day's challenge. Backs the
     * "Champion du défi" badge (RG: 7 consecutive days).
     */
    public function currentConsecutiveStreak(User $user): int
    {
        $rows = $this->getEntityManager()->getConnection()->fetchFirstColumn(
            <<<'SQL'
                SELECT DISTINCT dc.challenge_date
                FROM challenge_sessions cs
                INNER JOIN daily_challenges dc ON dc.id = cs.challenge_id
                WHERE cs.user_id = :userId AND cs.completed_at IS NOT NULL
                ORDER BY dc.challenge_date DESC
                SQL,
            ['userId' => $user->getId()],
        );

        if ([] === $rows) {
            return 0;
        }

        $today = new \DateTimeImmutable('today');
        $expected = $rows[0] === $today->format('Y-m-d') ? $today : $today->modify('-1 day');

        $streak = 0;
        foreach ($rows as $dateString) {
            if ($dateString !== $expected->format('Y-m-d')) {
                break;
            }

            ++$streak;
            $expected = $expected->modify('-1 day');
        }

        return $streak;
    }
}
