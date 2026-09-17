<?php

namespace App\Controller\Api;

use App\Entity\Mission;
use App\Entity\MissionMessage;
use App\Entity\MissionSession;
use App\Entity\User;
use App\Enum\MessageRole;
use App\Enum\SessionStatus;
use App\Service\AiInputLimits;
use App\Service\CecrlProfileService;
use App\Service\GamificationService;
use App\Service\LearningAidRequestHandler;
use App\Service\RewardPayloadFactory;
use App\Service\SessionSummaryService;
use App\Service\VoiceService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * A Mission's conversation flow - deliberately mirrors the v1.1 catalog's
 * old SessionController shape action-for-action (same guards, same
 * turn/history handling, same shared services) rather than introducing a
 * parallel "MissionService" layer, keeping the V2 pilot consistent with how
 * the rest of the API is built.
 */
final class MissionController
{
    use EnforcesAiRateLimit;

    #[Route('/api/missions/{id}/sessions', name: 'api_mission_start_session', methods: ['POST'])]
    public function start(
        Mission $mission,
        #[CurrentUser] User $user,
        VoiceService $voiceService,
        CecrlProfileService $cecrlProfileService,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($mission->getLevel()->getOrderNum() > $user->getLevel()->getOrderNum()) {
            return new JsonResponse([
                'message' => \sprintf(
                    "Cette mission est verrouillée : atteins le niveau %s pour y accéder.",
                    $mission->getLevel()->getCode(),
                ),
            ], 403);
        }

        $missionSession = (new MissionSession())
            ->setUser($user)
            ->setMission($mission);
        $em->persist($missionSession);

        $opening = (new MissionMessage())
            ->setRole(MessageRole::ASSISTANT)
            ->setContent($voiceService->openingMessageForCharacter($mission->getCharacterName()));
        $missionSession->addMessage($opening);
        $em->persist($opening);

        $em->flush();

        return new JsonResponse($this->serializeMissionSession($missionSession, $cecrlProfileService), 201);
    }

