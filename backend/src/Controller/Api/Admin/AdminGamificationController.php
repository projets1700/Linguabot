<?php

namespace App\Controller\Api\Admin;

use App\Entity\Badge;
use App\Entity\Trophy;
use App\Entity\User;
use App\Repository\BadgeRepository;
use App\Repository\TrophyRepository;
use App\Service\AdminLogger;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class AdminGamificationController
{
    #[Route('/api/admin/badges', name: 'api_admin_badges_index', methods: ['GET'])]
    public function badges(BadgeRepository $badgeRepository): JsonResponse
    {
        return new JsonResponse(array_map(
            static fn (Badge $b) => [
                'id' => $b->getId(),
                'code' => $b->getCode(),
                'name' => $b->getName(),
                'conditionType' => $b->getConditionType(),
                'conditionValue' => $b->getConditionValue(),
                'xpBonus' => $b->getXpBonus(),
                'isActive' => $b->isActive(),
            ],
            $badgeRepository->findBy([], ['id' => 'ASC']),
        ));
    }

    #[Route('/api/admin/badges/{id}/toggle-active', name: 'api_admin_badges_toggle_active', methods: ['PATCH'])]
    public function toggleBadgeActive(
        Badge $badge,
        #[CurrentUser] User $admin,
        AdminLogger $adminLogger,
        EntityManagerInterface $em,
    ): JsonResponse {
        $badge->setIsActive(!$badge->isActive());
        $em->flush();

        $adminLogger->log(
            $admin,
            $badge->isActive() ? 'badge.enable' : 'badge.disable',
            'Badge',
            $badge->getId(),
        );

        return new JsonResponse(['id' => $badge->getId(), 'isActive' => $badge->isActive()]);
    }

    #[Route('/api/admin/trophies', name: 'api_admin_trophies_index', methods: ['GET'])]
    public function trophies(TrophyRepository $trophyRepository): JsonResponse
    {
        return new JsonResponse(array_map(
            static fn (Trophy $t) => [
                'id' => $t->getId(),
                'code' => $t->getCode(),
                'name' => $t->getName(),
                'conditionType' => $t->getConditionType(),
                'conditionValue' => $t->getConditionValue(),
                'xpReward' => $t->getXpReward(),
                'rarity' => $t->getRarity()->value,
            ],
            $trophyRepository->findBy([], ['id' => 'ASC']),
        ));
    }
}
