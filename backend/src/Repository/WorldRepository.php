<?php

namespace App\Repository;

use App\Entity\World;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<World>
 */
class WorldRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, World::class);
    }

    /**
     * @return World[]
     */
    public function findAllOrdered(): array
    {
        return $this->createQueryBuilder('w')
            ->andWhere('w.isActive = true')
            ->orderBy('w.orderNum', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findOneActiveByCode(string $code): ?World
    {
        return $this->createQueryBuilder('w')
            ->andWhere('w.code = :code')
            ->andWhere('w.isActive = true')
            ->setParameter('code', $code)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
