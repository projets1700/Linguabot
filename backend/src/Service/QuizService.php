<?php

namespace App\Service;

use App\Entity\QuizAttempt;
use App\Entity\QuizModule;
use App\Entity\User;
use App\Repository\LevelRepository;
use App\Repository\QuizAttemptRepository;
use App\Repository\QuizQuestionRepository;
use Doctrine\ORM\EntityManagerInterface;

final class QuizService
{
    private const PASS_THRESHOLD = 7;
    private const XP_PER_CORRECT_ANSWER = 10;
    private const XP_PER_MODULE_PASSED = 50;
    private const MODULES_REQUIRED_FOR_A1 = 4;

    public function __construct(
        private readonly QuizQuestionRepository $questionRepository,
        private readonly QuizAttemptRepository $attemptRepository,
        private readonly LevelRepository $levelRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @param array<int, string> $answers questionId => user's typed answer
     *
     * @return array{score: int, passed: bool, xpEarned: int, levelUp: bool}
     */
    public function submitAttempt(User $user, QuizModule $module, array $answers): array
    {
        $questions = $this->questionRepository->findBy(['module' => $module]);

        $score = 0;
        foreach ($questions as $question) {
            $given = $answers[$question->getId()] ?? '';
            if ($this->normalize($given) === $this->normalize($question->getCorrectAnswer())) {
                ++$score;
            }
        }

        $passed = $score >= self::PASS_THRESHOLD;
        $xpEarned = $score * self::XP_PER_CORRECT_ANSWER;

        // Don't re-award the module bonus (or re-trigger a level-up check) if
        // the learner retries a module they already passed.
        $alreadyPassed = \in_array($module->getId(), $this->attemptRepository->findPassedModuleIds($user), true);

        if ($passed && !$alreadyPassed) {
            $xpEarned += self::XP_PER_MODULE_PASSED;
        }

        $attempt = (new QuizAttempt())
            ->setUser($user)
            ->setModule($module)
            ->setScore($score)
            ->setXpEarned($xpEarned);

        $this->em->persist($attempt);

        $user->setTotalXp($user->getTotalXp() + $xpEarned);

        $levelUp = $passed && !$alreadyPassed && $this->maybeUnlockA1($user);

        $this->em->flush();

        return [
            'score' => $score,
            'passed' => $passed,
            'xpEarned' => $xpEarned,
            'levelUp' => $levelUp,
        ];
    }

    private function maybeUnlockA1(User $user): bool
    {
        if ('A0' !== $user->getLevel()->getCode()) {
            return false;
        }

        // RG10: 4 of the 6 modules must be passed to unlock A1. The just-submitted
        // attempt hasn't been flushed yet, so count it in addition to prior passes.
        $passedCount = $this->attemptRepository->countDistinctPassedModules($user) + 1;
        if ($passedCount < self::MODULES_REQUIRED_FOR_A1) {
            return false;
        }

        $levelA1 = $this->levelRepository->findOneBy(['code' => 'A1']);
        if (null === $levelA1) {
            return false;
        }

        $user->setLevel($levelA1);

        return true;
    }

    private function normalize(string $value): string
    {
        return strtolower(trim($value));
    }
}
