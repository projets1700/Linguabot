<?php

namespace App\Repository;

use App\Entity\Room;
use App\Entity\Situation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Situation>
 */
class SituationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Situation::class);
    }

    /**
     * @return Situation[]
     */
    public function findByRoomOrdered(Room $room): array
    {
        return $this->createQueryBuilder('s')
            ->andWhere('s.room = :room')
            ->andWhere('s.isActive = true')
            ->setParameter('room', $room)
            ->orderBy('s.orderNum', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
