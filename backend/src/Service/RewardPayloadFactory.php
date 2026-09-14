<?php

namespace App\Service;

use App\Entity\Badge;
use App\Entity\Level;
use App\Entity\Trophy;

/**
 * Audit P2-06: SessionController, DailyChallengeController and
 * QuizController each ended their reward-granting endpoint with an
 * identical (character-for-character) pair of array_map closures for
 * newBadges/newTrophies, plus the same levelUp ternary - the exact
 * duplication this centralizes, so a future format change (or the reward
 * shape divergence that already forced the RewardBanner harmonization
 * chantier) only has one place to fix.
 */
final class RewardPayloadFactory
{
    /**
     * @param Badge[] $badges
     *
     * @return array<int, array{code: string, name: string, icon: string}>
     */
    public static function badges(array $badges): array
    {
        return array_map(
            static fn (Badge $b) => ['code' => $b->getCode(), 'name' => $b->getName(), 'icon' => $b->getIcon()],
            $badges,
        );
    }

    /**
     * @param Trophy[] $trophies
     *
     * @return array<int, array{code: string, name: string, rarity: string}>
     */
    public static function trophies(array $trophies): array
    {
        return array_map(
            static fn (Trophy $t) => ['code' => $t->getCode(), 'name' => $t->getName(), 'rarity' => $t->getRarity()->value],
            $trophies,
        );
    }

    /**
     * @return array{code: string, name: string}|null
     */
    public static function levelUp(?Level $newLevel): ?array
    {
        return null !== $newLevel ? ['code' => $newLevel->getCode(), 'name' => $newLevel->getName()] : null;
    }
}
