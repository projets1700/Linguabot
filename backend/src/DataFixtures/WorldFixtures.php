<?php

namespace App\DataFixtures;

use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * V2 (LinguaBot_V2_Conception.md §5): Monde 1 "Vie quotidienne", Monde 2
 * "Sorties & loisirs" and Monde 3 "Voyage & transport" are seeded - the
 * remaining 5 worlds from the conception doc are rendered as static "coming
 * soon" cards by the frontend rather than empty/inactive DB rows with no
 * content.
 *
 * Tagged with the 'v2' group (FixtureGroupInterface) so these fixture
 * classes can be loaded on their own via `--append --group=v2` on an
 * already-seeded database, without re-running (and unique-constraint-
 * colliding with) every other fixture class.
 */
final class WorldFixtures extends Fixture implements FixtureGroupInterface
{
    public const WORLD_1_REFERENCE = 'world-w1';
    public const WORLD_2_REFERENCE = 'world-w2';
    public const WORLD_3_REFERENCE = 'world-w3';

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        $world1 = (new World())
            ->setCode('W1')
            ->setTitle('Vie quotidienne')
            ->setDescription("Les lieux et situations de la vie de tous les jours : à la maison, au café, dans les commerces.")
            ->setOrderNum(0);
        $manager->persist($world1);
        $this->addReference(self::WORLD_1_REFERENCE, $world1);

        $world2 = (new World())
            ->setCode('W2')
            ->setTitle('Sorties & loisirs')
            ->setDescription('Les endroits où sortir et se divertir : cafés, restaurants, cinéma, sport, culture.')
            ->setOrderNum(1);
        $manager->persist($world2);
        $this->addReference(self::WORLD_2_REFERENCE, $world2);

        $world3 = (new World())
            ->setCode('W3')
            ->setTitle('Voyage & transport')
            ->setDescription("Se déplacer et voyager : aéroport, gares, taxi, location de voiture, office de tourisme.")
            ->setOrderNum(2);
        $manager->persist($world3);
        $this->addReference(self::WORLD_3_REFERENCE, $world3);

        $manager->flush();
    }
}
