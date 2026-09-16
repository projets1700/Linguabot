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
 * One A1 and one A2 Mission per situation across Monde 1 (28, over 14
 * situations) and Monde 2 (36, over 18 situations) - the mechanism that lets
 * the same Situation stay relevant as the learner's level rises
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

        [
            SituationFixtures::SITUATION_ORDER_COFFEE_REFERENCE, 'W2-R1-S1', 'Barista',
            ['Commander une boisson simple', 'Order a drink at the coffee shop.'],
            ['Personnaliser sa commande', 'Order a drink at the coffee shop and ask for a modification, such as the size or the type of milk.'],
        ],
        [
            SituationFixtures::SITUATION_WRONG_ORDER_REFERENCE, 'W2-R1-S2', 'Barista',
            ['Signaler une erreur simple', 'Politely tell the barista your order is wrong and ask for the right one.'],
            ['Résoudre le problème', 'Explain the mistake in your order, ask for a solution, and confirm the correction.'],
        ],
        [
            SituationFixtures::SITUATION_ORDER_MEAL_REFERENCE, 'W2-R2-S1', 'Waiter',
            ['Commander un plat simple', 'Order a starter and a main course at the restaurant.'],
            ['Signaler une allergie', 'Order a full meal at the restaurant and ask about ingredients because of a food allergy.'],
        ],
        [
            SituationFixtures::SITUATION_CHANGE_ORDER_REFERENCE, 'W2-R2-S2', 'Waiter',
            ['Demander un changement', 'Ask the waiter to change one item in your order.'],
            ['Expliquer un problème', 'Explain a problem with your meal to the waiter and ask for a solution.'],
        ],
        [
            SituationFixtures::SITUATION_CHOOSE_SHOWING_REFERENCE, 'W2-R3-S1', 'Cinema Cashier',
            ['Acheter un billet', 'Buy a ticket for a movie showing at the cinema.'],
            ['Choisir un horaire', 'Ask about showtimes for a movie and choose the best option for your schedule.'],
        ],
        [
            SituationFixtures::SITUATION_BOOKING_PROBLEM_REFERENCE, 'W2-R3-S2', 'Cinema Cashier',
            ['Signaler un problème', 'Tell the cashier there is a problem with your ticket.'],
            ['Résoudre une réservation', 'Explain a booking problem in detail and ask the cashier to resolve it.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_SEAT_REFERENCE, 'W2-R4-S1', 'Usher',
            ['Trouver sa place', 'Ask an usher to help you find your seat at the theatre.'],
            ['Changer de place', 'Ask an usher about seat options and request to change seats.'],
        ],
        [
            SituationFixtures::SITUATION_BOOK_TICKETS_REFERENCE, 'W2-R4-S2', 'Box Office Clerk',
            ['Acheter des billets', 'Buy tickets for a play at the theatre.'],
            ['Choisir pour un groupe', 'Ask about ticket options for a play and choose seats for a group.'],
        ],
        [
            SituationFixtures::SITUATION_FIND_YOUR_WAY_REFERENCE, 'W2-R5-S1', 'Staff Member',
            ['Demander son chemin', 'Ask a staff member where the entrance or restrooms are during a concert.'],
            ['Se renseigner sur le programme', 'Ask a staff member for directions and information about the concert schedule.'],
        ],
        [
            SituationFixtures::SITUATION_LOST_ITEM_REFERENCE, 'W2-R5-S2', 'Staff Member',
            ['Signaler un objet perdu', 'Tell a staff member you lost an item at the concert.'],
            ['Décrire un objet en détail', 'Describe a lost item in detail and ask staff how to find it.'],
        ],
        [
            SituationFixtures::SITUATION_SUGGEST_GAME_REFERENCE, 'W2-R6-S1', 'Friend',
            ['Proposer un jeu', 'Ask a friend to play an arcade game with you.'],
            ['Expliquer les règles', 'Suggest a game to a friend and explain the rules.'],
        ],
        [
            SituationFixtures::SITUATION_EXCHANGE_TOKENS_REFERENCE, 'W2-R6-S2', 'Staff Member',
            ['Échanger des jetons', 'Ask staff to exchange money for game tokens.'],
            ['Optimiser son échange', 'Ask about the best value for tokens and how to redeem prizes.'],
        ],
        [
            SituationFixtures::SITUATION_ORGANIZE_GAME_REFERENCE, 'W2-R7-S1', 'Staff Member',
            ['Réserver une piste', 'Book a bowling lane with a friend.'],
            ['Organiser pour un groupe', 'Book a bowling lane for a group and ask about shoe rental.'],
        ],
        [
            SituationFixtures::SITUATION_CHEER_FRIEND_REFERENCE, 'W2-R7-S2', 'Friend',
            ['Encourager un ami', 'Cheer on a friend during a bowling game.'],
            ['Discuter de la partie', "Discuss the game's score and suggest a strategy to a friend."],
        ],
        [
            SituationFixtures::SITUATION_ASK_EQUIPMENT_HELP_REFERENCE, 'W2-R8-S1', 'Gym Staff',
            ['Demander de l\'aide simple', 'Ask a gym staff member how to use a piece of equipment.'],
            ['Demander la bonne posture', 'Ask a gym staff member to explain proper form for an exercise.'],
        ],
        [
            SituationFixtures::SITUATION_JOIN_CLASS_REFERENCE, 'W2-R8-S2', 'Gym Staff',
            ['Se renseigner sur les cours', 'Ask about a fitness class schedule.'],
            ["S'inscrire selon ses objectifs", 'Ask about different fitness classes and sign up for one that fits your goals.'],
        ],
        [
            SituationFixtures::SITUATION_ASK_HOURS_REFERENCE, 'W2-R9-S1', 'Lifeguard',
            ['Demander les horaires', "Ask a lifeguard about the pool's opening hours."],
            ['Se renseigner sur les règles', 'Ask a lifeguard about pool rules and opening hours for different activities.'],
        ],
        [
            SituationFixtures::SITUATION_RENT_EQUIPMENT_REFERENCE, 'W2-R9-S2', 'Staff Member',
            ['Louer un casier', 'Ask to rent a locker or a towel at the pool.'],
            ['Comparer les options', 'Ask about rental options and prices for pool equipment.'],
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
