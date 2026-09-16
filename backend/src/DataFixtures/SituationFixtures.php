<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\Situation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * 2 situations per room across Monde 1 (14, over 7 rooms) and Monde 2 (18,
 * over 9 rooms) - each room's first situation is the "situation de départ"
 * from LinguaBot_V2_Conception.md §5's tables, the second is an original
 * variant in the same spirit (§6: a room should host more than one situation).
 */
final class SituationFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    public const SITUATION_RAINY_DAY_REFERENCE = 'situation-w1-r1-s1';
    public const SITUATION_DINNER_REFERENCE = 'situation-w1-r1-s2';
    public const SITUATION_RECIPE_REFERENCE = 'situation-w1-r2-s1';
    public const SITUATION_MISSING_INGREDIENT_REFERENCE = 'situation-w1-r2-s2';
    public const SITUATION_PACK_SUITCASE_REFERENCE = 'situation-w1-r3-s1';
    public const SITUATION_FIND_OUTFIT_REFERENCE = 'situation-w1-r3-s2';
    public const SITUATION_GROCERY_SHOPPING_REFERENCE = 'situation-w1-r4-s1';
    public const SITUATION_CHECKOUT_PROBLEM_REFERENCE = 'situation-w1-r4-s2';
    public const SITUATION_BUY_BREAKFAST_REFERENCE = 'situation-w1-r5-s1';
    public const SITUATION_SPECIAL_ORDER_REFERENCE = 'situation-w1-r5-s2';
    public const SITUATION_BUY_CLOTHES_REFERENCE = 'situation-w1-r6-s1';
    public const SITUATION_FITTING_ROOM_REFERENCE = 'situation-w1-r6-s2';
    public const SITUATION_DESCRIBE_HAIRCUT_REFERENCE = 'situation-w1-r7-s1';
    public const SITUATION_BOOK_APPOINTMENT_REFERENCE = 'situation-w1-r7-s2';

    // Monde 2 - Sorties & loisirs
    public const SITUATION_ORDER_COFFEE_REFERENCE = 'situation-w2-r1-s1';
    public const SITUATION_WRONG_ORDER_REFERENCE = 'situation-w2-r1-s2';
    public const SITUATION_ORDER_MEAL_REFERENCE = 'situation-w2-r2-s1';
    public const SITUATION_CHANGE_ORDER_REFERENCE = 'situation-w2-r2-s2';
    public const SITUATION_CHOOSE_SHOWING_REFERENCE = 'situation-w2-r3-s1';
    public const SITUATION_BOOKING_PROBLEM_REFERENCE = 'situation-w2-r3-s2';
    public const SITUATION_FIND_SEAT_REFERENCE = 'situation-w2-r4-s1';
    public const SITUATION_BOOK_TICKETS_REFERENCE = 'situation-w2-r4-s2';
    public const SITUATION_FIND_YOUR_WAY_REFERENCE = 'situation-w2-r5-s1';
    public const SITUATION_LOST_ITEM_REFERENCE = 'situation-w2-r5-s2';
    public const SITUATION_SUGGEST_GAME_REFERENCE = 'situation-w2-r6-s1';
    public const SITUATION_EXCHANGE_TOKENS_REFERENCE = 'situation-w2-r6-s2';
    public const SITUATION_ORGANIZE_GAME_REFERENCE = 'situation-w2-r7-s1';
    public const SITUATION_CHEER_FRIEND_REFERENCE = 'situation-w2-r7-s2';
    public const SITUATION_ASK_EQUIPMENT_HELP_REFERENCE = 'situation-w2-r8-s1';
    public const SITUATION_JOIN_CLASS_REFERENCE = 'situation-w2-r8-s2';
    public const SITUATION_ASK_HOURS_REFERENCE = 'situation-w2-r9-s1';
    public const SITUATION_RENT_EQUIPMENT_REFERENCE = 'situation-w2-r9-s2';

    /**
     * [reference, roomReference, code, title, description].
     */
    private const SITUATIONS = [
        [self::SITUATION_RAINY_DAY_REFERENCE, RoomFixtures::ROOM_LIVING_ROOM_REFERENCE, 'W1-R1-S1', 'Rainy Day Plans', "Il pleut dehors et tes plans sont annulés - trouve une activité d'intérieur."],
        [self::SITUATION_DINNER_REFERENCE, RoomFixtures::ROOM_LIVING_ROOM_REFERENCE, 'W1-R1-S2', 'Préparer le dîner', 'Avec ton/ta colocataire, décidez quoi cuisiner ce soir.'],

        [self::SITUATION_RECIPE_REFERENCE, RoomFixtures::ROOM_KITCHEN_REFERENCE, 'W1-R2-S1', 'Suivre une recette', "Cuisine avec un proche en suivant une recette pas à pas."],
        [self::SITUATION_MISSING_INGREDIENT_REFERENCE, RoomFixtures::ROOM_KITCHEN_REFERENCE, 'W1-R2-S2', 'Un ingrédient manquant', "Il manque un ingrédient pour la recette - trouvez une solution."],

        [self::SITUATION_PACK_SUITCASE_REFERENCE, RoomFixtures::ROOM_BEDROOM_REFERENCE, 'W1-R3-S1', 'Préparer une valise', "Prépare ta valise pour un voyage avec l'aide d'un proche."],
        [self::SITUATION_FIND_OUTFIT_REFERENCE, RoomFixtures::ROOM_BEDROOM_REFERENCE, 'W1-R3-S2', 'Trouver une tenue', "Demande conseil pour choisir une tenue pour une occasion."],

        [self::SITUATION_GROCERY_SHOPPING_REFERENCE, RoomFixtures::ROOM_SUPERMARKET_REFERENCE, 'W1-R4-S1', 'Faire les courses', 'Trouve les articles de ta liste de courses au supermarché.'],
        [self::SITUATION_CHECKOUT_PROBLEM_REFERENCE, RoomFixtures::ROOM_SUPERMARKET_REFERENCE, 'W1-R4-S2', 'Problème à la caisse', 'Un problème de prix survient à la caisse - explique-le au caissier.'],

        [self::SITUATION_BUY_BREAKFAST_REFERENCE, RoomFixtures::ROOM_BAKERY_REFERENCE, 'W1-R5-S1', 'Acheter le petit-déjeuner', 'Commande du pain et des viennoiseries à la boulangerie.'],
        [self::SITUATION_SPECIAL_ORDER_REFERENCE, RoomFixtures::ROOM_BAKERY_REFERENCE, 'W1-R5-S2', 'Commande spéciale', 'Passe une commande spéciale pour une occasion.'],

        [self::SITUATION_BUY_CLOTHES_REFERENCE, RoomFixtures::ROOM_CLOTHING_SHOP_REFERENCE, 'W1-R6-S1', 'Choisir et acheter des vêtements', "Demande de l'aide pour choisir et acheter des vêtements."],
        [self::SITUATION_FITTING_ROOM_REFERENCE, RoomFixtures::ROOM_CLOTHING_SHOP_REFERENCE, 'W1-R6-S2', 'Essayage et retour', "Un vêtement ne convient pas - gère l'essayage ou le retour."],

        [self::SITUATION_DESCRIBE_HAIRCUT_REFERENCE, RoomFixtures::ROOM_HAIR_SALON_REFERENCE, 'W1-R7-S1', 'Expliquer la coupe souhaitée', 'Explique au coiffeur la coupe que tu souhaites.'],
        [self::SITUATION_BOOK_APPOINTMENT_REFERENCE, RoomFixtures::ROOM_HAIR_SALON_REFERENCE, 'W1-R7-S2', 'Prendre rendez-vous', 'Prends ou modifie un rendez-vous chez le coiffeur.'],

        [self::SITUATION_ORDER_COFFEE_REFERENCE, RoomFixtures::ROOM_COFFEE_SHOP_REFERENCE, 'W2-R1-S1', 'Commander un café', 'Commande une boisson au comptoir.'],
        [self::SITUATION_WRONG_ORDER_REFERENCE, RoomFixtures::ROOM_COFFEE_SHOP_REFERENCE, 'W2-R1-S2', 'Mauvaise commande', "Le barista s'est trompé - explique le problème et obtiens la bonne boisson."],

        [self::SITUATION_ORDER_MEAL_REFERENCE, RoomFixtures::ROOM_RESTAURANT_REFERENCE, 'W2-R2-S1', 'Commander un repas', 'Commande une entrée et un plat au restaurant.'],
        [self::SITUATION_CHANGE_ORDER_REFERENCE, RoomFixtures::ROOM_RESTAURANT_REFERENCE, 'W2-R2-S2', 'Modifier sa commande', 'Un plat pose problème - demande à le changer ou à le faire refaire.'],

        [self::SITUATION_CHOOSE_SHOWING_REFERENCE, RoomFixtures::ROOM_CINEMA_REFERENCE, 'W2-R3-S1', 'Choisir une séance', 'Achète un billet pour une séance de cinéma.'],
        [self::SITUATION_BOOKING_PROBLEM_REFERENCE, RoomFixtures::ROOM_CINEMA_REFERENCE, 'W2-R3-S2', 'Problème de réservation', 'Ta réservation pose problème - explique-le à la caissière.'],

        [self::SITUATION_FIND_SEAT_REFERENCE, RoomFixtures::ROOM_THEATRE_REFERENCE, 'W2-R4-S1', 'Trouver sa place', 'Demande à un ouvreur de t\'aider à trouver ta place.'],
        [self::SITUATION_BOOK_TICKETS_REFERENCE, RoomFixtures::ROOM_THEATRE_REFERENCE, 'W2-R4-S2', 'Réserver des billets', 'Achète des billets pour une pièce de théâtre.'],

        [self::SITUATION_FIND_YOUR_WAY_REFERENCE, RoomFixtures::ROOM_CONCERT_HALL_REFERENCE, 'W2-R5-S1', 'Se repérer pendant un événement', "Demande ton chemin à un membre du personnel pendant un concert."],
        [self::SITUATION_LOST_ITEM_REFERENCE, RoomFixtures::ROOM_CONCERT_HALL_REFERENCE, 'W2-R5-S2', 'Objet perdu', 'Tu as perdu un objet pendant le concert - signale-le.'],

        [self::SITUATION_SUGGEST_GAME_REFERENCE, RoomFixtures::ROOM_ARCADE_REFERENCE, 'W2-R6-S1', 'Proposer une partie', 'Propose à un ami de jouer à un jeu d\'arcade.'],
        [self::SITUATION_EXCHANGE_TOKENS_REFERENCE, RoomFixtures::ROOM_ARCADE_REFERENCE, 'W2-R6-S2', 'Échanger des jetons', "Échange de la monnaie contre des jetons de jeu."],

        [self::SITUATION_ORGANIZE_GAME_REFERENCE, RoomFixtures::ROOM_BOWLING_REFERENCE, 'W2-R7-S1', 'Organiser une partie', 'Réserve une piste de bowling avec un ami.'],
        [self::SITUATION_CHEER_FRIEND_REFERENCE, RoomFixtures::ROOM_BOWLING_REFERENCE, 'W2-R7-S2', 'Encourager un ami', 'Discute de la partie et encourage un ami qui joue.'],

        [self::SITUATION_ASK_EQUIPMENT_HELP_REFERENCE, RoomFixtures::ROOM_GYM_REFERENCE, 'W2-R8-S1', "Demander de l'aide sur un équipement", 'Demande à un employé comment utiliser un appareil de sport.'],
        [self::SITUATION_JOIN_CLASS_REFERENCE, RoomFixtures::ROOM_GYM_REFERENCE, 'W2-R8-S2', "S'inscrire à un cours", "Renseigne-toi sur les cours collectifs et inscris-toi."],

        [self::SITUATION_ASK_HOURS_REFERENCE, RoomFixtures::ROOM_SWIMMING_POOL_REFERENCE, 'W2-R9-S1', 'Demander horaires et informations', "Demande les horaires d'ouverture de la piscine."],
        [self::SITUATION_RENT_EQUIPMENT_REFERENCE, RoomFixtures::ROOM_SWIMMING_POOL_REFERENCE, 'W2-R9-S2', 'Louer du matériel', 'Demande à louer un casier ou une serviette.'],
    ];

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var array<string, int> $orderNumByRoom */
        $orderNumByRoom = [];

        foreach (self::SITUATIONS as [$reference, $roomReference, $code, $title, $description]) {
            /** @var Room $room */
            $room = $this->getReference($roomReference, Room::class);
            $orderNum = $orderNumByRoom[$roomReference] ?? 0;

            $situation = (new Situation())
                ->setRoom($room)
                ->setCode($code)
                ->setTitle($title)
                ->setDescription($description)
                ->setOrderNum($orderNum);
            $manager->persist($situation);
            $this->addReference($reference, $situation);

            $orderNumByRoom[$roomReference] = $orderNum + 1;
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [RoomFixtures::class];
    }
}
