<?php

namespace App\Repository;

use App\Entity\Room;
use App\Entity\World;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Room>
 */
class RoomRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Room::class);
    }

    /**
     * @return Room[]
     */
    public function findByWorldOrdered(World $world): array
    {
        return $this->createQueryBuilder('r')
            ->andWhere('r.world = :world')
            ->andWhere('r.isActive = true')
            ->setParameter('world', $world)
            ->orderBy('r.orderNum', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
