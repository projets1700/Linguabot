<?php

namespace App\Repository;

use App\Entity\Session;
use App\Entity\User;
use App\Enum\SessionStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Session>
 */
class SessionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Session::class);
    }

    public function averageScoreForUser(User $user): ?string
    {
        $result = $this->createQueryBuilder('s')
            ->select('AVG(s.score) AS avg_score')
            ->andWhere('s.user = :user')
            ->andWhere('s.status = :status')
            ->setParameter('user', $user)
            ->setParameter('status', SessionStatus::COMPLETED)
            ->getQuery()
            ->getSingleScalarResult();

        return null !== $result ? (string) round((float) $result, 2) : null;
    }
}
