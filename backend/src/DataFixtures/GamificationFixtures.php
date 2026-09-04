<?php

namespace App\DataFixtures;

use App\Entity\Badge;
use App\Entity\Trophy;
use App\Enum\TrophyRarity;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * The 12 badges and 6 trophies of the CDCF (§3.6). "Champion du défi" is
 * defined here (it belongs in the catalogue) but its condition_type
 * ('daily_challenge_streak') is not evaluated yet by GamificationService -
 * that depends on the daily-challenge chapter, not built yet.
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
        ['BADGE_PERFECT', 'Sans faute', 'Obtenir 100% sur un scénario', '🍯', 'score_perfect', 100, 100],
        ['BADGE_ON_FIRE', 'En feu', 'Compléter 3 sessions dans la même journée', '🔥', 'sessions_same_day', 3, 80],
        ['BADGE_POLYGLOT', 'Polyglotte en herbe', 'Essayer 5 scénarios différents', '🥑', 'distinct_scenarios', 5, 60],
        ['BADGE_TRAVELER', 'Voyageur', "Compléter les 2 scénarios voyage (TA1-1 + TA2-1)", '🗺️', 'travel_scenarios', 2, 80],
        ['BADGE_SERIOUS_CANDIDATE', 'Candidat sérieux', "Réussir l'entretien d'embauche (TB1-2) avec score > 80 %", '👔', 'interview_success', 80, 100],
        ['BADGE_DAILY_MASTER', 'Maître du quotidien', "Compléter tous les scénarios du quotidien d'un niveau", '🏆', 'any_level_quotidien_complete', 5, 150],
        ['BADGE_THEMATIC_EXPERT', 'Expert thématique', "Compléter tous les scénarios thématiques d'un niveau", '🎯', 'any_level_thematique_complete', 5, 150],
        ['BADGE_LEVEL_UP', 'Passage de niveau', 'Atteindre chaque nouveau niveau CECRL', '🚀', 'level_up', 1, 200],
        ['BADGE_CHALLENGE_CHAMPION', 'Champion du défi', 'Compléter 7 défis du jour consécutifs', '🥇', 'daily_challenge_streak', 7, 250],
    ];

    /**
     * [code, name, description, conditionType, conditionValue, xpReward, rarity].
     */
    private const TROPHIES = [
        ['TROPHY_EXPLORER', 'Trophée Explorateur', 'Compléter tous les scénarios A1 (10/10)', 'level_a1_complete', 10, 500, TrophyRarity::BRONZE],
        ['TROPHY_ADVENTURER', 'Trophée Aventurier', 'Compléter tous les scénarios A2 (10/10)', 'level_a2_complete', 10, 500, TrophyRarity::SILVER],
        ['TROPHY_VOYAGER', 'Trophée Voyageur', 'Compléter tous les scénarios B1 (10/10)', 'level_b1_complete', 10, 750, TrophyRarity::GOLD],
        ['TROPHY_MASTER_B2', 'Trophée Maître B2', 'Compléter tous les scénarios B2 (10/10)', 'level_b2_complete', 10, 1000, TrophyRarity::PLATINUM],
        ['TROPHY_PERFECTIONIST', 'Perfectionniste', 'Obtenir plus de 90 % sur 10 scénarios différents', 'high_score_scenarios', 10, 500, TrophyRarity::PLATINUM],
        ['TROPHY_DEDICATED', 'Assidu', 'Effectuer 30 sessions au total', 'total_sessions', 30, 0, TrophyRarity::GOLD],
    ];

    public function load(ObjectManager $manager): void
    {
        foreach (self::BADGES as [$code, $name, $description, $icon, $conditionType, $conditionValue, $xpBonus]) {
            $badge = (new Badge())
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
            $trophy = (new Trophy())
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
