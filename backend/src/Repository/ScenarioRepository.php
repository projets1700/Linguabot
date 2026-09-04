<?php

namespace App\Repository;

use App\Entity\Scenario;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Scenario>
 */
class ScenarioRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Scenario::class);
    }

    /**
     * @return Scenario[]
     */
    public function findCatalog(?string $levelCode, ?string $category): array
    {
        $qb = $this->createQueryBuilder('s')
            ->innerJoin('s.level', 'l')->addSelect('l')
            ->andWhere('s.isActive = true')
            ->orderBy('l.orderNum', 'ASC')
            ->addOrderBy('s.code', 'ASC');

        if (null !== $levelCode && '' !== $levelCode) {
            $qb->andWhere('l.code = :levelCode')->setParameter('levelCode', $levelCode);
        }

        if (null !== $category && '' !== $category) {
            $qb->andWhere('s.category = :category')->setParameter('category', $category);
        }

        return $qb->getQuery()->getResult();
    }
}
