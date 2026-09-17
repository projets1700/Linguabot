<?php

namespace App\Service;

use App\Entity\Badge;
use App\Entity\Trophy;
use App\Entity\User;
use App\Entity\UserBadge;
use App\Entity\UserTrophy;
use App\Entity\Level;
use App\Repository\BadgeRepository;
use App\Repository\ChallengeSessionRepository;
use App\Repository\LevelRepository;
use App\Repository\MissionSessionRepository;
use App\Repository\QuizAttemptRepository;
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
    public function __construct(
        private readonly BadgeRepository $badgeRepository,
        private readonly UserBadgeRepository $userBadgeRepository,
        private readonly TrophyRepository $trophyRepository,
        private readonly UserTrophyRepository $userTrophyRepository,
        private readonly QuizAttemptRepository $quizAttemptRepository,
        private readonly ChallengeSessionRepository $challengeSessionRepository,
        private readonly LevelRepository $levelRepository,
        private readonly MissionSessionRepository $missionSessionRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * Missions are locked above the learner's current level (see
     * MissionController::start()) until totalXp reaches the next level's
     * threshold - this is what unlocks them. A0 -> A1 is excluded on
     * purpose: that step has its own dedicated gate (RG10, 4 of 6 quiz
     * modules passed - see QuizService::maybeUnlockA1()), not an XP
     * threshold, so a learner can't buy their way past it with daily
     * challenge XP alone.
     *
     * Loops in case totalXp jumped past more than one threshold in a
     * single award (e.g. a big trophy XP bonus on top of a session).
     */
    public function checkAndApplyLevelUp(User $user): ?Level
    {
        $startingLevel = $user->getLevel();
        if ('A0' === $startingLevel->getCode()) {
            return null;
        }

        $current = $startingLevel;
        while (null !== ($next = $this->levelRepository->findNext($current)) && $user->getTotalXp() >= $next->getXpThreshold()) {
            $current = $next;
        }

        if ($current === $startingLevel) {
            return null;
        }

        $user->setLevel($current);
        $this->em->flush();

        return $current;
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
            // sessionsCount now counts any completed Mission session too
            // (MissionController::finish()), not just the retired Scenario
            // catalog - these badges' own wording was always generic
            // ("compléter une session vocale"), never scenario-specific.
            'sessions_count' => $user->getSessionsCount() >= $badge->getConditionValue(),
            'quiz_modules_passed' => $this->quizAttemptRepository->countDistinctPassedModules($user) >= $badge->getConditionValue(),
            'sessions_same_day' => $this->missionSessionRepository->maxCompletedMissionsInOneDay($user) >= $badge->getConditionValue(),
            'level_up' => 'A0' !== $user->getLevel()->getCode(),
            'daily_challenge_streak' => $this->challengeSessionRepository->currentConsecutiveStreak($user) >= $badge->getConditionValue(),
            // V2 pilot (LinguaBot_V2_Conception.md): conditionValue is a
            // plain mission count for 'missions_completed', and the target
            // World's orderNum for 'world_explored' (0 for the pilot "Vie
            // quotidienne" world) - same "just an int" shape as every other
            // conditionType here, no new FK needed on Badge/Trophy.
            'missions_completed' => $this->missionSessionRepository->countCompletedMissions($user) >= $badge->getConditionValue(),
            'world_explored' => $this->missionSessionRepository->hasCompletedAnyMissionInWorldWithOrderNum($user, $badge->getConditionValue()),
            default => false,
        };
    }

    /**
     * @return array{0: int, 1: int} [current progress, total required]
     */
    private function trophyProgress(User $user, Trophy $trophy): array
    {
        return match ($trophy->getConditionType()) {
            'total_sessions' => [$user->getSessionsCount(), $trophy->getConditionValue()],
            'missions_completed' => [$this->missionSessionRepository->countCompletedMissions($user), $trophy->getConditionValue()],
            // world_explored is boolean (has the learner completed anything
            // in this World yet?), expressed as a 0/1 progress pair so it
            // fits the same [current, total] shape as every other trophy.
            'world_explored' => [
                $this->missionSessionRepository->hasCompletedAnyMissionInWorldWithOrderNum($user, $trophy->getConditionValue()) ? 1 : 0,
                1,
            ],
            default => [0, max(1, $trophy->getConditionValue())],
        };
    }
}
