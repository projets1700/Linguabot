<?php

namespace App\DataFixtures;

use App\Entity\Level;
use App\Entity\Mission;
use App\Entity\Situation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * One A1 and one A2 Mission per pilot Situation (8 total) - the mechanism
 * that lets the same Situation stay relevant as the learner's level rises
 * (LinguaBot_V2_Conception.md §8's restaurant example: A1 orders simply, A2
 * asks questions/modifies the order). baseXp mirrors Scenario's own
 * BASE_XP_BY_LEVEL (A1=60, A2=100) for consistency across the two systems.
 */
final class MissionFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    private const BASE_XP_BY_LEVEL = [
        'A1' => 60,
        'A2' => 100,
    ];

    public static function getGroups(): array
    {
        return ['v2'];
    }

    /**
     * [situationReference, code, title, levelCode, objective, characterName].
     */
    private const MISSIONS = [
        [SituationFixtures::SITUATION_RAINY_DAY_REFERENCE, 'W1-R1-S1-A1', 'Proposer une activité simple', 'A1', 'Suggest an alternative indoor activity to a friend.', 'Friend'],
        [SituationFixtures::SITUATION_RAINY_DAY_REFERENCE, 'W1-R1-S1-A2', 'Organiser un après-midi', 'A2', 'Suggest and negotiate an indoor activity plan with a friend, agreeing on timing.', 'Friend'],

        [SituationFixtures::SITUATION_DINNER_REFERENCE, 'W1-R1-S2-A1', 'Décider quoi cuisiner', 'A1', 'Decide with your roommate what to cook for dinner tonight.', 'Roommate'],
        [SituationFixtures::SITUATION_DINNER_REFERENCE, 'W1-R1-S2-A2', 'Répartir les tâches', 'A2', 'Discuss and split the cooking and shopping tasks with your roommate for dinner.', 'Roommate'],

        [SituationFixtures::SITUATION_ORDER_COFFEE_REFERENCE, 'W1-R2-S1-A1', 'Commander une boisson simple', 'A1', 'Order a drink at the coffee shop.', 'Barista'],
        [SituationFixtures::SITUATION_ORDER_COFFEE_REFERENCE, 'W1-R2-S1-A2', 'Personnaliser sa commande', 'A2', 'Order a drink at the coffee shop and ask for a modification, such as the size or the type of milk.', 'Barista'],

        [SituationFixtures::SITUATION_WRONG_ORDER_REFERENCE, 'W1-R2-S2-A1', 'Signaler une erreur simple', 'A1', 'Politely tell the barista your order is wrong and ask for the right one.', 'Barista'],
        [SituationFixtures::SITUATION_WRONG_ORDER_REFERENCE, 'W1-R2-S2-A2', 'Résoudre le problème', 'A2', 'Explain the mistake in your order, ask for a solution, and confirm the correction.', 'Barista'],
    ];

    public function load(ObjectManager $manager): void
    {
        foreach (self::MISSIONS as [$situationReference, $code, $title, $levelCode, $objective, $characterName]) {
            /** @var Situation $situation */
            $situation = $this->getReference($situationReference, Situation::class);
            /** @var Level $level */
            $level = $this->getReference(LevelFixtures::reference($levelCode), Level::class);

            $mission = (new Mission())
                ->setSituation($situation)
                ->setLevel($level)
                ->setCode($code)
                ->setTitle($title)
                ->setObjective($objective)
                ->setPromptTemplate(\sprintf(
                    "You are %s, a character in an English conversation practice mission titled '%s' (situation: %s). ".
                    "The learner is at CECRL level %s. Mission objective: %s. ".
                    'Stay in character, speak only English, adapt your vocabulary and pace to the level, '.
                    'and gently correct the learner when needed.',
                    $characterName,
                    $title,
                    $situation->getTitle(),
                    $levelCode,
                    $objective,
                ))
                ->setCharacterName($characterName)
                ->setBaseXp(self::BASE_XP_BY_LEVEL[$levelCode])
                ->setOrderNum('A1' === $levelCode ? 0 : 1);

            $manager->persist($mission);
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [SituationFixtures::class, LevelFixtures::class];
    }
}
