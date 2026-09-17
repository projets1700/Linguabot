<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * All rooms of Monde 1 "Vie quotidienne" (7), Monde 2 "Sorties & loisirs"
 * (9) and Monde 3 "Voyage & transport" (10), each in the exact order
 * LinguaBot_V2_Conception.md §5's own tables list them. "Coffee shop" was
 * dropped from an earlier pilot version of this fixture under Monde 1 by
 * mistake - it correctly belongs to Monde 2, where it now lives.
 * backgroundImageSrc is left null on purpose - no room artwork exists yet,
 * so RoomBackdrop (frontend) falls back to a plain gradient, same graceful
 * degradation as the Dashboard's own missing-photo fallback.
 */
final class RoomFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    // Monde 1 - Vie quotidienne
    public const ROOM_LIVING_ROOM_REFERENCE = 'room-w1-r1';
    public const ROOM_KITCHEN_REFERENCE = 'room-w1-r2';
    public const ROOM_BEDROOM_REFERENCE = 'room-w1-r3';
    public const ROOM_SUPERMARKET_REFERENCE = 'room-w1-r4';
    public const ROOM_BAKERY_REFERENCE = 'room-w1-r5';
    public const ROOM_CLOTHING_SHOP_REFERENCE = 'room-w1-r6';
    public const ROOM_HAIR_SALON_REFERENCE = 'room-w1-r7';

    // Monde 2 - Sorties & loisirs
    public const ROOM_COFFEE_SHOP_REFERENCE = 'room-w2-r1';
    public const ROOM_RESTAURANT_REFERENCE = 'room-w2-r2';
    public const ROOM_CINEMA_REFERENCE = 'room-w2-r3';
    public const ROOM_THEATRE_REFERENCE = 'room-w2-r4';
    public const ROOM_CONCERT_HALL_REFERENCE = 'room-w2-r5';
    public const ROOM_ARCADE_REFERENCE = 'room-w2-r6';
    public const ROOM_BOWLING_REFERENCE = 'room-w2-r7';
    public const ROOM_GYM_REFERENCE = 'room-w2-r8';
    public const ROOM_SWIMMING_POOL_REFERENCE = 'room-w2-r9';

    // Monde 3 - Voyage & transport
    public const ROOM_AIRPORT_TERMINAL_REFERENCE = 'room-w3-r1';
    public const ROOM_PASSPORT_CONTROL_REFERENCE = 'room-w3-r2';
    public const ROOM_BAGGAGE_CLAIM_REFERENCE = 'room-w3-r3';
    public const ROOM_TRAIN_STATION_REFERENCE = 'room-w3-r4';
    public const ROOM_METRO_STATION_REFERENCE = 'room-w3-r5';
    public const ROOM_BUS_STATION_REFERENCE = 'room-w3-r6';
    public const ROOM_TAXI_REFERENCE = 'room-w3-r7';
    public const ROOM_CAR_RENTAL_REFERENCE = 'room-w3-r8';
    public const ROOM_GAS_STATION_REFERENCE = 'room-w3-r9';
    public const ROOM_TOURIST_OFFICE_REFERENCE = 'room-w3-r10';

    /**
     * [worldReference, reference, code, title].
     */
    private const ROOMS = [
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_LIVING_ROOM_REFERENCE, 'W1-R1', "Salon d'appartement"],
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_KITCHEN_REFERENCE, 'W1-R2', 'Cuisine familiale'],
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_BEDROOM_REFERENCE, 'W1-R3', 'Chambre / dressing'],
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_SUPERMARKET_REFERENCE, 'W1-R4', 'Supermarché'],
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_BAKERY_REFERENCE, 'W1-R5', 'Boulangerie'],
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_CLOTHING_SHOP_REFERENCE, 'W1-R6', 'Boutique de vêtements'],
        [WorldFixtures::WORLD_1_REFERENCE, self::ROOM_HAIR_SALON_REFERENCE, 'W1-R7', 'Salon de coiffure'],

        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_COFFEE_SHOP_REFERENCE, 'W2-R1', 'Coffee shop'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_RESTAURANT_REFERENCE, 'W2-R2', 'Restaurant'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_CINEMA_REFERENCE, 'W2-R3', 'Cinéma'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_THEATRE_REFERENCE, 'W2-R4', 'Théâtre'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_CONCERT_HALL_REFERENCE, 'W2-R5', 'Salle de concert'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_ARCADE_REFERENCE, 'W2-R6', "Salle d'arcade"],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_BOWLING_REFERENCE, 'W2-R7', 'Bowling'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_GYM_REFERENCE, 'W2-R8', 'Salle de sport'],
        [WorldFixtures::WORLD_2_REFERENCE, self::ROOM_SWIMMING_POOL_REFERENCE, 'W2-R9', 'Piscine'],

        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_AIRPORT_TERMINAL_REFERENCE, 'W3-R1', "Terminal d'aéroport"],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_PASSPORT_CONTROL_REFERENCE, 'W3-R2', 'Contrôle des passeports'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_BAGGAGE_CLAIM_REFERENCE, 'W3-R3', 'Récupération des bagages'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_TRAIN_STATION_REFERENCE, 'W3-R4', 'Gare ferroviaire'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_METRO_STATION_REFERENCE, 'W3-R5', 'Station de métro'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_BUS_STATION_REFERENCE, 'W3-R6', 'Gare routière'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_TAXI_REFERENCE, 'W3-R7', 'Taxi'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_CAR_RENTAL_REFERENCE, 'W3-R8', 'Agence de location de voitures'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_GAS_STATION_REFERENCE, 'W3-R9', 'Station-service'],
        [WorldFixtures::WORLD_3_REFERENCE, self::ROOM_TOURIST_OFFICE_REFERENCE, 'W3-R10', 'Office de tourisme'],
    ];

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var array<string, int> $orderNumByWorld */
        $orderNumByWorld = [];

        foreach (self::ROOMS as [$worldReference, $reference, $code, $title]) {
            /** @var World $world */
            $world = $this->getReference($worldReference, World::class);
            $orderNum = $orderNumByWorld[$worldReference] ?? 0;

            $room = (new Room())
                ->setWorld($world)
                ->setCode($code)
                ->setTitle($title)
                ->setOrderNum($orderNum);
            $manager->persist($room);
            $this->addReference($reference, $room);

            $orderNumByWorld[$worldReference] = $orderNum + 1;
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [WorldFixtures::class];
    }
}
