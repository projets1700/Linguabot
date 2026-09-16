<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Service\RoomCatalogService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class WorldController
{
    #[Route('/api/worlds', name: 'api_worlds_index', methods: ['GET'])]
    public function index(RoomCatalogService $roomCatalogService, #[CurrentUser] User $user): JsonResponse
    {
        return new JsonResponse($roomCatalogService->worldsOverview($user));
    }

    #[Route('/api/worlds/{code}', name: 'api_worlds_show', methods: ['GET'])]
    public function show(string $code, RoomCatalogService $roomCatalogService, #[CurrentUser] User $user): JsonResponse
    {
        $world = $roomCatalogService->findWorldByCode($code);
        if (null === $world) {
            return new JsonResponse(['message' => 'Monde introuvable.'], 404);
        }

        return new JsonResponse($roomCatalogService->worldDetail($world, $user));
    }
}
