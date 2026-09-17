<?php

namespace App\DataFixtures;

use App\Entity\Badge;
use App\Entity\Trophy;
use App\Enum\TrophyRarity;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * Badges/trophies evaluated by GamificationService. The v1.1 CDCF catalog
 * (§3.6) originally had 12 badges and 6 trophies; 7 badges and 5 trophies
 * whose conditions were tied to the retired Scenario catalog (scenario
 * categories, hardcoded scenario codes, per-level catalog completion
 * ratios, a persisted numeric score - none of which Mission has an
 * equivalent for) were dropped when Scenario/Session were removed in favor
 * of the V2 Adventure hierarchy. The 3 badges whose CDCF wording was
 * already generic ("compléter une session vocale", not "un scénario") were
 * kept and now count Mission sessions too (User::$sessionsCount is
 * incremented by MissionController::finish()).
 *
 * Update-in-place by code rather than blind insert - see WorldFixtures.
 * Matters even more here: badges/trophies are referenced by user_badges/
 * user_trophies, so losing their ids on reload would orphan every
 * learner's already-earned rewards.
 */
final class GamificationFixtures extends Fixture
{
    /**
     * [code, name, description, icon, conditionType, conditionValue, xpBonus].
     */
    private const BADGES = [
        ['BADGE_FIRST_STEP', 'Premier pas', 'Compléter sa première session vocale', '🌟', 'sessions_count', 1, 0],
        ['BADGE_VOCAB_BASICS', 'Vocabulaire de base', 'Valider 4 modules du quiz A0', '🧠', 'quiz_modules_passed', 4, 100],
        ['BADGE_SPEAKER', 'Prise de parole', 'Réaliser 5 sessions vocales', '🎙️', 'sessions_count', 5, 50],
        ['BADGE_ON_FIRE', 'En feu', 'Compléter 3 sessions dans la même journée', '🔥', 'sessions_same_day', 3, 80],
        ['BADGE_LEVEL_UP', 'Passage de niveau', 'Atteindre chaque nouveau niveau CECRL', '🚀', 'level_up', 1, 200],
        ['BADGE_CHALLENGE_CHAMPION', 'Champion du défi', 'Compléter 7 défis du jour consécutifs', '🥇', 'daily_challenge_streak', 7, 250],
        // V2 pilot (LinguaBot_V2_Conception.md) - proves the Mission reward
        // wiring end to end, not a full new reward catalog yet.
        ['BADGE_ADVENTURE_START', 'Première mission', "Compléter ta première mission de l'Aventure", '🗺️', 'missions_completed', 1, 50],
    ];

    /**
     * [code, name, description, conditionType, conditionValue, xpReward, rarity].
     */
    private const TROPHIES = [
        ['TROPHY_DEDICATED', 'Assidu', 'Effectuer 30 sessions au total', 'total_sessions', 30, 0, TrophyRarity::GOLD],
        // V2 pilot: conditionValue is the target World's orderNum (0 = "Vie
        // quotidienne", the only world seeded so far - MissionSessionRepository::hasCompletedAnyMissionInWorldWithOrderNum()).
        ['TROPHY_WORLD_EXPLORER', 'Explorateur du Monde 1', 'Compléter une mission dans le Monde 1 - Vie quotidienne', 'world_explored', 0, 200, TrophyRarity::BRONZE],
    ];

    public function load(ObjectManager $manager): void
    {
        $badgeRepository = $manager->getRepository(Badge::class);
        $trophyRepository = $manager->getRepository(Trophy::class);

        foreach (self::BADGES as [$code, $name, $description, $icon, $conditionType, $conditionValue, $xpBonus]) {
            $badge = $badgeRepository->findOneBy(['code' => $code]) ?? new Badge();
            $badge
                ->setCode($code)
                ->setName($name)
                ->setDescription($description)
                ->setIcon($icon)
                ->setConditionType($conditionType)
                ->setConditionValue($conditionValue)
                ->setXpBonus($xpBonus);

            $manager->persist($badge);
        }

        foreach (self::TROPHIES as [$code, $name, $description, $conditionType, $conditionValue, $xpReward, $rarity]) {
            $trophy = $trophyRepository->findOneBy(['code' => $code]) ?? new Trophy();
            $trophy
                ->setCode($code)
                ->setName($name)
                ->setDescription($description)
                ->setConditionType($conditionType)
                ->setConditionValue($conditionValue)
                ->setXpReward($xpReward)
                ->setRarity($rarity);

            $manager->persist($trophy);
        }

        $manager->flush();
    }
}
