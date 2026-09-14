<?php

namespace App\Repository;

use App\Entity\User;
use App\Enum\UserRole;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;

/**
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function findByEmail(string $email): ?User
    {
        return $this->findOneBy(['email' => $email]);
    }

    /**
     * Used by AdminUserController to refuse deactivating/deleting the last
     * remaining admin - active + not soft-deleted, since a disabled or
     * deleted admin can no longer authenticate anyway (UserChecker).
     */
    /**
     * Soft-deleted accounts past the RGPD grace period (RG12) - used by
     * app:purge-deleted-accounts to actually erase them.
     *
     * @return User[]
     */
    public function findDueForPurge(\DateTimeImmutable $cutoff): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.deletedAt IS NOT NULL')
            ->andWhere('u.deletedAt <= :cutoff')
            ->setParameter('cutoff', $cutoff)
            ->getQuery()
            ->getResult();
    }

    public function countActiveAdmins(): int
    {
        return (int) $this->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->andWhere('u.role = :role')
            ->andWhere('u.isActive = true')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('role', UserRole::ADMIN)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', $user::class));
        }

        $user->setPasswordHash($newHashedPassword);
        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }
}
