<?php

namespace App\Controller\Api;

use App\Entity\Scenario;
use App\Repository\ScenarioRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class ScenarioController
{
    #[Route('/api/scenarios', name: 'api_scenarios_index', methods: ['GET'])]
    public function index(Request $request, ScenarioRepository $repository): JsonResponse
    {
        $scenarios = $repository->findCatalog(
            levelCode: $request->query->get('level'),
            category: $request->query->get('category'),
        );

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
            ],
            $scenarios,
        ));
    }
}