    #[Route('/api/mission-sessions/{id}', name: 'api_mission_session_show', methods: ['GET'])]
    public function show(MissionSession $missionSession, #[CurrentUser] User $user, CecrlProfileService $cecrlProfileService): JsonResponse
    {
        if ($missionSession->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        return new JsonResponse($this->serializeMissionSession($missionSession, $cecrlProfileService));
    }

    #[Route('/api/mission-sessions/{id}/message', name: 'api_mission_session_message', methods: ['POST'])]
    public function message(
        MissionSession $missionSession,
        Request $request,
        #[CurrentUser] User $user,
        VoiceService $voiceService,
        CecrlProfileService $cecrlProfileService,
        EntityManagerInterface $em,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        if ($missionSession->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        if (SessionStatus::IN_PROGRESS !== $missionSession->getStatus()) {
            return new JsonResponse(['message' => 'Cette mission est déjà terminée.'], 422);
        }

        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $transcript = $voiceService->transcribeAudio((string) ($data['message'] ?? ''));
        $learnerBlocked = (bool) ($data['learnerBlocked'] ?? false);

        if ('' === $transcript) {
            return new JsonResponse(['message' => 'Message vide.'], 422);
        }

        $tooLong = AiInputLimits::rejectIfTooLong($transcript, AiInputLimits::MAX_MESSAGE_LENGTH);
        if (null !== $tooLong) {
            return $tooLong;
        }

        $lastAssistantMessage = $missionSession->getMessages()->last();

        if (false !== $lastAssistantMessage && $voiceService->isRepeatRequest($transcript)) {
            return new JsonResponse([
                'userTranscript' => $transcript,
                'assistantMessage' => $voiceService->repeatMessage($lastAssistantMessage->getContent()),
            ]);
        }

        if (false !== $lastAssistantMessage && $voiceService->isEchoOfQuestion($transcript, $lastAssistantMessage->getContent())) {
            return new JsonResponse(['message' => "On dirait que tu répètes la question posée - réponds avec tes propres mots."], 422);
        }

        $userMessage = (new MissionMessage())
            ->setRole(MessageRole::USER)
            ->setContent($transcript);
        $missionSession->addMessage($userMessage);
        $em->persist($userMessage);

        $turnNumber = $missionSession->getMessages()->count();
        $conversationHistory = array_map(
            static fn (MissionMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $missionSession->getMessages()->toArray(),
        );
        $levelCode = $user->getLevel()->getCode();
        $levelInstruction = $cecrlProfileService->buildConversationInstruction($levelCode, $turnNumber, $learnerBlocked);
        $reply = $voiceService->generateAnswer(
            $missionSession->getMission()->getPromptTemplate(),
            $conversationHistory,
            $turnNumber,
            $levelInstruction,
            $learnerBlocked,
            $levelCode,
        );

        $assistantMessage = (new MissionMessage())
            ->setRole(MessageRole::ASSISTANT)
            ->setContent($reply);
        $missionSession->addMessage($assistantMessage);
        $em->persist($assistantMessage);

        $em->flush();

        return new JsonResponse([
            'userTranscript' => $transcript,
            'assistantMessage' => $reply,
        ]);
    }

    #[Route('/api/mission-sessions/{id}/hint', name: 'api_mission_session_hint', methods: ['POST'])]
    public function hint(
        MissionSession $missionSession,
        Request $request,
        #[CurrentUser] User $user,
        LearningAidRequestHandler $learningAidRequestHandler,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        if ($missionSession->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $tier = (int) ($data['tier'] ?? 1);
        $conversationHistory = array_map(
            static fn (MissionMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $missionSession->getMessages()->toArray(),
        );

        $result = $learningAidRequestHandler->hint($conversationHistory, $tier, $user->getLevel()->getCode());

        return $result instanceof JsonResponse ? $result : new JsonResponse($result);
    }

    #[Route('/api/mission-sessions/{id}/translate', name: 'api_mission_session_translate', methods: ['POST'])]
    public function translate(
        MissionSession $missionSession,
        Request $request,
        #[CurrentUser] User $user,
        LearningAidRequestHandler $learningAidRequestHandler,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        if ($missionSession->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $result = $learningAidRequestHandler->translate((string) ($data['text'] ?? ''));

        return $result instanceof JsonResponse ? $result : new JsonResponse($result);
    }

    #[Route('/api/mission-sessions/{id}/finish', name: 'api_mission_session_finish', methods: ['POST'])]
    public function finish(
        MissionSession $missionSession,
        #[CurrentUser] User $user,
        GamificationService $gamificationService,
        SessionSummaryService $sessionSummaryService,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($missionSession->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        if (SessionStatus::IN_PROGRESS !== $missionSession->getStatus()) {
            return new JsonResponse(['message' => 'Cette mission est déjà terminée.'], 422);
        }

        // Same simulated scoring as SessionController::finish() - used only
        // to compute XP here, never persisted (MissionSession has no score
        // column, unlike Session, since nothing in the V2 pilot displays it).
        $userTurns = $missionSession->getMessages()->filter(
            static fn (MissionMessage $m) => MessageRole::USER === $m->getRole(),
        )->count();
        $score = min(100, 40 + $userTurns * 15);

        $xpEarned = $gamificationService->calculateXp($missionSession->getMission()->getBaseXp(), $score);

        $conversationHistory = array_map(
            static fn (MissionMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $missionSession->getMessages()->toArray(),
        );
        $bilan = $sessionSummaryService->summarize(
            $conversationHistory,
            $user->getLevel()->getCode(),
            $userTurns,
            $missionSession->getMission()->getTitle(),
        );

        $missionSession
            ->setXpEarned($xpEarned)
            ->setStatus(SessionStatus::COMPLETED)
            ->setEndedAt(new \DateTimeImmutable())
            ->setSummaryData($bilan);

        $user->setTotalXp($user->getTotalXp() + $xpEarned);
        // Generalizes the v1.1 catalog's own counter (previously only
        // incremented by the retired SessionController) - it backs the
        // 'sessions_count'/'sessions_same_day'/'total_sessions' badge and
        // trophy conditions, whose CDCF wording was never scenario-specific.
        $user->setSessionsCount($user->getSessionsCount() + 1);

        $em->flush();

        $newLevel = $gamificationService->checkAndApplyLevelUp($user);
        $newBadges = $gamificationService->checkAndAwardBadges($user);
        $newTrophies = $gamificationService->checkAndAwardTrophies($user);

        return new JsonResponse([
            'xpEarned' => $xpEarned,
            'userTotalXp' => $user->getTotalXp(),
            'levelUp' => RewardPayloadFactory::levelUp($newLevel),
            'newBadges' => RewardPayloadFactory::badges($newBadges),
            'newTrophies' => RewardPayloadFactory::trophies($newTrophies),
            'summary' => [
                'summary' => $bilan['summary'],
                'exchangeCount' => $userTurns,
                'xpEarned' => $xpEarned,
                'status' => $missionSession->getStatus()->value,
                'missionTitle' => $missionSession->getMission()->getTitle(),
                'strengths' => $bilan['strengths'],
                'reviewPoints' => $bilan['reviewPoints'],
                'usefulExpressions' => $bilan['usefulExpressions'],
                'nextStep' => $bilan['nextStep'],
            ],
        ]);
    }

    private function serializeMissionSession(MissionSession $missionSession, CecrlProfileService $cecrlProfileService): array
    {
        $summaryData = $missionSession->getSummaryData();
        $userTurns = $missionSession->getMessages()->filter(
            static fn (MissionMessage $m) => MessageRole::USER === $m->getRole(),
        )->count();
        $mission = $missionSession->getMission();

        return [
            'id' => $missionSession->getId(),
            'status' => $missionSession->getStatus()->value,
            'mission' => [
                'id' => $mission->getId(),
                'title' => $mission->getTitle(),
                'objective' => $mission->getObjective(),
                'characterName' => $mission->getCharacterName(),
                'situationTitle' => $mission->getSituation()->getTitle(),
                'roomTitle' => $mission->getSituation()->getRoom()->getTitle(),
                'roomCode' => $mission->getSituation()->getRoom()->getCode(),
                'worldCode' => $mission->getSituation()->getRoom()->getWorld()->getCode(),
                'backgroundImageSrc' => $mission->getSituation()->getRoom()->getBackgroundImageSrc(),
            ],
            'cecrlProfile' => $cecrlProfileService->publicPayload($missionSession->getUser()->getLevel()->getCode()),
            'messages' => array_map(
                static fn (MissionMessage $m) => [
                    'id' => $m->getId(),
                    'role' => $m->getRole()->value,
                    'content' => $m->getContent(),
                ],
                $missionSession->getMessages()->toArray(),
            ),
            'summary' => null !== $summaryData ? [
                'summary' => $summaryData['summary'],
                'exchangeCount' => $userTurns,
                'xpEarned' => $missionSession->getXpEarned(),
                'status' => $missionSession->getStatus()->value,
                'missionTitle' => $mission->getTitle(),
                'strengths' => $summaryData['strengths'],
                'reviewPoints' => $summaryData['reviewPoints'],
                'usefulExpressions' => $summaryData['usefulExpressions'],
                'nextStep' => $summaryData['nextStep'],
            ] : null,
        ];
    }
}
