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
 * One A1 and one A2 Mission per Monde 1 situation (28 total across the 14
 * situations) - the mechanism that lets the same Situation stay relevant as
 * the learner's level rises (LinguaBot_V2_Conception.md §8's restaurant
 * example: A1 orders simply, A2 asks questions/modifies the order). baseXp
 * mirrors Scenario's own BASE_XP_BY_LEVEL (A1=60, A2=100) for consistency
 * across the two systems.
 */
final class MissionFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    private const BASE_XP_BY_LEVEL = [
        'A1' => 60,
        'A2' => 100,
    ];

    /**
     * [situationReference, codePrefix, characterName, [A1 title, A1 objective], [A2 title, A2 objective]].
     */
    private const MISSIONS = [
        [
            SituationFixtures::SITUATION_RAINY_DAY_REFERENCE, 'W1-R1-S1', 'Friend',
            ['Proposer une activité simple', 'Suggest an alternative indoor activity to a friend.'],
            ['Organiser un après-midi', 'Suggest and negotiate an indoor activity plan with a friend, agreeing on timing.'],
        ],
        [
            SituationFixtures::SITUATION_DINNER_REFERENCE, 'W1-R1-S2', 'Roommate',
            ['Décider quoi cuisiner', 'Decide with your roommate what to cook for dinner tonight.'],
            ['Répartir les tâches', 'Discuss and split the cooking and shopping tasks with your roommate for dinner.'],
        ],
        [
            SituationFixtures::SITUATION_RECIPE_REFERENCE, 'W1-R2-S1', 'Family Member',
            ['Demander de l\'aide pour cuisiner', 'Ask a family member for help following a simple recipe, step by step.'],
            ['Donner des instructions de cuisine', 'Give and follow cooking instructions with a family member, clarifying steps you are unsure about.'],
        ],
        [
            SituationFixtures::SITUATION_MISSING_INGREDIENT_REFERENCE, 'W1-R2-S2', 'Family Member',
            ['Signaler un ingrédient manquant', 'Tell a family member an ingredient is missing and ask what to do.'],
            ['Trouver une solution ensemble', 'Discuss which ingredient is missing, suggest a substitute, and agree on a solution together.'],
        ],
        [
            SituationFixtures::SITUATION_PACK_SUITCASE_REFERENCE, 'W1-R3-S1', 'Family Member',
            ['Décider quoi emporter', 'Decide with a family member what to pack for a short trip.'],
            ['Planifier sa valise', 'Discuss what to pack for a trip considering the weather and planned activities, and check nothing is forgotten.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_OUTFIT_REFERENCE, 'W1-R3-S2', 'Family Member',
            ['Demander un conseil simple', 'Ask a family member for advice on what to wear today.'],
            ['Justifier son choix', 'Discuss outfit options for a specific occasion and explain your choice.'],
        ],
        [
            SituationFixtures::SITUATION_GROCERY_SHOPPING_REFERENCE, 'W1-R4-S1', 'Supermarket Employee',
            ['Trouver un article', 'Ask a supermarket employee where to find an item on your shopping list.'],
            ['Comparer des produits', 'Ask a supermarket employee for help finding several items and compare two similar products.'],
        ],
        [
            SituationFixtures::SITUATION_CHECKOUT_PROBLEM_REFERENCE, 'W1-R4-S2', 'Cashier',
            ['Signaler un prix manquant', 'Tell the cashier that an item has no price tag and ask for help.'],
            ['Résoudre une erreur de prix', 'Explain a pricing mistake at checkout to the cashier and ask them to resolve it.'],
        ],
        [
            SituationFixtures::SITUATION_BUY_BREAKFAST_REFERENCE, 'W1-R5-S1', 'Baker',
            ['Commander le petit-déjeuner', 'Order bread and pastries for breakfast at the bakery.'],
            ['Demander des précisions', 'Order breakfast items at the bakery and ask about ingredients or allergens.'],
        ],
        [
            SituationFixtures::SITUATION_SPECIAL_ORDER_REFERENCE, 'W1-R5-S2', 'Baker',
            ['Demander un pain particulier', 'Ask the baker if they have a specific type of bread available today.'],
            ['Commander un gâteau', 'Order a custom cake for a birthday, explaining what you want and when you need it.'],
        ],
        [
            SituationFixtures::SITUATION_BUY_CLOTHES_REFERENCE, 'W1-R6-S1', 'Shop Assistant',
            ['Demander sa taille', 'Ask a shop assistant for your size in a piece of clothing.'],
            ['Choisir une tenue', 'Ask a shop assistant to help you choose an outfit for a specific occasion.'],
        ],
        [
            SituationFixtures::SITUATION_FITTING_ROOM_REFERENCE, 'W1-R6-S2', 'Shop Assistant',
            ['Essayer un vêtement', 'Ask to try on a piece of clothing and say whether it fits.'],
            ['Gérer un retour', "Explain that an item doesn't fit and ask about exchanging or returning it."],
        ],
        [
            SituationFixtures::SITUATION_DESCRIBE_HAIRCUT_REFERENCE, 'W1-R7-S1', 'Hairdresser',
            ['Décrire une coupe simple', 'Tell the hairdresser what type of haircut you want.'],
            ['Détailler ses attentes', 'Describe the haircut or style you want in detail and discuss options with the hairdresser.'],
        ],
        [
            SituationFixtures::SITUATION_BOOK_APPOINTMENT_REFERENCE, 'W1-R7-S2', 'Hairdresser',
            ['Prendre un rendez-vous', 'Book a hair appointment for a specific day and time.'],
            ['Déplacer un rendez-vous', 'Reschedule an existing hair appointment and explain why.'],
        ],
    ];

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        foreach (self::MISSIONS as [$situationReference, $codePrefix, $characterName, $a1, $a2]) {
            /** @var Situation $situation */
            $situation = $this->getReference($situationReference, Situation::class);

            $this->createMission($manager, $situation, $codePrefix, 'A1', $characterName, $a1[0], $a1[1], 0);
            $this->createMission($manager, $situation, $codePrefix, 'A2', $characterName, $a2[0], $a2[1], 1);
        }

        $manager->flush();
    }

    private function createMission(
        ObjectManager $manager,
        Situation $situation,
        string $codePrefix,
        string $levelCode,
        string $characterName,
        string $title,
        string $objective,
        int $orderNum,
    ): void {
        /** @var Level $level */
        $level = $this->getReference(LevelFixtures::reference($levelCode), Level::class);

        $mission = (new Mission())
            ->setSituation($situation)
            ->setLevel($level)
            ->setCode("{$codePrefix}-{$levelCode}")
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
            ->setOrderNum($orderNum);

        $manager->persist($mission);
    }

    public function getDependencies(): array
    {
        return [SituationFixtures::class, LevelFixtures::class];
    }
}
