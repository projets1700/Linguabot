<?php

namespace App\DataFixtures;

use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * V2 (LinguaBot_V2_Conception.md §5): Monde 1 "Vie quotidienne", Monde 2
 * "Sorties & loisirs" and Monde 3 "Voyage & transport" are seeded - the
 * remaining 5 worlds from the conception doc are rendered as static "coming
 * soon" cards by the frontend rather than empty/inactive DB rows with no
 * content.
 *
 * Update-in-place by code rather than blind insert: meant to be rerun with
 * `doctrine:fixtures:load --append` on a live database (never a full
 * purge), so editing/extending content never risks the users table - see
 * LevelFixtures for why this matters.
 */
final class WorldFixtures extends Fixture
{
    public const WORLD_1_REFERENCE = 'world-w1';
    public const WORLD_2_REFERENCE = 'world-w2';
    public const WORLD_3_REFERENCE = 'world-w3';

    /**
     * [reference, code, title, description, orderNum].
     */
    private const WORLDS = [
        [self::WORLD_1_REFERENCE, 'W1', 'Vie quotidienne', "Les lieux et situations de la vie de tous les jours : à la maison, au café, dans les commerces.", 0],
        [self::WORLD_2_REFERENCE, 'W2', 'Sorties & loisirs', 'Les endroits où sortir et se divertir : cafés, restaurants, cinéma, sport, culture.', 1],
        [self::WORLD_3_REFERENCE, 'W3', 'Voyage & transport', "Se déplacer et voyager : aéroport, gares, taxi, location de voiture, office de tourisme.", 2],
    ];

    public function load(ObjectManager $manager): void
    {
        $repository = $manager->getRepository(World::class);

        foreach (self::WORLDS as [$reference, $code, $title, $description, $orderNum]) {
            $world = $repository->findOneBy(['code' => $code]) ?? new World();
            $world
                ->setCode($code)
                ->setTitle($title)
                ->setDescription($description)
                ->setOrderNum($orderNum);

            $manager->persist($world);
            $this->addReference($reference, $world);
        }

        $manager->flush();
    }
}
