<?php

namespace App\Controller\Api\Admin;

use App\Entity\User;
use App\Enum\UserRole;
use App\Repository\UserRepository;
use App\Service\AdminLogger;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class AdminUserController
{
    #[Route('/api/admin/users', name: 'api_admin_users_index', methods: ['GET'])]
    public function index(Request $request, UserRepository $userRepository): JsonResponse
    {
        $levelCode = $request->query->get('level');
        $status = $request->query->get('status'); // 'active' | 'inactive'

        $qb = $userRepository->createQueryBuilder('u')
            ->innerJoin('u.level', 'l')->addSelect('l')
            ->andWhere('u.deletedAt IS NULL')
            ->orderBy('u.createdAt', 'DESC');

        if (\is_string($levelCode) && '' !== $levelCode) {
            $qb->andWhere('l.code = :levelCode')->setParameter('levelCode', $levelCode);
        }

        if ('active' === $status) {
            $qb->andWhere('u.isActive = true');
        } elseif ('inactive' === $status) {
            $qb->andWhere('u.isActive = false');
        }

        $users = $qb->getQuery()->getResult();

        return new JsonResponse(array_map($this->serializeUser(...), $users));
    }

    #[Route('/api/admin/users/{id}', name: 'api_admin_users_show', methods: ['GET'])]
    public function show(User $user): JsonResponse
    {
        return new JsonResponse($this->serializeUser($user));
    }

    #[Route('/api/admin/users/{id}/toggle-active', name: 'api_admin_users_toggle_active', methods: ['PATCH'])]
    public function toggleActive(
        User $user,
        #[CurrentUser] User $admin,
        AdminLogger $adminLogger,
        EntityManagerInterface $em,
        UserRepository $userRepository,
    ): JsonResponse {
        // Only deactivating (not re-activating) needs the guard below - an
        // admin turning themselves/the last admin back ON is always safe.
        if ($user->isActive()) {
            $blocked = $this->refuseIfSelfOrLastAdmin($user, $admin, $userRepository);
            if (null !== $blocked) {
                return $blocked;
            }
        }

        $user->setIsActive(!$user->isActive());
        $em->flush();

        $adminLogger->log(
            $admin,
            $user->isActive() ? 'user.enable' : 'user.disable',
            'User',
            $user->getId(),
        );

        return new JsonResponse($this->serializeUser($user));
    }

    #[Route('/api/admin/users/{id}', name: 'api_admin_users_delete', methods: ['DELETE'])]
    public function delete(
        User $user,
        #[CurrentUser] User $admin,
        AdminLogger $adminLogger,
        EntityManagerInterface $em,
        UserRepository $userRepository,
    ): JsonResponse {
        $blocked = $this->refuseIfSelfOrLastAdmin($user, $admin, $userRepository);
        if (null !== $blocked) {
            return $blocked;
        }

        // RG12: soft delete (RGPD). The physical hard delete after the 24h
        // grace period is PurgeDeletedAccountsCommand (app:purge-deleted-accounts),
        // meant to run on a cron once a real deployment exists.
        $user->setIsActive(false);
        $user->setDeletedAt(new \DateTimeImmutable());
        $em->flush();

        $adminLogger->log($admin, 'user.delete', 'User', $user->getId());

        return new JsonResponse(['message' => 'Compte marqué pour suppression (RGPD).']);
    }

    /**
     * Shared guard for toggleActive()/delete(): an admin must never be able
     * to deactivate/delete their own account (accidental self-lockout) nor
     * the last remaining active admin (accidental total lockout of the
     * admin area). Returns a JsonResponse to short-circuit the caller with,
     * or null if the action is safe to proceed.
     */
    private function refuseIfSelfOrLastAdmin(User $user, User $admin, UserRepository $userRepository): ?JsonResponse
    {
        if ($user->getId() === $admin->getId()) {
            return new JsonResponse(['message' => 'Un administrateur ne peut pas se désactiver ou se supprimer lui-même.'], 400);
        }

        if (UserRole::ADMIN === $user->getRole() && $userRepository->countActiveAdmins() <= 1) {
            return new JsonResponse(['message' => 'Impossible : ce serait le dernier administrateur actif.'], 400);
        }

        return null;
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->getId(),
            'prenom' => $user->getPrenom(),
            'nom' => $user->getNom(),
            'email' => $user->getEmail(),
            'role' => $user->getRole()->value,
            'level' => $user->getLevel()->getCode(),
            'totalXp' => $user->getTotalXp(),
            'sessionsCount' => $user->getSessionsCount(),
            'isActive' => $user->isActive(),
            'createdAt' => $user->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }
}
