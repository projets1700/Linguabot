<?php

namespace App\Controller\Api\Admin;

use App\Entity\DailyChallenge;
use App\Entity\User;
use App\Repository\DailyChallengeRepository;
use App\Repository\LevelRepository;
use App\Service\AdminLogger;
use App\Service\DailyChallengeService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class AdminChallengeController
{
    #[Route('/api/admin/daily-challenges', name: 'api_admin_challenges_index', methods: ['GET'])]
    public function index(DailyChallengeRepository $dailyChallengeRepository): JsonResponse
    {
        $challenges = $dailyChallengeRepository->createQueryBuilder('c')
            ->innerJoin('c.level', 'l')->addSelect('l')
            ->orderBy('c.challengeDate', 'DESC')
            ->addOrderBy('l.orderNum', 'ASC')
            ->setMaxResults(30 * 5) // 30 derniers jours, jusqu'à 5 niveaux/jour
            ->getQuery()
            ->getResult();

        return new JsonResponse(array_map($this->serializeChallenge(...), $challenges));
    }

    #[Route('/api/admin/daily-challenges/regenerate', name: 'api_admin_challenges_regenerate', methods: ['POST'])]
    public function regenerate(
        Request $request,
        #[CurrentUser] User $admin,
        LevelRepository $levelRepository,
        DailyChallengeRepository $dailyChallengeRepository,
        DailyChallengeService $dailyChallengeService,
        AdminLogger $adminLogger,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];
        $level = $levelRepository->findOneBy(['code' => $data['level'] ?? '']);

        if (null === $level) {
            return new JsonResponse(['message' => 'Niveau invalide.'], 422);
        }

        $today = new \DateTimeImmutable('today');

        // Regenerate in place rather than delete+recreate: a learner may
        // already have a challenge_sessions row pointing at today's
        // challenge, and that FK has no ON DELETE clause (RESTRICT), so
        // deleting it here would either fail or orphan their participation.
        $existing = $dailyChallengeRepository->findForLevelAndDate($level, $today);
        $challenge = $dailyChallengeService->regenerate($level, $today, $existing);

        $adminLogger->log($admin, 'daily_challenge.regenerate', 'DailyChallenge', $challenge->getId(), ['level' => $level->getCode()]);

        return new JsonResponse($this->serializeChallenge($challenge), 201);
    }

    private function serializeChallenge(DailyChallenge $challenge): array
    {
        return [
            'id' => $challenge->getId(),
            'level' => $challenge->getLevel()->getCode(),
            'title' => $challenge->getTitle(),
            'context' => $challenge->getContext(),
            'objective' => $challenge->getObjective(),
            'keywords' => $challenge->getKeywords(),
            'characterName' => $challenge->getCharacterName(),
            'challengeDate' => $challenge->getChallengeDate()->format('Y-m-d'),
        ];
    }
}
