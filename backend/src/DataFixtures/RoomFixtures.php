<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * The first 2 rooms of "Monde 1 - Vie quotidienne" (of the 7 listed in
 * LinguaBot_V2_Conception.md §5), enough to validate the Room -> Situation ->
 * Mission pipeline end to end without producing all 7 for the pilot.
 * backgroundImageSrc is left null on purpose - no room artwork exists yet,
 * so RoomBackdrop (frontend) falls back to a plain gradient, same graceful
 * degradation as the Dashboard's own missing-photo fallback.
 */
final class RoomFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    public const ROOM_LIVING_ROOM_REFERENCE = 'room-w1-r1';
    public const ROOM_COFFEE_SHOP_REFERENCE = 'room-w1-r2';

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var World $world */
        $world = $this->getReference(WorldFixtures::WORLD_1_REFERENCE, World::class);

        $livingRoom = (new Room())
            ->setWorld($world)
            ->setCode('W1-R1')
            ->setTitle("Salon d'appartement")
            ->setOrderNum(0);
        $manager->persist($livingRoom);
        $this->addReference(self::ROOM_LIVING_ROOM_REFERENCE, $livingRoom);

        $coffeeShop = (new Room())
            ->setWorld($world)
            ->setCode('W1-R2')
            ->setTitle('Coffee shop')
            ->setOrderNum(1);
        $manager->persist($coffeeShop);
        $this->addReference(self::ROOM_COFFEE_SHOP_REFERENCE, $coffeeShop);

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [WorldFixtures::class];
    }
}
