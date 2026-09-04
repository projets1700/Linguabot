<?php

namespace App\Controller\Api\Admin;

use App\Entity\Scenario;
use App\Entity\User;
use App\Enum\ScenarioCategory;
use App\Repository\LevelRepository;
use App\Repository\ScenarioRepository;
use App\Service\AdminLogger;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class AdminScenarioController
{
    #[Route('/api/admin/scenarios', name: 'api_admin_scenarios_index', methods: ['GET'])]
    public function index(ScenarioRepository $scenarioRepository): JsonResponse
    {
        $scenarios = $scenarioRepository->createQueryBuilder('s')
            ->innerJoin('s.level', 'l')->addSelect('l')
            ->orderBy('l.orderNum', 'ASC')
            ->addOrderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();

        return new JsonResponse(array_map($this->serializeScenario(...), $scenarios));
    }

    #[Route('/api/admin/scenarios', name: 'api_admin_scenarios_create', methods: ['POST'])]
    public function create(
        Request $request,
        #[CurrentUser] User $admin,
        LevelRepository $levelRepository,
        AdminLogger $adminLogger,
        EntityManagerInterface $em,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];

        $level = $levelRepository->findOneBy(['code' => $data['level'] ?? '']);
        if (null === $level) {
            return new JsonResponse(['message' => 'Niveau invalide.'], 422);
        }

        try {
            $category = ScenarioCategory::from($data['category'] ?? '');
        } catch (\ValueError) {
            return new JsonResponse(['message' => 'Catégorie invalide (quotidien ou thematique).'], 422);
        }

        $scenario = (new Scenario())
            ->setCode((string) ($data['code'] ?? ''))
            ->setTitle((string) ($data['title'] ?? ''))
            ->setContext((string) ($data['context'] ?? ''))
            ->setLevel($level)
            ->setCategory($category)
            ->setPromptTemplate((string) ($data['promptTemplate'] ?? ''))
            ->setCharacterName((string) ($data['characterName'] ?? ''))
            ->setDurationEstimate((int) ($data['durationEstimate'] ?? 10))
            ->setBaseXp((int) ($data['baseXp'] ?? 60));

        $em->persist($scenario);
        $em->flush();

        $adminLogger->log($admin, 'scenario.create', 'Scenario', $scenario->getId(), ['code' => $scenario->getCode()]);

        return new JsonResponse($this->serializeScenario($scenario), 201);
    }

    #[Route('/api/admin/scenarios/{id}', name: 'api_admin_scenarios_update', methods: ['PATCH'])]
    public function update(
        Scenario $scenario,
        Request $request,
        #[CurrentUser] User $admin,
        AdminLogger $adminLogger,
        EntityManagerInterface $em,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['title'])) {
            $scenario->setTitle((string) $data['title']);
        }
        if (isset($data['context'])) {
            $scenario->setContext((string) $data['context']);
        }
        if (isset($data['promptTemplate'])) {
            $scenario->setPromptTemplate((string) $data['promptTemplate']);
        }
        if (isset($data['characterName'])) {
            $scenario->setCharacterName((string) $data['characterName']);
        }
        if (isset($data['baseXp'])) {
            $scenario->setBaseXp((int) $data['baseXp']);
        }
        $scenario->setUpdatedAt(new \DateTimeImmutable());

        $em->flush();

        $adminLogger->log($admin, 'scenario.update', 'Scenario', $scenario->getId());

        return new JsonResponse($this->serializeScenario($scenario));
    }

    #[Route('/api/admin/scenarios/{id}/toggle-active', name: 'api_admin_scenarios_toggle_active', methods: ['PATCH'])]
    public function toggleActive(
        Scenario $scenario,
        #[CurrentUser] User $admin,
        AdminLogger $adminLogger,
        EntityManagerInterface $em,
    ): JsonResponse {
        $scenario->setIsActive(!$scenario->isActive());
        $em->flush();

        $adminLogger->log(
            $admin,
            $scenario->isActive() ? 'scenario.enable' : 'scenario.disable',
            'Scenario',
            $scenario->getId(),
        );

        return new JsonResponse($this->serializeScenario($scenario));
    }

    private function serializeScenario(Scenario $scenario): array
    {
        return [
            'id' => $scenario->getId(),
            'code' => $scenario->getCode(),
            'title' => $scenario->getTitle(),
            'level' => $scenario->getLevel()->getCode(),
            'category' => $scenario->getCategory()->value,
            'characterName' => $scenario->getCharacterName(),
            'baseXp' => $scenario->getBaseXp(),
            'playCount' => $scenario->getPlayCount(),
            'isActive' => $scenario->isActive(),
        ];
    }
}
