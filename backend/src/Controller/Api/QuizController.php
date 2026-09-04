<?php

namespace App\Controller\Api;

use App\Entity\QuizModule;
use App\Entity\QuizQuestion;
use App\Entity\User;
use App\Repository\QuizAttemptRepository;
use App\Repository\QuizModuleRepository;
use App\Repository\QuizQuestionRepository;
use App\Service\QuizService;
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
    public function questions(QuizModule $module, QuizQuestionRepository $questionRepository): JsonResponse
    {
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

    #[Route('/api/quiz/attempts', name: 'api_quiz_attempts', methods: ['POST'])]
    public function attempts(
        Request $request,
        #[CurrentUser] User $user,
        QuizModuleRepository $moduleRepository,
        QuizService $quizService,
    ): JsonResponse {
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

        $result = $quizService->submitAttempt($user, $module, $answers);

        return new JsonResponse([
            ...$result,
            'userLevel' => $user->getLevel()->getCode(),
            'userTotalXp' => $user->getTotalXp(),
        ], 201);
    }
}
