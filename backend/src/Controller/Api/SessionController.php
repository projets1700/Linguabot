<?php

namespace App\Controller\Api;

use App\Entity\Scenario;
use App\Entity\Session;
use App\Entity\SessionMessage;
use App\Entity\User;
use App\Enum\MessageRole;
use App\Enum\SessionStatus;
use App\Repository\SessionRepository;
use App\Service\GamificationService;
use App\Service\VoiceService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class SessionController
{
    #[Route('/api/scenarios/{id}/sessions', name: 'api_scenario_start_session', methods: ['POST'])]
    public function start(
        Scenario $scenario,
        #[CurrentUser] User $user,
        VoiceService $voiceService,
        EntityManagerInterface $em,
    ): JsonResponse {
        $session = (new Session())
            ->setUser($user)
            ->setScenario($scenario);
        $em->persist($session);

        $scenario->setPlayCount($scenario->getPlayCount() + 1);

        $opening = (new SessionMessage())
            ->setRole(MessageRole::ASSISTANT)
            ->setContent($voiceService->openingMessage($scenario));
        $session->addMessage($opening);
        $em->persist($opening);

        $em->flush();

        return new JsonResponse($this->serializeSession($session), 201);
    }

    #[Route('/api/sessions/{id}', name: 'api_session_show', methods: ['GET'])]
    public function show(Session $session, #[CurrentUser] User $user): JsonResponse
    {
        if ($session->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        return new JsonResponse($this->serializeSession($session));
    }

    #[Route('/api/sessions/{id}/message', name: 'api_session_message', methods: ['POST'])]
    public function message(
        Session $session,
        Request $request,
        #[CurrentUser] User $user,
        VoiceService $voiceService,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($session->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        if (SessionStatus::IN_PROGRESS !== $session->getStatus()) {
            return new JsonResponse(['message' => 'Cette session est déjà terminée.'], 422);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $transcript = $voiceService->transcribeAudio((string) ($data['message'] ?? ''));

        if ('' === $transcript) {
            return new JsonResponse(['message' => 'Message vide.'], 422);
        }

        $lastAssistantMessage = $session->getMessages()->last();

        // "Can you repeat that?" is not an answer: re-say the same line
        // without persisting anything, so it doesn't advance the turn
        // counter (VoiceService::generateAnswer cycles replies by turn
        // number) or change what the next real answer gets compared to.
        if (false !== $lastAssistantMessage && $voiceService->isRepeatRequest($transcript)) {
            return new JsonResponse([
                'userTranscript' => $transcript,
                'assistantMessage' => $voiceService->repeatMessage($lastAssistantMessage->getContent()),
            ]);
        }

        if (false !== $lastAssistantMessage && $voiceService->isEchoOfQuestion($transcript, $lastAssistantMessage->getContent())) {
            return new JsonResponse(['message' => "On dirait que tu répètes la question posée - réponds avec tes propres mots."], 422);
        }

        $userMessage = (new SessionMessage())
            ->setRole(MessageRole::USER)
            ->setContent($transcript);
        $session->addMessage($userMessage);
        $em->persist($userMessage);

        $turnNumber = $session->getMessages()->count();
        $reply = $voiceService->generateAnswer($transcript, $turnNumber);

        $assistantMessage = (new SessionMessage())
            ->setRole(MessageRole::ASSISTANT)
            ->setContent($reply);
        $session->addMessage($assistantMessage);
        $em->persist($assistantMessage);

        $em->flush();

        return new JsonResponse([
            'userTranscript' => $transcript,
            'assistantMessage' => $reply,
        ]);
    }

    #[Route('/api/sessions/{id}/finish', name: 'api_session_finish', methods: ['POST'])]
    public function finish(
        Session $session,
        #[CurrentUser] User $user,
        GamificationService $gamificationService,
        SessionRepository $sessionRepository,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($session->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        if (SessionStatus::IN_PROGRESS !== $session->getStatus()) {
            return new JsonResponse(['message' => 'Cette session est déjà terminée.'], 422);
        }

        // Simulated scoring: real pronunciation/relevance analysis arrives
        // with the GPT-4o integration. For now, score reflects how many
        // exchanges the learner completed.
        $userTurns = $session->getMessages()->filter(
            static fn (SessionMessage $m) => MessageRole::USER === $m->getRole(),
        )->count();
        $score = min(100, 40 + $userTurns * 15);

        $xpEarned = $gamificationService->calculateXp($session->getScenario()->getBaseXp(), $score);

        $startedAt = $session->getStartedAt();
        $endedAt = new \DateTimeImmutable();

        $session
            ->setScore((string) $score)
            ->setXpEarned($xpEarned)
            ->setDurationSeconds($endedAt->getTimestamp() - $startedAt->getTimestamp())
            ->setStatus(SessionStatus::COMPLETED)
            ->setEndedAt($endedAt);

        $user->setTotalXp($user->getTotalXp() + $xpEarned);
        $user->setSessionsCount($user->getSessionsCount() + 1);

        $em->flush();

        $user->setAvgScore($sessionRepository->averageScoreForUser($user));
        $em->flush();

        $newBadges = $gamificationService->checkAndAwardBadges($user);
        $newTrophies = $gamificationService->checkAndAwardTrophies($user);

        return new JsonResponse([
            'score' => $score,
            'xpEarned' => $xpEarned,
            'userTotalXp' => $user->getTotalXp(),
            'userSessionsCount' => $user->getSessionsCount(),
            'newBadges' => array_map(static fn ($b) => ['code' => $b->getCode(), 'name' => $b->getName(), 'icon' => $b->getIcon()], $newBadges),
            'newTrophies' => array_map(static fn ($t) => ['code' => $t->getCode(), 'name' => $t->getName(), 'rarity' => $t->getRarity()->value], $newTrophies),
        ]);
    }

    private function serializeSession(Session $session): array
    {
        return [
            'id' => $session->getId(),
            'status' => $session->getStatus()->value,
            'scenario' => [
                'id' => $session->getScenario()->getId(),
                'title' => $session->getScenario()->getTitle(),
                'characterName' => $session->getScenario()->getCharacterName(),
            ],
            'messages' => array_map(
                static fn (SessionMessage $m) => [
                    'id' => $m->getId(),
                    'role' => $m->getRole()->value,
                    'content' => $m->getContent(),
                ],
                $session->getMessages()->toArray(),
            ),
        ];
    }
}
