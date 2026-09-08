<?php

namespace App\Controller\Api;

use App\Entity\Scenario;
use App\Entity\Session;
use App\Entity\SessionMessage;
use App\Entity\User;
use App\Enum\MessageRole;
use App\Enum\SessionStatus;
use App\Repository\SessionRepository;
use App\Service\CecrlProfileService;
use App\Service\GamificationService;
use App\Service\LearningAidService;
use App\Service\SessionSummaryService;
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
        CecrlProfileService $cecrlProfileService,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($scenario->getLevel()->getOrderNum() > $user->getLevel()->getOrderNum()) {
            return new JsonResponse([
                'message' => \sprintf(
                    "Ce scénario est verrouillé : atteins le niveau %s pour y accéder.",
                    $scenario->getLevel()->getCode(),
                ),
            ], 403);
        }

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

        return new JsonResponse($this->serializeSession($session, $cecrlProfileService), 201);
    }

    #[Route('/api/sessions/{id}', name: 'api_session_show', methods: ['GET'])]
    public function show(Session $session, #[CurrentUser] User $user, CecrlProfileService $cecrlProfileService): JsonResponse
    {
        if ($session->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        return new JsonResponse($this->serializeSession($session, $cecrlProfileService));
    }

    #[Route('/api/sessions/{id}/message', name: 'api_session_message', methods: ['POST'])]
    public function message(
        Session $session,
        Request $request,
        #[CurrentUser] User $user,
        VoiceService $voiceService,
        CecrlProfileService $cecrlProfileService,
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
        // Set by the frontend's detectLearnerBlock() - a deterministic "the
        // learner explicitly said they don't know/understand" signal for
        // this one turn, not a grammar/quality judgment. Defaults to false
        // so older/other clients omitting the field behave exactly as before.
        $learnerBlocked = (bool) ($data['learnerBlocked'] ?? false);

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
        $conversationHistory = array_map(
            static fn (SessionMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $session->getMessages()->toArray(),
        );
        $levelCode = $user->getLevel()->getCode();
        // Two separate concerns composed together: complexity/pacing
        // (unchanged) and how much LinguaBot should step in to help or
        // correct this specific turn (new - see CecrlProfileService).
        $levelInstruction = $cecrlProfileService->buildSystemPromptPrefix($levelCode, $turnNumber).' '.
            $cecrlProfileService->buildSupportInstruction($levelCode, $learnerBlocked);
        $reply = $voiceService->generateAnswer($session->getScenario()->getPromptTemplate(), $conversationHistory, $turnNumber, $levelInstruction);

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

    #[Route('/api/sessions/{id}/hint', name: 'api_session_hint', methods: ['POST'])]
    public function hint(
        Session $session,
        Request $request,
        #[CurrentUser] User $user,
        LearningAidService $learningAidService,
    ): JsonResponse {
        if ($session->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $tier = (int) ($data['tier'] ?? 1);
        if ($tier < 1 || $tier > 3) {
            return new JsonResponse(['message' => 'Palier d\'aide invalide.'], 422);
        }

        $conversationHistory = array_map(
            static fn (SessionMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $session->getMessages()->toArray(),
        );

        return new JsonResponse([
            'tier' => $tier,
            'content' => $learningAidService->hint($conversationHistory, $tier),
        ]);
    }

    #[Route('/api/sessions/{id}/translate', name: 'api_session_translate', methods: ['POST'])]
    public function translate(
        Session $session,
        Request $request,
        #[CurrentUser] User $user,
        LearningAidService $learningAidService,
    ): JsonResponse {
        if ($session->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $text = trim((string) ($data['text'] ?? ''));
        if ('' === $text) {
            return new JsonResponse(['message' => 'Texte manquant.'], 422);
        }

        return new JsonResponse(['translation' => $learningAidService->translate($text)]);
    }

    #[Route('/api/sessions/{id}/finish', name: 'api_session_finish', methods: ['POST'])]
    public function finish(
        Session $session,
        #[CurrentUser] User $user,
        GamificationService $gamificationService,
        SessionSummaryService $sessionSummaryService,
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

        $conversationHistory = array_map(
            static fn (SessionMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $session->getMessages()->toArray(),
        );
        $bilan = $sessionSummaryService->summarize(
            $conversationHistory,
            $user->getLevel()->getCode(),
            $userTurns,
            $session->getScenario()->getTitle(),
        );

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

        $newLevel = $gamificationService->checkAndApplyLevelUp($user);
        $newBadges = $gamificationService->checkAndAwardBadges($user);
        $newTrophies = $gamificationService->checkAndAwardTrophies($user);

        return new JsonResponse([
            'score' => $score,
            'xpEarned' => $xpEarned,
            'userTotalXp' => $user->getTotalXp(),
            'userSessionsCount' => $user->getSessionsCount(),
            'levelUp' => null !== $newLevel ? ['code' => $newLevel->getCode(), 'name' => $newLevel->getName()] : null,
            'newBadges' => array_map(static fn ($b) => ['code' => $b->getCode(), 'name' => $b->getName(), 'icon' => $b->getIcon()], $newBadges),
            'newTrophies' => array_map(static fn ($t) => ['code' => $t->getCode(), 'name' => $t->getName(), 'rarity' => $t->getRarity()->value], $newTrophies),
            'summary' => [
                'summary' => $bilan['summary'],
                'exchangeCount' => $userTurns,
                'xpEarned' => $xpEarned,
                'status' => $session->getStatus()->value,
                'scenarioTitle' => $session->getScenario()->getTitle(),
                'strengths' => $bilan['strengths'],
                'reviewPoints' => $bilan['reviewPoints'],
                'usefulExpressions' => $bilan['usefulExpressions'],
                'nextStep' => $bilan['nextStep'],
            ],
        ]);
    }

    private function serializeSession(Session $session, CecrlProfileService $cecrlProfileService): array
    {
        return [
            'id' => $session->getId(),
            'status' => $session->getStatus()->value,
            'scenario' => [
                'id' => $session->getScenario()->getId(),
                'title' => $session->getScenario()->getTitle(),
                'characterName' => $session->getScenario()->getCharacterName(),
            ],
            'cecrlProfile' => $cecrlProfileService->publicPayload($session->getUser()->getLevel()->getCode()),
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
