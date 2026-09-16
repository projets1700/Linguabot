<?php

namespace App\Repository;

use App\Entity\MissionSession;
use App\Entity\Room;
use App\Entity\User;
use App\Enum\SessionStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<MissionSession>
 */
class MissionSessionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MissionSession::class);
    }

    /**
     * Situation ids within $room that this user has completed at least one
     * Mission of - drives both the "completed" badge on a Situation card and
     * the "unlock the next Situation" rule (RoomCatalogService), in one
     * query per room instead of one per situation.
     *
     * @return int[]
     */
    public function completedSituationIdsForUserInRoom(User $user, Room $room): array
    {
        $rows = $this->createQueryBuilder('ms')
            ->select('IDENTITY(mi.situation) AS situationId')
            ->innerJoin('ms.mission', 'mi')
            ->andWhere('ms.user = :user')
            ->andWhere('ms.status = :status')
            ->andWhere('mi.situation IN (SELECT s.id FROM App\Entity\Situation s WHERE s.room = :room)')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setParameter('room', $room)
            ->groupBy('situationId')
            ->getQuery()
            ->getScalarResult();

        return array_map(static fn (array $row): int => (int) $row['situationId'], $rows);
    }

    public function countCompletedMissions(User $user): int
    {
        return (int) $this->createQueryBuilder('ms')
            ->select('COUNT(ms.id)')
            ->andWhere('ms.user = :user')
            ->andWhere('ms.status = :status')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Keyed by the World's orderNum rather than the entity itself - lets a
     * Badge/Trophy fixture target "world_explored" by a plain conditionValue
     * integer (the world's orderNum, 0 for the pilot "Vie quotidienne"
     * world), the same way every other conditionType in GamificationService
     * is just an int, without introducing a World FK on Badge/Trophy.
     */
    public function hasCompletedAnyMissionInWorldWithOrderNum(User $user, int $orderNum): bool
    {
        $count = (int) $this->createQueryBuilder('ms')
            ->select('COUNT(ms.id)')
            ->innerJoin('ms.mission', 'mi')
            ->innerJoin('mi.situation', 's')
            ->innerJoin('s.room', 'r')
            ->innerJoin('r.world', 'w')
            ->andWhere('ms.user = :user')
            ->andWhere('ms.status = :status')
            ->andWhere('w.orderNum = :orderNum')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->setParameter('orderNum', $orderNum)
            ->setMaxResults(1)
            ->getQuery()
            ->getSingleScalarResult();

        return $count > 0;
    }
}
