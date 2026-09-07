<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Enum\SessionStatus;
use App\Repository\PlacementTestRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class MeController
{
    #[Route('/api/me', name: 'api_me', methods: ['GET'])]
    public function __invoke(#[CurrentUser] User $user, PlacementTestRepository $placementTestRepository): JsonResponse
    {
        $placementTest = $placementTestRepository->findOneByUser($user);

        return new JsonResponse([
            'id' => $user->getId(),
            'prenom' => $user->getPrenom(),
            'nom' => $user->getNom(),
            'email' => $user->getEmail(),
            'role' => $user->getRole()->value,
            'level' => [
                'code' => $user->getLevel()->getCode(),
                'name' => $user->getLevel()->getName(),
                'xpThreshold' => $user->getLevel()->getXpThreshold(),
            ],
            'avatarType' => $user->getAvatarType()->value,
            'totalXp' => $user->getTotalXp(),
            'sessionsCount' => $user->getSessionsCount(),
            'avgScore' => $user->getAvgScore(),
            'placementTestCompleted' => null !== $placementTest && SessionStatus::COMPLETED === $placementTest->getStatus(),
        ]);
    }
}
