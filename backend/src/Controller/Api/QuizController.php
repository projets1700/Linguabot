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
    // The 6 existing modules (QuizFixtures) are basic vocabulary - meant as
    // "Test de vocabulaire" practice for absolute beginners (A0) and for A1
    // learners who just unlocked past it and can still benefit from
    // revisiting it, not a level-agnostic bank open to every level.
    private const ALLOWED_LEVELS = ['A0', 'A1'];

    private static function isLevelAllowed(User $user): bool
    {
        return \in_array($user->getLevel()->getCode(), self::ALLOWED_LEVELS, true);
    }

    #[Route('/api/quiz/modules', name: 'api_quiz_modules', methods: ['GET'])]
    public function modules(
        #[CurrentUser] User $user,
        QuizModuleRepository $moduleRepository,
        QuizAttemptRepository $attemptRepository,
    ): JsonResponse {
        // The rules below (7/10 to pass, 4 of 6 to unlock, which level that
        // unlocks) are read from QuizService's own constants, never
        // duplicated here - so the frontend can show real numbers instead of
        // hardcoding them, without this response ever drifting from what
        // submitAttempt() actually enforces.
        $rules = [
            'passThreshold' => QuizService::passThreshold(),
            'requiredForLevelUp' => QuizService::modulesRequiredForLevelUp(),
            'targetLevelCode' => QuizService::targetLevelCode(),
        ];

        if (!self::isLevelAllowed($user)) {
            return new JsonResponse([...$rules, 'modules' => []]);
        }

        $modules = $moduleRepository->findBy(['isActive' => true], ['orderNum' => 'ASC']);
        $passedModuleIds = $attemptRepository->findPassedModuleIds($user);
        $bestScores = $attemptRepository->findBestScoresByModule($user);

        return new JsonResponse([
            ...$rules,
            'modules' => array_map(
                fn (QuizModule $module) => [
                    'id' => $module->getId(),
                    'code' => $module->getCode(),
                    'title' => $module->getTitle(),
                    'questionCount' => $module->getQuestionCount(),
                    'passed' => \in_array($module->getId(), $passedModuleIds, true),
                    'attempted' => isset($bestScores[$module->getId()]),
                    'bestScore' => $bestScores[$module->getId()] ?? null,
                ],
                $modules,
            ),
        ]);
    }

    #[Route('/api/quiz/modules/{id}/questions', name: 'api_quiz_module_questions', methods: ['GET'])]
    public function questions(QuizModule $module, #[CurrentUser] User $user, QuizQuestionRepository $questionRepository): JsonResponse
    {
        // Same restriction as modules()/attempts() - without it, a learner
        // outside ALLOWED_LEVELS could still list and answer questions by
        // guessing a module id, even though the module list itself already
        // hides them.
        if (!self::isLevelAllowed($user)) {
            return new JsonResponse(['message' => 'Ce test de vocabulaire est réservé aux niveaux A0 et A1.'], 403);
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
        if (!self::isLevelAllowed($user)) {
            return new JsonResponse(['message' => 'Ce test de vocabulaire est réservé aux niveaux A0 et A1.'], 403);
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
        if (!self::isLevelAllowed($user)) {
            return new JsonResponse(['message' => 'Ce test de vocabulaire est réservé aux niveaux A0 et A1.'], 403);
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
