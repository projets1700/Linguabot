<?php

namespace App\Service;

use App\Entity\Badge;
use App\Entity\Trophy;
use App\Entity\User;
use App\Entity\UserBadge;
use App\Entity\UserTrophy;
use App\Repository\BadgeRepository;
use App\Repository\ChallengeSessionRepository;
use App\Repository\QuizAttemptRepository;
use App\Repository\ScenarioRepository;
use App\Repository\SessionRepository;
use App\Repository\TrophyRepository;
use App\Repository\UserBadgeRepository;
use App\Repository\UserTrophyRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * XP calculation (CDCF §3.6) plus badges/trophies evaluation (TP chapitre
 * 14, CDCF §3.6).
 */
final class GamificationService
{
    private const LEVELS = ['A1', 'A2', 'B1', 'B2'];

    public function __construct(
        private readonly BadgeRepository $badgeRepository,
        private readonly UserBadgeRepository $userBadgeRepository,
        private readonly TrophyRepository $trophyRepository,
        private readonly UserTrophyRepository $userTrophyRepository,
        private readonly SessionRepository $sessionRepository,
        private readonly ScenarioRepository $scenarioRepository,
        private readonly QuizAttemptRepository $quizAttemptRepository,
        private readonly ChallengeSessionRepository $challengeSessionRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function calculateXp(int $baseXp, float $score): int
    {
        $multiplier = match (true) {
            $score < 50 => 0.5,
            $score < 75 => 1.0,
            $score < 90 => 1.5,
            default => 2.0,
        };

        return (int) round($baseXp * $multiplier);
    }

    /**
     * @return Badge[] newly awarded badges
     */
    public function checkAndAwardBadges(User $user): array
    {
        $earnedCodes = $this->userBadgeRepository->findEarnedBadgeCodes($user);
        $newlyAwarded = [];

        foreach ($this->badgeRepository->findBy(['isActive' => true]) as $badge) {
            if (\in_array($badge->getCode(), $earnedCodes, true)) {
                continue;
            }

            if (!$this->badgeConditionMet($user, $badge)) {
                continue;
            }

            $userBadge = (new UserBadge())->setUser($user)->setBadge($badge);
            $this->em->persist($userBadge);
            $user->setTotalXp($user->getTotalXp() + $badge->getXpBonus());
            $newlyAwarded[] = $badge;
        }

        if ([] !== $newlyAwarded) {
            $this->em->flush();
        }

        return $newlyAwarded;
    }

    /**
     * @return Trophy[] trophies newly fully earned in this call (trophies
     *                   whose progress merely advanced are not included)
     */
    public function checkAndAwardTrophies(User $user): array
    {
        $newlyEarned = [];

        foreach ($this->trophyRepository->findAll() as $trophy) {
            $userTrophy = $this->userTrophyRepository->findOneForUserAndTrophy($user, $trophy);

            if (null !== $userTrophy && null !== $userTrophy->getEarnedAt()) {
                continue; // already fully earned
            }

            [$current, $total] = $this->trophyProgress($user, $trophy);

            if (null === $userTrophy) {
                $userTrophy = (new UserTrophy())->setUser($user)->setTrophy($trophy)->setProgressTotal($total);
                $this->em->persist($userTrophy);
            }

            $userTrophy->setProgressCurrent(min($current, $total));

            if ($current >= $total) {
                $userTrophy->setEarnedAt(new \DateTimeImmutable());
                $user->setTotalXp($user->getTotalXp() + $trophy->getXpReward());
                $newlyEarned[] = $trophy;
            }
        }

        $this->em->flush();

        return $newlyEarned;
    }

    private function badgeConditionMet(User $user, Badge $badge): bool
    {
        return match ($badge->getConditionType()) {
            'sessions_count' => $user->getSessionsCount() >= $badge->getConditionValue(),
            'quiz_modules_passed' => $this->quizAttemptRepository->countDistinctPassedModules($user) >= $badge->getConditionValue(),
            'score_perfect' => $this->sessionRepository->hasPerfectScore($user),
            'sessions_same_day' => $this->sessionRepository->maxCompletedSessionsInOneDay($user) >= $badge->getConditionValue(),
            'distinct_scenarios' => $this->sessionRepository->countDistinctScenarios($user) >= $badge->getConditionValue(),
            'travel_scenarios' => $this->sessionRepository->hasCompletedScenarioCode($user, 'TA1-1')
                && $this->sessionRepository->hasCompletedScenarioCode($user, 'TA2-1'),
            'interview_success' => $this->sessionRepository->hasCompletedScenarioCodeWithScoreAbove(
                $user,
                'TB1-2',
                (float) $badge->getConditionValue(),
            ),
            'any_level_quotidien_complete' => $this->anyLevelCategoryComplete($user, 'quotidien'),
            'any_level_thematique_complete' => $this->anyLevelCategoryComplete($user, 'thematique'),
            'level_up' => 'A0' !== $user->getLevel()->getCode(),
            'daily_challenge_streak' => $this->challengeSessionRepository->currentConsecutiveStreak($user) >= $badge->getConditionValue(),
            default => false,
        };
    }

    private function anyLevelCategoryComplete(User $user, string $category): bool
    {
        foreach (self::LEVELS as $levelCode) {
            $total = $this->scenarioRepository->countByLevel($levelCode, $category);
            $done = $this->sessionRepository->countDistinctCompletedScenariosForLevel($user, $levelCode, $category);

            if ($total > 0 && $done >= $total) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{0: int, 1: int} [current progress, total required]
     */
    private function trophyProgress(User $user, Trophy $trophy): array
    {
        return match ($trophy->getConditionType()) {
            'level_a1_complete' => [$this->sessionRepository->countDistinctCompletedScenariosForLevel($user, 'A1'), $this->scenarioRepository->countByLevel('A1')],
            'level_a2_complete' => [$this->sessionRepository->countDistinctCompletedScenariosForLevel($user, 'A2'), $this->scenarioRepository->countByLevel('A2')],
            'level_b1_complete' => [$this->sessionRepository->countDistinctCompletedScenariosForLevel($user, 'B1'), $this->scenarioRepository->countByLevel('B1')],
            'level_b2_complete' => [$this->sessionRepository->countDistinctCompletedScenariosForLevel($user, 'B2'), $this->scenarioRepository->countByLevel('B2')],
            'high_score_scenarios' => [$this->sessionRepository->countDistinctScenariosWithScoreAbove($user, 90), $trophy->getConditionValue()],
            'total_sessions' => [$user->getSessionsCount(), $trophy->getConditionValue()],
            default => [0, max(1, $trophy->getConditionValue())],
        };
    }
}
