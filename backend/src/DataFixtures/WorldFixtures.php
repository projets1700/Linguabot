<?php

namespace App\DataFixtures;

use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * V2 pilot (LinguaBot_V2_Conception.md §5): only "Monde 1 - Vie quotidienne"
 * is seeded for now, per the approved pilot scope - the other 7 worlds from
 * the conception doc are rendered as static "coming soon" cards by the
 * frontend rather than empty/inactive DB rows with no content.
 *
 * Tagged with the 'v2' group (FixtureGroupInterface) so these 4 new fixture
 * classes can be loaded on their own via `--append --group=v2` on an
 * already-seeded database, without re-running (and unique-constraint-
 * colliding with) every other fixture class.
 */
final class WorldFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['v2'];
    }

    public const WORLD_1_REFERENCE = 'world-w1';

    public function load(ObjectManager $manager): void
    {
        $world = (new World())
            ->setCode('W1')
            ->setTitle('Vie quotidienne')
            ->setDescription("Les lieux et situations de la vie de tous les jours : à la maison, au café, dans les commerces.")
            ->setOrderNum(0);

        $manager->persist($world);
        $this->addReference(self::WORLD_1_REFERENCE, $world);

        $manager->flush();
    }
}
