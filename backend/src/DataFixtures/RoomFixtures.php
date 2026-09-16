<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * All 7 rooms of "Monde 1 - Vie quotidienne" (LinguaBot_V2_Conception.md
 * §5's own table, in the same order). "Coffee shop" was dropped from an
 * earlier pilot version of this fixture - it actually belongs to Monde 2
 * "Sorties & loisirs" per the doc, not Monde 1, and will be (re)created
 * there once that world is built.
 * backgroundImageSrc is left null on purpose - no room artwork exists yet,
 * so RoomBackdrop (frontend) falls back to a plain gradient, same graceful
 * degradation as the Dashboard's own missing-photo fallback.
 */
final class RoomFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    public const ROOM_LIVING_ROOM_REFERENCE = 'room-w1-r1';
    public const ROOM_KITCHEN_REFERENCE = 'room-w1-r2';
    public const ROOM_BEDROOM_REFERENCE = 'room-w1-r3';
    public const ROOM_SUPERMARKET_REFERENCE = 'room-w1-r4';
    public const ROOM_BAKERY_REFERENCE = 'room-w1-r5';
    public const ROOM_CLOTHING_SHOP_REFERENCE = 'room-w1-r6';
    public const ROOM_HAIR_SALON_REFERENCE = 'room-w1-r7';

    /**
     * [reference, code, title].
     */
    private const ROOMS = [
        [self::ROOM_LIVING_ROOM_REFERENCE, 'W1-R1', "Salon d'appartement"],
        [self::ROOM_KITCHEN_REFERENCE, 'W1-R2', 'Cuisine familiale'],
        [self::ROOM_BEDROOM_REFERENCE, 'W1-R3', 'Chambre / dressing'],
        [self::ROOM_SUPERMARKET_REFERENCE, 'W1-R4', 'Supermarché'],
        [self::ROOM_BAKERY_REFERENCE, 'W1-R5', 'Boulangerie'],
        [self::ROOM_CLOTHING_SHOP_REFERENCE, 'W1-R6', 'Boutique de vêtements'],
        [self::ROOM_HAIR_SALON_REFERENCE, 'W1-R7', 'Salon de coiffure'],
    ];

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var World $world */
        $world = $this->getReference(WorldFixtures::WORLD_1_REFERENCE, World::class);

        foreach (self::ROOMS as $orderNum => [$reference, $code, $title]) {
            $room = (new Room())
                ->setWorld($world)
                ->setCode($code)
                ->setTitle($title)
                ->setOrderNum($orderNum);
            $manager->persist($room);
            $this->addReference($reference, $room);
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [WorldFixtures::class];
    }
}
