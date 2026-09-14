<?php

namespace App\Controller\Api;

use App\Entity\ChallengeMessage;
use App\Entity\ChallengeSession;
use App\Entity\DailyChallenge;
use App\Entity\User;
use App\Enum\MessageRole;
use App\Repository\ChallengeSessionRepository;
use App\Service\CecrlProfileService;
use App\Service\DailyChallengeService;
use App\Service\GamificationService;
use App\Service\LearningAidService;
use App\Service\VoiceService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class DailyChallengeController
{
    use EnforcesAiRateLimit;

    #[Route('/api/daily-challenge', name: 'api_daily_challenge_show', methods: ['GET'])]
    public function show(
        #[CurrentUser] User $user,
        DailyChallengeService $dailyChallengeService,
        ChallengeSessionRepository $challengeSessionRepository,
        CecrlProfileService $cecrlProfileService,
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
            'cecrlProfile' => $cecrlProfileService->publicPayload($user->getLevel()->getCode()),
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
        $participation = $this->getOrCreateParticipation($user, $challenge, $challengeSessionRepository, $em);

        return new JsonResponse([
            'openingMessage' => $this->ensureOpeningMessage($participation, $challenge, $em),
        ], 201);
    }

    #[Route('/api/daily-challenge/message', name: 'api_daily_challenge_message', methods: ['POST'])]
    public function message(
        Request $request,
        VoiceService $voiceService,
        #[CurrentUser] User $user,
        DailyChallengeService $dailyChallengeService,
        ChallengeSessionRepository $challengeSessionRepository,
        CecrlProfileService $cecrlProfileService,
        EntityManagerInterface $em,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $transcript = $voiceService->transcribeAudio((string) ($data['message'] ?? ''));
        // Set by the frontend's detectLearnerBlock() - see SessionController
        // for the same signal on scenario sessions; the daily challenge is
        // also an open-ended conversation, so it gets the exact same
        // treatment rather than a separate implementation.
        $learnerBlocked = (bool) ($data['learnerBlocked'] ?? false);

        if ('' === $transcript) {
            return new JsonResponse(['message' => 'Message vide.'], 422);
        }

        $challenge = $dailyChallengeService->findOrCreateTodaysChallenge($user->getLevel());
        $participation = $this->getOrCreateParticipation($user, $challenge, $challengeSessionRepository, $em);
        $this->ensureOpeningMessage($participation, $challenge, $em);

        // Rebuilt from what was actually persisted (audit P1-03) - a client
        // can no longer fabricate assistant turns to steer the AI's context
        // the way a client-supplied `history` array used to allow.
        $conversationHistory = array_map(
            static fn (ChallengeMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $participation->getMessages()->toArray(),
        );
        $lastAssistantMessage = null;
        for ($i = \count($conversationHistory) - 1; $i >= 0; --$i) {
            if ('assistant' === $conversationHistory[$i]['role']) {
                $lastAssistantMessage = $conversationHistory[$i]['content'];
                break;
            }
        }

        // "Can you repeat that?" is not an answer: re-say the same line
        // without persisting anything, same as SessionController::message().
        if (null !== $lastAssistantMessage && $voiceService->isRepeatRequest($transcript)) {
            return new JsonResponse([
                'userTranscript' => $transcript,
                'assistantMessage' => $voiceService->repeatMessage($lastAssistantMessage),
            ]);
        }

        if (null !== $lastAssistantMessage && $voiceService->isEchoOfQuestion($transcript, $lastAssistantMessage)) {
            return new JsonResponse(['message' => "On dirait que tu répètes la question posée - réponds avec tes propres mots."], 422);
        }

        $userMessage = (new ChallengeMessage())->setRole(MessageRole::USER)->setContent($transcript);
        $participation->addMessage($userMessage);
        $em->persist($userMessage);

        $turnNumber = $participation->getMessages()->count();
        $conversationHistory = array_map(
            static fn (ChallengeMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $participation->getMessages()->toArray(),
        );

        $systemPrompt = \sprintf(
            "You are %s, a character in an English conversation practice scenario. Context: %s Objective: %s. ".
            'Stay in character, speak only English, adapt your vocabulary and pace to the level, '.
            'and gently correct the learner when needed.',
            $challenge->getCharacterName(),
            $challenge->getContext(),
            $challenge->getObjective(),
        );

        // Same labeled CECRL/correction/support/blocked composition as
        // SessionController - see CecrlProfileService::buildConversationInstruction().
        $levelInstruction = $cecrlProfileService->buildConversationInstruction($user->getLevel()->getCode(), $turnNumber, $learnerBlocked);
        $reply = $voiceService->generateAnswer(
            $systemPrompt,
            $conversationHistory,
            $turnNumber,
            $levelInstruction,
            $learnerBlocked,
            $user->getLevel()->getCode(),
        );

        $assistantMessage = (new ChallengeMessage())->setRole(MessageRole::ASSISTANT)->setContent($reply);
        $participation->addMessage($assistantMessage);
        $em->persist($assistantMessage);
        $em->flush();

        return new JsonResponse([
            'userTranscript' => $transcript,
            'assistantMessage' => $reply,
        ]);
    }

    #[Route('/api/daily-challenge/hint', name: 'api_daily_challenge_hint', methods: ['POST'])]
    public function hint(
        Request $request,
        #[CurrentUser] User $user,
        DailyChallengeService $dailyChallengeService,
        ChallengeSessionRepository $challengeSessionRepository,
        LearningAidService $learningAidService,
        CecrlProfileService $cecrlProfileService,
        EntityManagerInterface $em,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $tier = (int) ($data['tier'] ?? 1);
        if ($tier < 1 || $tier > 3) {
            return new JsonResponse(['message' => 'Palier d\'aide invalide.'], 422);
        }

        $challenge = $dailyChallengeService->findOrCreateTodaysChallenge($user->getLevel());
        $participation = $this->getOrCreateParticipation($user, $challenge, $challengeSessionRepository, $em);
        $this->ensureOpeningMessage($participation, $challenge, $em);

        $conversationHistory = array_map(
            static fn (ChallengeMessage $m) => ['role' => $m->getRole()->value, 'content' => $m->getContent()],
            $participation->getMessages()->toArray(),
        );
        $levelInstruction = $cecrlProfileService->complexityInstruction($user->getLevel()->getCode());

        return new JsonResponse([
            'tier' => $tier,
            'content' => $learningAidService->hint($conversationHistory, $tier, $levelInstruction),
        ]);
    }

    #[Route('/api/daily-challenge/translate', name: 'api_daily_challenge_translate', methods: ['POST'])]
    public function translate(
        Request $request,
        LearningAidService $learningAidService,
        #[CurrentUser] User $user,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $text = trim((string) ($data['text'] ?? ''));
        if ('' === $text) {
            return new JsonResponse(['message' => 'Texte manquant.'], 422);
        }

        return new JsonResponse(['translation' => $learningAidService->translate($text)]);
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

        $newLevel = $gamificationService->checkAndApplyLevelUp($user);
        $newBadges = $gamificationService->checkAndAwardBadges($user);
        $newTrophies = $gamificationService->checkAndAwardTrophies($user);

        return new JsonResponse([
            'xpEarned' => $xpEarned,
            'userTotalXp' => $user->getTotalXp(),
            'levelUp' => null !== $newLevel ? ['code' => $newLevel->getCode(), 'name' => $newLevel->getName()] : null,
            'newBadges' => array_map(static fn ($b) => ['code' => $b->getCode(), 'name' => $b->getName(), 'icon' => $b->getIcon()], $newBadges),
            'newTrophies' => array_map(static fn ($t) => ['code' => $t->getCode(), 'name' => $t->getName(), 'rarity' => $t->getRarity()->value], $newTrophies),
        ]);
    }

    /**
     * The learner's own participation row for today's challenge, created on
     * first touch (start(), or message()/hint() called without an explicit
     * start() first - the endpoint stays as lenient as it was before).
     */
    private function getOrCreateParticipation(
        User $user,
        DailyChallenge $challenge,
        ChallengeSessionRepository $challengeSessionRepository,
        EntityManagerInterface $em,
    ): ChallengeSession {
        $participation = $challengeSessionRepository->findOneForUserAndChallenge($user, $challenge);
        if (null === $participation) {
            $participation = (new ChallengeSession())->setUser($user)->setChallenge($challenge);
            $em->persist($participation);
            $em->flush();
        }

        return $participation;
    }

    /**
     * Persists the character's opening line as this participation's first
     * ChallengeMessage the first time it's touched, and returns it - every
     * later call (a repeat start(), or message()/hint() reusing the same
     * participation) just returns the one already persisted, so the
     * opening line - and the conversation it anchors - never changes mid-challenge.
     */
    private function ensureOpeningMessage(ChallengeSession $participation, DailyChallenge $challenge, EntityManagerInterface $em): string
    {
        $existingOpening = $participation->getMessages()->first();
        if (false !== $existingOpening) {
            return $existingOpening->getContent();
        }

        $opening = \sprintf(
            "Hello! I'm %s. %s Ready? %s",
            $challenge->getCharacterName(),
            $challenge->getContext(),
            $challenge->getObjective(),
        );

        $message = (new ChallengeMessage())->setRole(MessageRole::ASSISTANT)->setContent($opening);
        $participation->addMessage($message);
        $em->persist($message);
        $em->flush();

        return $opening;
    }
}
