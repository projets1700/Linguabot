<?php

namespace App\Repository;

use App\Entity\DailyChallenge;
use App\Entity\Level;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DailyChallenge>
 */
class DailyChallengeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DailyChallenge::class);
    }

    public function findForLevelAndDate(Level $level, \DateTimeImmutable $date): ?DailyChallenge
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.level = :level')
            ->andWhere('c.challengeDate = :date')
            ->setParameter('level', $level)
            ->setParameter('date', $date->format('Y-m-d'))
            ->getQuery()
            ->getOneOrNullResult();
    }
}
