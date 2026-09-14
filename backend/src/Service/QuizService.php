<?php

namespace App\Service;

use App\Entity\Level;
use App\Entity\QuizAttempt;
use App\Entity\QuizModule;
use App\Entity\QuizQuestion;
use App\Entity\User;
use App\Repository\LevelRepository;
use App\Repository\QuizAttemptRepository;
use App\Repository\QuizQuestionRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class QuizService
{
    private const PASS_THRESHOLD = 7;
    private const XP_PER_CORRECT_ANSWER = 10;
    private const XP_PER_MODULE_PASSED = 50;
    private const MODULES_REQUIRED_FOR_A1 = 4;

    // Long enough to cover a realistic module attempt (a handful of
    // questions, answered at a learner's own pace), short enough that a
    // forgotten/stale entry doesn't linger indefinitely if an attempt is
    // never actually submitted.
    private const HELP_REVEALED_TTL_SECONDS = 3600;

    public function __construct(
        private readonly QuizQuestionRepository $questionRepository,
        private readonly QuizAttemptRepository $attemptRepository,
        private readonly LevelRepository $levelRepository,
        private readonly EntityManagerInterface $em,
        #[Autowire(service: 'cache.app')]
        private readonly CacheItemPoolInterface $cache,
    ) {
    }

    /**
     * Records that QuizController::answer() revealed this question's
     * correct answer to this learner - read back by submitAttempt() below
     * instead of trusting a client-submitted "helpedQuestionIds" array
     * (which a client could simply omit an id from after calling answer(),
     * scoring a full point for an answer it never actually found unaided).
     */
    public function recordAnswerRevealed(int $userId, int $questionId): void
    {
        $item = $this->cache->getItem($this->helpCacheKey($userId, $questionId));
        $item->set(true);
        $item->expiresAfter(self::HELP_REVEALED_TTL_SECONDS);
        $this->cache->save($item);
    }

    private function helpCacheKey(int $userId, int $questionId): string
    {
        return \sprintf('quiz_help_revealed.%d.%d', $userId, $questionId);
    }

    /**
     * @param array<int, string> $answers questionId => user's typed answer
     *
     * @return array{score: int, passed: bool, xpEarned: int, levelUp: array{code: string, name: string}|null}
     */
    public function submitAttempt(User $user, QuizModule $module, array $answers): array
    {
        $questions = $this->questionRepository->findBy(['module' => $module]);

        $score = 0;
        foreach ($questions as $question) {
            $given = $answers[$question->getId()] ?? '';
            $wasHelped = $this->consumeAnswerRevealed($user->getId(), $question);
            // A correct answer only earns its point if reached unaided - once
            // the correct answer has been revealed (learner said "I don't
            // know"), repeating it back is still allowed and still ends the
            // question, but it must not score the same as finding it alone.
            if (!$wasHelped && $this->normalize($given) === $this->normalize($question->getCorrectAnswer())) {
                ++$score;
            }
        }

        $passed = $score >= self::PASS_THRESHOLD;

        // Don't re-award any XP (per-answer or the module bonus), or
        // re-trigger a level-up check, if the learner retries a module they
        // already passed - otherwise replaying an already-passed module
        // farms unlimited XP, 10 per correct answer every time.
        $alreadyPassed = \in_array($module->getId(), $this->attemptRepository->findPassedModuleIds($user), true);

        $xpEarned = $alreadyPassed ? 0 : $score * self::XP_PER_CORRECT_ANSWER;
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

        $levelUp = $passed && !$alreadyPassed ? $this->maybeUnlockA1($user) : null;

        $this->em->flush();

        return [
            'score' => $score,
            'passed' => $passed,
            'xpEarned' => $xpEarned,
            'levelUp' => null !== $levelUp ? ['code' => $levelUp->getCode(), 'name' => $levelUp->getName()] : null,
        ];
    }

    private function maybeUnlockA1(User $user): ?Level
    {
        if ('A0' !== $user->getLevel()->getCode()) {
            return null;
        }

        // RG10: 4 of the 6 modules must be passed to unlock A1. The just-submitted
        // attempt hasn't been flushed yet, so count it in addition to prior passes.
        $passedCount = $this->attemptRepository->countDistinctPassedModules($user) + 1;
        if ($passedCount < self::MODULES_REQUIRED_FOR_A1) {
            return null;
        }

        $levelA1 = $this->levelRepository->findOneBy(['code' => 'A1']);
        if (null === $levelA1) {
            return null;
        }

        $user->setLevel($levelA1);

        return $levelA1;
    }

    /**
     * True if answer() revealed this question to this learner, and clears
     * the record - a retried module attempt afterward gets a clean slate
     * for that question rather than being permanently zeroed for up to
     * HELP_REVEALED_TTL_SECONDS.
     */
    private function consumeAnswerRevealed(int $userId, QuizQuestion $question): bool
    {
        $item = $this->cache->getItem($this->helpCacheKey($userId, $question->getId()));
        $wasRevealed = $item->isHit();
        if ($wasRevealed) {
            $this->cache->deleteItem($this->helpCacheKey($userId, $question->getId()));
        }

        return $wasRevealed;
    }

    private function normalize(string $value): string
    {
        return strtolower(trim($value));
    }
}
