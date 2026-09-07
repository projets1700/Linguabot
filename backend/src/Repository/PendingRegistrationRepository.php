<?php

namespace App\Repository;

use App\Entity\PendingRegistration;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PendingRegistration>
 */
class PendingRegistrationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PendingRegistration::class);
    }

    public function findByEmail(string $email): ?PendingRegistration
    {
        return $this->findOneBy(['email' => $email]);
    }

    public function findByToken(string $token): ?PendingRegistration
    {
        return $this->findOneBy(['token' => $token]);
    }
}
