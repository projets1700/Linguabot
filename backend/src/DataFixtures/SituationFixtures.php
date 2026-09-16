<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\Situation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * 2 situations per Monde 1 room (14 total across the 7 rooms) - each room's
 * first situation is the "situation de départ" from
 * LinguaBot_V2_Conception.md §5's table, the second is an original variant
 * in the same spirit (§6: a room should host more than one situation).
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
