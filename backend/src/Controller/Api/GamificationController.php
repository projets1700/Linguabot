<?php

namespace App\Controller\Api;

use App\Entity\Badge;
use App\Entity\Trophy;
use App\Entity\User;
use App\Repository\BadgeRepository;
use App\Repository\TrophyRepository;
use App\Repository\UserBadgeRepository;
use App\Repository\UserTrophyRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class GamificationController
{
    #[Route('/api/badges', name: 'api_badges_index', methods: ['GET'])]
    public function badges(
        #[CurrentUser] User $user,
        BadgeRepository $badgeRepository,
        UserBadgeRepository $userBadgeRepository,
    ): JsonResponse {
        $earnedCodes = $userBadgeRepository->findEarnedBadgeCodes($user);

        return new JsonResponse(array_map(
            fn (Badge $badge) => [
                'code' => $badge->getCode(),
                'name' => $badge->getName(),
                'description' => $badge->getDescription(),
                'icon' => $badge->getIcon(),
                'xpBonus' => $badge->getXpBonus(),
                'earned' => \in_array($badge->getCode(), $earnedCodes, true),
            ],
            $badgeRepository->findBy(['isActive' => true], ['id' => 'ASC']),
        ));
    }

    #[Route('/api/trophies', name: 'api_trophies_index', methods: ['GET'])]
    public function trophies(
        #[CurrentUser] User $user,
        TrophyRepository $trophyRepository,
        UserTrophyRepository $userTrophyRepository,
    ): JsonResponse {
        return new JsonResponse(array_map(
            function (Trophy $trophy) use ($user, $userTrophyRepository) {
                $userTrophy = $userTrophyRepository->findOneForUserAndTrophy($user, $trophy);

                return [
                    'code' => $trophy->getCode(),
                    'name' => $trophy->getName(),
                    'description' => $trophy->getDescription(),
                    'rarity' => $trophy->getRarity()->value,
                    'xpReward' => $trophy->getXpReward(),
                    'progressCurrent' => $userTrophy?->getProgressCurrent() ?? 0,
                    'progressTotal' => $userTrophy?->getProgressTotal() ?? $trophy->getConditionValue(),
                    'earned' => $userTrophy?->isEarned() ?? false,
                ];
            },
            $trophyRepository->findBy([], ['id' => 'ASC']),
        ));
    }
}
