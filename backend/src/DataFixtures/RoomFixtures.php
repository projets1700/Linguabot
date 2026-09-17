<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * All rooms of Monde 1 "Vie quotidienne" (7), Monde 2 "Sorties & loisirs"
 * (9), Monde 3 "Voyage & transport" (10), Monde 4 "Vacances & aventure" (5),
 * Monde 5 "Travail & études" (7) and Monde 6 "Services & ville" (7), each in
 * the exact order LinguaBot_V2_Conception.md §5's own tables list them.
 * "Coffee shop" was
 * dropped from an earlier pilot version of this fixture under Monde 1 by
 * mistake - it correctly belongs to Monde 2, where it now lives.
 * backgroundImageSrc is left null on purpose - no room artwork exists yet,
 * so RoomBackdrop (frontend) falls back to a plain gradient, same graceful
 * degradation as the Dashboard's own missing-photo fallback.
 *
 * Update-in-place by code rather than blind insert - see WorldFixtures.
 */
final class RoomFixtures extends Fixture implements DependentFixtureInterface
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

    // Monde 4 - Vacances & aventure
    public const ROOM_HOTEL_LOBBY_REFERENCE = 'room-w4-r1';
    public const ROOM_BEACH_CLUB_REFERENCE = 'room-w4-r2';
    public const ROOM_CAMPSITE_REFERENCE = 'room-w4-r3';
    public const ROOM_CRUISE_SHIP_REFERENCE = 'room-w4-r4';
    public const ROOM_MUSEUM_REFERENCE = 'room-w4-r5';

    // Monde 5 - Travail & études
    public const ROOM_LECTURE_HALL_REFERENCE = 'room-w5-r1';
    public const ROOM_LABORATORY_REFERENCE = 'room-w5-r2';
    public const ROOM_INTERVIEW_ROOM_REFERENCE = 'room-w5-r3';
    public const ROOM_OPEN_SPACE_REFERENCE = 'room-w5-r4';
    public const ROOM_MEETING_ROOM_REFERENCE = 'room-w5-r5';
    public const ROOM_HELP_DESK_REFERENCE = 'room-w5-r6';
    public const ROOM_LIBRARY_REFERENCE = 'room-w5-r7';

    // Monde 6 - Services & ville
    public const ROOM_BANK_REFERENCE = 'room-w6-r1';
    public const ROOM_POST_OFFICE_REFERENCE = 'room-w6-r2';
    public const ROOM_ELECTRONICS_STORE_REFERENCE = 'room-w6-r3';
    public const ROOM_GARAGE_REFERENCE = 'room-w6-r4';
    public const ROOM_REAL_ESTATE_AGENCY_REFERENCE = 'room-w6-r5';
    public const ROOM_APARTMENT_VIEWING_REFERENCE = 'room-w6-r6';
    public const ROOM_POLICE_STATION_REFERENCE = 'room-w6-r7';

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

        [WorldFixtures::WORLD_4_REFERENCE, self::ROOM_HOTEL_LOBBY_REFERENCE, 'W4-R1', "Lobby d'hôtel"],
        [WorldFixtures::WORLD_4_REFERENCE, self::ROOM_BEACH_CLUB_REFERENCE, 'W4-R2', 'Club de plage'],
        [WorldFixtures::WORLD_4_REFERENCE, self::ROOM_CAMPSITE_REFERENCE, 'W4-R3', 'Cabane / camping'],
        [WorldFixtures::WORLD_4_REFERENCE, self::ROOM_CRUISE_SHIP_REFERENCE, 'W4-R4', 'Bateau / croisière'],
        [WorldFixtures::WORLD_4_REFERENCE, self::ROOM_MUSEUM_REFERENCE, 'W4-R5', 'Musée'],

        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_LECTURE_HALL_REFERENCE, 'W5-R1', 'Université / amphithéâtre'],
        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_LABORATORY_REFERENCE, 'W5-R2', 'Laboratoire'],
        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_INTERVIEW_ROOM_REFERENCE, 'W5-R3', "Salle d'entretien"],
        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_OPEN_SPACE_REFERENCE, 'W5-R4', 'Open space'],
        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_MEETING_ROOM_REFERENCE, 'W5-R5', 'Salle de réunion'],
        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_HELP_DESK_REFERENCE, 'W5-R6', "Centre d'assistance"],
        [WorldFixtures::WORLD_5_REFERENCE, self::ROOM_LIBRARY_REFERENCE, 'W5-R7', 'Bibliothèque'],

        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_BANK_REFERENCE, 'W6-R1', 'Banque'],
        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_POST_OFFICE_REFERENCE, 'W6-R2', 'Bureau de poste'],
        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_ELECTRONICS_STORE_REFERENCE, 'W6-R3', "Boutique d'électronique"],
        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_GARAGE_REFERENCE, 'W6-R4', 'Garage automobile'],
        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_REAL_ESTATE_AGENCY_REFERENCE, 'W6-R5', 'Agence immobilière'],
        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_APARTMENT_VIEWING_REFERENCE, 'W6-R6', 'Appartement à visiter'],
        [WorldFixtures::WORLD_6_REFERENCE, self::ROOM_POLICE_STATION_REFERENCE, 'W6-R7', 'Commissariat'],
    ];

    public function load(ObjectManager $manager): void
    {
        $repository = $manager->getRepository(Room::class);

        /** @var array<string, int> $orderNumByWorld */
        $orderNumByWorld = [];

        foreach (self::ROOMS as [$worldReference, $reference, $code, $title]) {
            /** @var World $world */
            $world = $this->getReference($worldReference, World::class);
            $orderNum = $orderNumByWorld[$worldReference] ?? 0;

            $room = $repository->findOneBy(['code' => $code]) ?? new Room();
            $room
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
