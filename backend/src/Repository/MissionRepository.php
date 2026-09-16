<?php

namespace App\Repository;

use App\Entity\Mission;
use App\Entity\Situation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Mission>
 */
class MissionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Mission::class);
    }

    /**
     * @return Mission[]
     */
    public function findBySituationOrdered(Situation $situation): array
    {
        return $this->createQueryBuilder('m')
            ->innerJoin('m.level', 'l')->addSelect('l')
            ->andWhere('m.situation = :situation')
            ->andWhere('m.isActive = true')
            ->setParameter('situation', $situation)
            ->orderBy('l.orderNum', 'ASC')
            ->addOrderBy('m.orderNum', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
