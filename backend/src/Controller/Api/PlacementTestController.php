<?php

namespace App\Controller\Api;

use App\Entity\PlacementTest;
use App\Entity\PlacementTestMessage;
use App\Entity\User;
use App\Enum\MessageRole;
use App\Enum\SessionStatus;
use App\Repository\LevelRepository;
use App\Repository\PlacementTestRepository;
use App\Service\PlacementTestService;
use App\Service\VoiceService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class PlacementTestController
{
    use EnforcesAiRateLimit;

    /**
     * Creates the (single, per-user) placement test on first call, or
     * resumes the existing in_progress one - a page reload or a re-login
     * mid-test must not lose the conversation or start a second row.
     */
    #[Route('/api/placement-test/start', name: 'api_placement_test_start', methods: ['POST'])]
    public function start(
        #[CurrentUser] User $user,
        PlacementTestRepository $placementTestRepository,
        PlacementTestService $placementTestService,
        EntityManagerInterface $em,
    ): JsonResponse {
        $existing = $placementTestRepository->findOneByUser($user);

        if (null !== $existing) {
            if (SessionStatus::COMPLETED === $existing->getStatus()) {
                return new JsonResponse(['message' => 'Le test de niveau a déjà été passé.'], 422);
            }

            return new JsonResponse($this->serialize($existing, $placementTestService), 200);
        }

        $test = (new PlacementTest())->setUser($user);
        $em->persist($test);

        $opening = (new PlacementTestMessage())
            ->setRole(MessageRole::ASSISTANT)
            ->setContent($placementTestService->openingMessage());
        $test->addMessage($opening);
        $em->persist($opening);

        $em->flush();

        return new JsonResponse($this->serialize($test, $placementTestService), 201);
    }

    #[Route('/api/placement-test/{id}', name: 'api_placement_test_show', methods: ['GET'])]
    public function show(
        PlacementTest $placementTest,
        #[CurrentUser] User $user,
        PlacementTestService $placementTestService,
    ): JsonResponse {
        if ($placementTest->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        return new JsonResponse($this->serialize($placementTest, $placementTestService));
    }

    #[Route('/api/placement-test/{id}/message', name: 'api_placement_test_message', methods: ['POST'])]
    public function message(
        PlacementTest $placementTest,
        Request $request,
        #[CurrentUser] User $user,
        VoiceService $voiceService,
        PlacementTestService $placementTestService,
        EntityManagerInterface $em,
    ): JsonResponse {
        if ($placementTest->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        if (SessionStatus::IN_PROGRESS !== $placementTest->getStatus()) {
            return new JsonResponse(['message' => 'Ce test est déjà terminé.'], 422);
        }

        $answeredCount = $placementTest->countUserAnswers();
        if ($answeredCount >= $placementTestService->totalQuestions()) {
            return new JsonResponse(['message' => 'Toutes les questions ont déjà été répondues.'], 422);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $transcript = $voiceService->transcribeAudio((string) ($data['message'] ?? ''));
        // Set by the frontend's detectLearnerBlock() - unlike Session/Daily
        // Challenge/Quiz, this never changes which question comes next or
        // how the transcript is scored (see
        // PlacementTestService::prefixWithBlockedAcknowledgment): the
        // placement test is a graded evaluation, and revealing or hinting an
        // answer here would let the learner inflate their measured level.
        $learnerBlocked = (bool) ($data['learnerBlocked'] ?? false);

        if ('' === $transcript) {
            return new JsonResponse(['message' => 'Message vide.'], 422);
        }

        $lastAssistantMessage = $placementTest->getMessages()->last();

        // "Can you repeat that?" is not an answer: re-say the same question
        // without persisting anything, so it doesn't count against the 5
        // questions or change what the next real answer gets compared to.
        if (false !== $lastAssistantMessage && $voiceService->isRepeatRequest($transcript)) {
            return new JsonResponse([
                'userTranscript' => $transcript,
                'assistantMessage' => $voiceService->repeatMessage($lastAssistantMessage->getContent()),
                'answeredCount' => $answeredCount,
                'totalQuestions' => $placementTestService->totalQuestions(),
                'readyToFinish' => false,
            ]);
        }

        if (false !== $lastAssistantMessage && $voiceService->isEchoOfQuestion($transcript, $lastAssistantMessage->getContent())) {
            return new JsonResponse(['message' => "On dirait que tu répètes la question posée - réponds avec tes propres mots."], 422);
        }

        $userMessage = (new PlacementTestMessage())
            ->setRole(MessageRole::USER)
            ->setContent($transcript);
        $placementTest->addMessage($userMessage);
        $em->persist($userMessage);

        $answeredCount++;
        $nextQuestion = $placementTestService->nextQuestion($answeredCount);
        $reply = $nextQuestion ?? $placementTestService->closingMessage();
        $reply = $placementTestService->prefixWithBlockedAcknowledgment($reply, $learnerBlocked);

        $assistantMessage = (new PlacementTestMessage())
            ->setRole(MessageRole::ASSISTANT)
            ->setContent($reply);
        $placementTest->addMessage($assistantMessage);
        $em->persist($assistantMessage);

        $em->flush();

        return new JsonResponse([
            'userTranscript' => $transcript,
            'assistantMessage' => $reply,
            'answeredCount' => $answeredCount,
            'totalQuestions' => $placementTestService->totalQuestions(),
            'readyToFinish' => null === $nextQuestion,
        ]);
    }

    #[Route('/api/placement-test/{id}/finish', name: 'api_placement_test_finish', methods: ['POST'])]
    public function finish(
        PlacementTest $placementTest,
        #[CurrentUser] User $user,
        PlacementTestService $placementTestService,
        LevelRepository $levelRepository,
        EntityManagerInterface $em,
        #[Autowire(service: 'limiter.ai_calls')] RateLimiterFactory $aiCallsLimiter,
    ): JsonResponse {
        if ($placementTest->getUser()->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Accès refusé.'], 403);
        }

        if (SessionStatus::IN_PROGRESS !== $placementTest->getStatus()) {
            return new JsonResponse(['message' => 'Ce test est déjà terminé.'], 422);
        }

        if ($placementTest->countUserAnswers() < $placementTestService->totalQuestions()) {
            return new JsonResponse(['message' => 'Réponds à toutes les questions avant de terminer.'], 422);
        }

        // The only real AI call in the placement-test flow lives in
        // evaluateLevel() below - message() itself is fully scripted
        // (PlacementTestService::nextQuestion()), so it isn't rate-limited.
        $rejected = $this->rejectIfAiRateLimited($aiCallsLimiter, $user);
        if (null !== $rejected) {
            return $rejected;
        }

        $userAnswers = array_map(
            static fn (PlacementTestMessage $m) => $m->getContent(),
            $placementTest->getMessages()
                ->filter(static fn (PlacementTestMessage $m) => MessageRole::USER === $m->getRole())
                ->toArray(),
        );

        $levelCode = $placementTestService->evaluateLevel($userAnswers);
        $resultLevel = $levelRepository->findOneBy(['code' => $levelCode]);
        if (null === $resultLevel) {
            return new JsonResponse(['message' => \sprintf('Niveau %s introuvable, veuillez charger les fixtures.', $levelCode)], 500);
        }

        $placementTest
            ->setStatus(SessionStatus::COMPLETED)
            ->setResultLevel($resultLevel)
            ->setEndedAt(new \DateTimeImmutable());

        $user->setLevel($resultLevel);

        $em->flush();

        return new JsonResponse([
            'level' => [
                'code' => $resultLevel->getCode(),
                'name' => $resultLevel->getName(),
            ],
        ]);
    }

    private function serialize(PlacementTest $test, PlacementTestService $placementTestService): array
    {
        return [
            'id' => $test->getId(),
            'status' => $test->getStatus()->value,
            'totalQuestions' => $placementTestService->totalQuestions(),
            'answeredCount' => $test->countUserAnswers(),
            'messages' => array_map(
                static fn (PlacementTestMessage $m) => [
                    'id' => $m->getId(),
                    'role' => $m->getRole()->value,
                    'content' => $m->getContent(),
                ],
                $test->getMessages()->toArray(),
            ),
        ];
    }
}
