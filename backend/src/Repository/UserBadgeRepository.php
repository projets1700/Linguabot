<?php

namespace App\Repository;

use App\Entity\User;
use App\Entity\UserBadge;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<UserBadge>
 */
class UserBadgeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, UserBadge::class);
    }

    /**
     * @return string[] Badge codes already earned by the user.
     */
    public function findEarnedBadgeCodes(User $user): array
    {
        $rows = $this->createQueryBuilder('ub')
            ->select('b.code')
            ->innerJoin('ub.badge', 'b')
            ->andWhere('ub.user = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->getScalarResult();

        return array_column($rows, 'code');
    }
}
