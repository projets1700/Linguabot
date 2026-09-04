<?php

namespace App\Repository;

use App\Entity\Trophy;
use App\Entity\User;
use App\Entity\UserTrophy;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<UserTrophy>
 */
class UserTrophyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, UserTrophy::class);
    }

    public function findOneForUserAndTrophy(User $user, Trophy $trophy): ?UserTrophy
    {
        return $this->findOneBy(['user' => $user, 'trophy' => $trophy]);
    }
}
