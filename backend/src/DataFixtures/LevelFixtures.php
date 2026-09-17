<?php

namespace App\DataFixtures;

use App\Entity\Level;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

final class LevelFixtures extends Fixture
{
    public const A0_REFERENCE = 'level-a0';

    public static function reference(string $code): string
    {
        return 'level-'.strtolower($code);
    }

    public function load(ObjectManager $manager): void
    {
        $levels = [
            ['A0', 'Débutant absolu', 0, 0],
            ['A1', 'Grands débuts', 300, 1],
            ['A2', 'Explorateur', 1000, 2],
            ['B1', 'Voyageur', 2500, 3],
            ['B2', 'Maître', 5000, 4],
        ];

        $repository = $manager->getRepository(Level::class);

        foreach ($levels as [$code, $name, $xpThreshold, $orderNum]) {
            // Update-in-place by code rather than always inserting: this
            // fixture (and every other content fixture) is meant to be
            // rerun with `--append` on a live database, never with a full
            // purge - reusing the existing row keeps its id stable, so
            // users.level_id (and every other FK into this table) never
            // dangles. See RoomFixtures/SituationFixtures/MissionFixtures/
            // GamificationFixtures/QuizFixtures for the same pattern.
            $level = $repository->findOneBy(['code' => $code]) ?? new Level();
            $level
                ->setCode($code)
                ->setName($name)
                ->setXpThreshold($xpThreshold)
                ->setOrderNum($orderNum);

            $manager->persist($level);

            $this->addReference(self::reference($code), $level);
        }

        $manager->flush();
    }
}
