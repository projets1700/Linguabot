<?php

namespace App\DataFixtures;

use App\Entity\Level;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

final class LevelFixtures extends Fixture
{
    public const A0_REFERENCE = 'level-a0';

    public function load(ObjectManager $manager): void
    {
        $levels = [
            ['A0', 'Débutant absolu', 0, 0],
            ['A1', 'Grands débuts', 300, 1],
            ['A2', 'Explorateur', 1000, 2],
            ['B1', 'Voyageur', 2500, 3],
            ['B2', 'Maître', 5000, 4],
        ];

        foreach ($levels as [$code, $name, $xpThreshold, $orderNum]) {
            $level = (new Level())
                ->setCode($code)
                ->setName($name)
                ->setXpThreshold($xpThreshold)
                ->setOrderNum($orderNum);

            $manager->persist($level);

            if ('A0' === $code) {
                $this->addReference(self::A0_REFERENCE, $level);
            }
        }

        $manager->flush();
    }
}
