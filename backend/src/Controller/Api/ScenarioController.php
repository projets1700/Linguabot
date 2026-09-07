<?php

namespace App\Controller\Api;

use App\Entity\Scenario;
use App\Entity\User;
use App\Repository\ScenarioRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class ScenarioController
{
    #[Route('/api/scenarios', name: 'api_scenarios_index', methods: ['GET'])]
    public function index(Request $request, ScenarioRepository $repository, #[CurrentUser] User $user): JsonResponse
    {
        $scenarios = $repository->findCatalog(
            levelCode: $request->query->get('level'),
            category: $request->query->get('category'),
        );

        $userOrderNum = $user->getLevel()->getOrderNum();

        return new JsonResponse(array_map(
            fn (Scenario $scenario) => [
                'id' => $scenario->getId(),
                'code' => $scenario->getCode(),
                'title' => $scenario->getTitle(),
                'context' => $scenario->getContext(),
                'level' => $scenario->getLevel()->getCode(),
                'category' => $scenario->getCategory()->value,
                'characterName' => $scenario->getCharacterName(),
                'durationEstimate' => $scenario->getDurationEstimate(),
                'baseXp' => $scenario->getBaseXp(),
                // Shown but not playable above the learner's own level (see
                // SessionController::start()'s matching guard) - locked
                // scenarios stay visible on purpose, as a preview of what
                // levelling up unlocks.
                'locked' => $scenario->getLevel()->getOrderNum() > $userOrderNum,
            ],
            $scenarios,
        ));
    }
}
