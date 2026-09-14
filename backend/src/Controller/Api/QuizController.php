<?php

namespace App\Controller\Api;

use App\Entity\QuizModule;
use App\Entity\QuizQuestion;
use App\Entity\User;
use App\Repository\QuizAttemptRepository;
use App\Repository\QuizModuleRepository;
use App\Repository\QuizQuestionRepository;
use App\Service\GamificationService;
use App\Service\QuizService;
use App\Service\RewardPayloadFactory;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class QuizController
{
    #[Route('/api/quiz/modules', name: 'api_quiz_modules', methods: ['GET'])]
    public function modules(
        #[CurrentUser] User $user,
        QuizModuleRepository $moduleRepository,
        QuizAttemptRepository $attemptRepository,
    ): JsonResponse {
        // The 6 existing modules (QuizFixtures) are all A0 vocabulary - this
        // is "the A0 quiz", not a level-agnostic bank, so it's only ever
        // shown to A0 learners rather than following Scenario's "show
        // locked, above your level" preview convention (which points the
        // other way: content ABOVE the learner's level, not already-passed
        // beginner content below it).
        if ('A0' !== $user->getLevel()->getCode()) {
            return new JsonResponse([]);
        }

        $modules = $moduleRepository->findBy(['isActive' => true], ['orderNum' => 'ASC']);
        $passedModuleIds = $attemptRepository->findPassedModuleIds($user);

        return new JsonResponse(array_map(
            fn (QuizModule $module) => [
                'id' => $module->getId(),
                'code' => $module->getCode(),
                'title' => $module->getTitle(),
                'questionCount' => $module->getQuestionCount(),
                'passed' => \in_array($module->getId(), $passedModuleIds, true),
            ],
            $modules,
        ));
    }

    #[Route('/api/quiz/modules/{id}/questions', name: 'api_quiz_module_questions', methods: ['GET'])]
    public function questions(QuizModule $module, #[CurrentUser] User $user, QuizQuestionRepository $questionRepository): JsonResponse
    {
        // Same restriction as modules()/attempts() - without it, a non-A0
        // learner could still list and answer A0 questions by guessing a
        // module id, even though the module list itself already hides them.
        if ('A0' !== $user->getLevel()->getCode()) {
            return new JsonResponse(['message' => 'Ce quiz est réservé aux apprenants de niveau A0.'], 403);
        }

        $questions = $questionRepository->findBy(['module' => $module], ['orderNum' => 'ASC']);

        return new JsonResponse(array_map(
            // correctAnswer is intentionally omitted: scoring happens server-side.
            fn (QuizQuestion $question) => [
                'id' => $question->getId(),
                'questionText' => $question->getQuestionText(),
            ],
            $questions,
        ));
    }

    /**
     * On-demand reveal of a single question's answer - only meant to be
     * called by the frontend when the learner explicitly said "I don't
     * know" (detectLearnerBlock), so the avatar can say "You can say: X."
     * instead of leaving them stuck. Deliberately a separate endpoint from
     * questions() above, which must keep never exposing correctAnswer in
     * bulk (see testQuestionsListNeverExposesTheCorrectAnswer) - this one
     * exists specifically to be revealed, one question at a time, on
     * request, the same on-demand spirit as /hint and /translate elsewhere.
     */
    #[Route('/api/quiz/questions/{id}/answer', name: 'api_quiz_question_answer', methods: ['GET'])]
    public function answer(QuizQuestion $question, #[CurrentUser] User $user, QuizService $quizService): JsonResponse
    {
        if ('A0' !== $user->getLevel()->getCode()) {
            return new JsonResponse(['message' => 'Ce quiz est réservé aux apprenants de niveau A0.'], 403);
        }

        // Recorded server-side so attempts() can zero this question's point
        // itself - see QuizService::recordAnswerRevealed()/submitAttempt().
        $quizService->recordAnswerRevealed($user->getId(), $question->getId());

        return new JsonResponse(['answer' => $question->getCorrectAnswer()]);
    }

    #[Route('/api/quiz/attempts', name: 'api_quiz_attempts', methods: ['POST'])]
    public function attempts(
        Request $request,
        #[CurrentUser] User $user,
        QuizModuleRepository $moduleRepository,
        QuizService $quizService,
        GamificationService $gamificationService,
    ): JsonResponse {
        // Same restriction as modules() above, enforced again here since
        // this is the consequential action (scoring/XP) - the listing
        // filter alone wouldn't stop a direct POST with a guessed moduleId.
        if ('A0' !== $user->getLevel()->getCode()) {
            return new JsonResponse(['message' => 'Ce quiz est réservé aux apprenants de niveau A0.'], 403);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $module = $moduleRepository->find($data['moduleId'] ?? 0);

        if (null === $module) {
            return new JsonResponse(['message' => 'Module introuvable.'], 404);
        }

        /** @var array<int, string> $answers */
        $answers = [];
        foreach ((array) ($data['answers'] ?? []) as $questionId => $answer) {
            $answers[(int) $questionId] = (string) $answer;
        }

        // Which questions were helped (answer revealed via GET
        // /quiz/questions/{id}/answer) is tracked server-side now -
        // QuizService::submitAttempt() reads it itself, so a client can no
        // longer game its score by simply omitting a question id here.
        $result = $quizService->submitAttempt($user, $module, $answers);

        $newBadges = $gamificationService->checkAndAwardBadges($user);
        $newTrophies = $gamificationService->checkAndAwardTrophies($user);

        return new JsonResponse([
            ...$result,
            'userLevel' => $user->getLevel()->getCode(),
            'userTotalXp' => $user->getTotalXp(),
            'newBadges' => RewardPayloadFactory::badges($newBadges),
            'newTrophies' => RewardPayloadFactory::trophies($newTrophies),
        ], 201);
    }
}
