<?php

namespace App\Repository;

use App\Entity\Session;
use App\Entity\User;
use App\Enum\SessionStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Session>
 */
class SessionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Session::class);
    }

    public function averageScoreForUser(User $user): ?string
    {
        $result = $this->createQueryBuilder('s')
            ->select('AVG(s.score) AS avg_score')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->getQuery()
            ->getSingleScalarResult();

        return null !== $result ? (string) round((float) $result, 2) : null;
    }

    public function hasPerfectScore(User $user): bool
    {
        return null !== $this->createQueryBuilder('s')
            ->select('s.id')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->andWhere('s.score = 100')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Highest number of completed sessions the user has ever logged on a
     * single calendar day. Raw SQL: DQL has no portable date-truncation
     * function, and this project only ever targets PostgreSQL.
     */
    public function maxCompletedSessionsInOneDay(User $user): int
    {
        $max = $this->getEntityManager()->getConnection()->fetchOne(
            <<<'SQL'
                SELECT COALESCE(MAX(day_count), 0)
                FROM (
                    SELECT COUNT(*) AS day_count
                    FROM sessions
                    WHERE user_id = :userId AND status = 'completed'
                    GROUP BY DATE(started_at)
                ) counts_by_day
                SQL,
            ['userId' => $user->getId()],
        );

        return (int) $max;
    }

    public function countDistinctScenarios(User $user): int
    {
        return (int) $this->createQueryBuilder('s')
            ->select('COUNT(DISTINCT s.scenario)')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function hasCompletedScenarioCode(User $user, string $scenarioCode): bool
    {
        return null !== $this->createQueryBuilder('s')
            ->select('s.id')
            ->innerJoin('s.scenario', 'sc')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->andWhere('sc.code = :code')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setParameter('code', $scenarioCode)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function hasCompletedScenarioCodeWithScoreAbove(User $user, string $scenarioCode, float $minScore): bool
    {
        return null !== $this->createQueryBuilder('s')
            ->select('s.id')
            ->innerJoin('s.scenario', 'sc')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->andWhere('sc.code = :code')
            ->andWhere('s.score > :minScore')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setParameter('code', $scenarioCode)
            ->setParameter('minScore', $minScore)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Distinct completed scenarios for a level (+ optional category).
     */
    public function countDistinctCompletedScenariosForLevel(User $user, string $levelCode, ?string $category = null): int
    {
        $qb = $this->createQueryBuilder('s')
            ->select('COUNT(DISTINCT s.scenario)')
            ->innerJoin('s.scenario', 'sc')
            ->innerJoin('sc.level', 'l')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->andWhere('l.code = :levelCode')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setParameter('levelCode', $levelCode);

        if (null !== $category) {
            $qb->andWhere('sc.category = :category')->setParameter('category', $category);
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Number of distinct scenarios where the user's best score exceeds the
     * given threshold (used by the "Perfectionniste" trophy).
     */
    public function countDistinctScenariosWithScoreAbove(User $user, float $minScore): int
    {
        return (int) $this->createQueryBuilder('s')
            ->select('COUNT(DISTINCT s.scenario)')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->andWhere('s.score > :minScore')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setParameter('minScore', $minScore)
            ->getQuery()
            ->getSingleScalarResult();
    }
}
