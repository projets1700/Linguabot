<?php

namespace App\Repository;

use App\Entity\QuizAttempt;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<QuizAttempt>
 */
class QuizAttemptRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, QuizAttempt::class);
    }

    /**
     * @return int[] Distinct module IDs the user has passed at least once.
     */
    public function findPassedModuleIds(User $user): array
    {
        $rows = $this->createQueryBuilder('a')
            ->select('IDENTITY(a.module) AS module_id')
            ->andWhere('a.user = :user')
            ->andWhere('a.passed = true')
            ->distinct()
            ->setParameter('user', $user)
            ->getQuery()
            ->getScalarResult();

        return array_map(static fn (array $row): int => (int) $row['module_id'], $rows);
    }

    public function countDistinctPassedModules(User $user): int
    {
        return \count($this->findPassedModuleIds($user));
    }
}
