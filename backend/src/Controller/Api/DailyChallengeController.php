<?php

namespace App\Controller\Api;

use App\Entity\ChallengeSession;
use App\Entity\User;
use App\Repository\ChallengeSessionRepository;
use App\Service\DailyChallengeService;
use App\Service\GamificationService;
use App\Service\VoiceService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class DailyChallengeController
{
    #[Route('/api/daily-challenge', name: 'api_daily_challenge_show', methods: ['GET'])]
    public function show(
        #[CurrentUser] User $user,
        DailyChallengeService $dailyChallengeService,
        ChallengeSessionRepository $challengeSessionRepository,
    ): JsonResponse {
        $challenge = $dailyChallengeService->findOrCreateTodaysChallenge($user->getLevel());
        $participation = $challengeSessionRepository->findOneForUserAndChallenge($user, $challenge);

        return new JsonResponse([
            'id' => $challenge->getId(),
            'title' => $challenge->getTitle(),
            'context' => $challenge->getContext(),
            'objective' => $challenge->getObjective(),
            'keywords' => $challenge->getKeywords(),
            'characterName' => $challenge->getCharacterName(),
            'challengeDate' => $challenge->getChallengeDate()->format('Y-m-d'),
            'xpReward' => $dailyChallengeService->baseXpForLevel($user->getLevel()->getCode()) * 2,
            'started' => null !== $participation,
            'completed' => $participation?->isCompleted() ?? false,
        ]);
    }

    #[Route('/api/daily-challenge/start', name: 'api_daily_challenge_start', methods: ['POST'])]
    public function start(
        #[CurrentUser] User $user,
        DailyChallengeService $dailyChallengeService,
        ChallengeSessionRepository $challengeSessionRepository,
        EntityManagerInterface $em,
    ): JsonResponse {
        $challenge = $dailyChallengeService->findOrCreateTodaysChallenge($user->getLevel());
        $participation = $challengeSessionRepository->findOneForUserAndChallenge($user, $challenge);

        if (null === $participation) {
            $participation = (new ChallengeSession())->setUser($user)->setChallenge($challenge);
            $em->persist($participation);
            $em->flush();
        }

        return new JsonResponse([
            'openingMessage' => \sprintf(
                "Hello! I'm %s. %s Ready? %s",
                $challenge->getCharacterName(),
                $challenge->getContext(),
                $challenge->getObjective(),
            ),
        ], 201);
    }

    #[Route('/api/daily-challenge/message', name: 'api_daily_challenge_message', methods: ['POST'])]
    public function message(Request $request, VoiceService $voiceService): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $transcript = $voiceService->transcribeAudio((string) ($data['message'] ?? ''));
        $turnNumber = (int) ($data['turnNumber'] ?? 0);

        if ('' === $transcript) {
            return new JsonResponse(['message' => 'Message vide.'], 422);
        }

        return new JsonResponse([
            'userTranscript' => $transcript,
            'assistantMessage' => $voiceService->generateAnswer($transcript, $turnNumber),
        ]);
    }

    #[Route('/api/daily-challenge/finish', name: 'api_daily_challenge_finish', methods: ['POST'])]
    public function finish(
        #[CurrentUser] User $user,
        DailyChallengeService $dailyChallengeService,
        ChallengeSessionRepository $challengeSessionRepository,
        GamificationService $gamificationService,
        EntityManagerInterface $em,
    ): JsonResponse {
        $challenge = $dailyChallengeService->findOrCreateTodaysChallenge($user->getLevel());
        $participation = $challengeSessionRepository->findOneForUserAndChallenge($user, $challenge);

        if (null === $participation) {
            return new JsonResponse(['message' => "Le défi n'a pas encore été commencé."], 422);
        }

        if ($participation->isCompleted()) {
            return new JsonResponse(['message' => 'Ce défi est déjà terminé.'], 422);
        }

        // RG: XP du niveau x2, toujours - le défi expire le jour même donc
        // "complété avant 23h59" est la seule fenêtre où il est même visible.
        $xpEarned = $dailyChallengeService->baseXpForLevel($user->getLevel()->getCode()) * 2;

        $participation->setXpEarned($xpEarned)->setCompletedAt(new \DateTimeImmutable());
        $user->setTotalXp($user->getTotalXp() + $xpEarned);
        $em->flush();

        $newBadges = $gamificationService->checkAndAwardBadges($user);
        $newTrophies = $gamificationService->checkAndAwardTrophies($user);

        return new JsonResponse([
            'xpEarned' => $xpEarned,
            'userTotalXp' => $user->getTotalXp(),
            'newBadges' => array_map(static fn ($b) => ['code' => $b->getCode(), 'name' => $b->getName(), 'icon' => $b->getIcon()], $newBadges),
            'newTrophies' => array_map(static fn ($t) => ['code' => $t->getCode(), 'name' => $t->getName(), 'rarity' => $t->getRarity()->value], $newTrophies),
        ]);
    }
}
