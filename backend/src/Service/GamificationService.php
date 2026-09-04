<?php

namespace App\Service;

/**
 * XP calculation (CDCF §3.6, TP chapitre 14.2). Badges and trophies are a
 * separate future milestone - only the score-based XP multiplier lives here
 * for now, since ending a voice session already needs it.
 */
final class GamificationService
{
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
}
