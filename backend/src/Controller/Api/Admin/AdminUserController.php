<?php

namespace App\Controller\Api\Admin;

use App\Entity\User;
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
    ): JsonResponse {
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
    ): JsonResponse {
        // RG12: soft delete (RGPD). The physical hard delete after the 24h
        // grace period would be a scheduled Messenger task in production.
        $user->setIsActive(false);
        $user->setDeletedAt(new \DateTimeImmutable());
        $em->flush();

        $adminLogger->log($admin, 'user.delete', 'User', $user->getId());

        return new JsonResponse(['message' => 'Compte marqué pour suppression (RGPD).']);
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
