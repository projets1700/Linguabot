<?php

namespace App\Repository;

use App\Entity\PlacementTest;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PlacementTest>
 */
class PlacementTestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PlacementTest::class);
    }

    public function findOneByUser(User $user): ?PlacementTest
    {
        return $this->findOneBy(['user' => $user]);
    }
}
