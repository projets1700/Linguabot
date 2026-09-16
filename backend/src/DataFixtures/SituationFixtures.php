<?php

namespace App\DataFixtures;

use App\Entity\Room;
use App\Entity\Situation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * 2 situations per pilot room (LinguaBot_V2_Conception.md §6's coffee-shop/
 * appartement examples), each unlocking the next once its first Mission is
 * completed (RoomCatalogService).
 */
final class SituationFixtures extends Fixture implements DependentFixtureInterface, FixtureGroupInterface
{
    public const SITUATION_RAINY_DAY_REFERENCE = 'situation-w1-r1-s1';
    public const SITUATION_DINNER_REFERENCE = 'situation-w1-r1-s2';
    public const SITUATION_ORDER_COFFEE_REFERENCE = 'situation-w1-r2-s1';
    public const SITUATION_WRONG_ORDER_REFERENCE = 'situation-w1-r2-s2';

    public static function getGroups(): array
    {
        return ['v2'];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var Room $livingRoom */
        $livingRoom = $this->getReference(RoomFixtures::ROOM_LIVING_ROOM_REFERENCE, Room::class);
        /** @var Room $coffeeShop */
        $coffeeShop = $this->getReference(RoomFixtures::ROOM_COFFEE_SHOP_REFERENCE, Room::class);

        $rainyDay = (new Situation())
            ->setRoom($livingRoom)
            ->setCode('W1-R1-S1')
            ->setTitle('Rainy Day Plans')
            ->setDescription("Il pleut dehors et tes plans sont annulés - trouve une activité d'intérieur.")
            ->setOrderNum(0);
        $manager->persist($rainyDay);
        $this->addReference(self::SITUATION_RAINY_DAY_REFERENCE, $rainyDay);

        $dinner = (new Situation())
            ->setRoom($livingRoom)
            ->setCode('W1-R1-S2')
            ->setTitle('Préparer le dîner')
            ->setDescription('Avec ton/ta colocataire, décidez quoi cuisiner ce soir.')
            ->setOrderNum(1);
        $manager->persist($dinner);
        $this->addReference(self::SITUATION_DINNER_REFERENCE, $dinner);

        $orderCoffee = (new Situation())
            ->setRoom($coffeeShop)
            ->setCode('W1-R2-S1')
            ->setTitle('Commander un café')
            ->setDescription('Commande une boisson au comptoir.')
            ->setOrderNum(0);
        $manager->persist($orderCoffee);
        $this->addReference(self::SITUATION_ORDER_COFFEE_REFERENCE, $orderCoffee);

        $wrongOrder = (new Situation())
            ->setRoom($coffeeShop)
            ->setCode('W1-R2-S2')
            ->setTitle('Mauvaise commande')
            ->setDescription("Le barista s'est trompé - explique le problème et obtiens la bonne boisson.")
            ->setOrderNum(1);
        $manager->persist($wrongOrder);
        $this->addReference(self::SITUATION_WRONG_ORDER_REFERENCE, $wrongOrder);

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [RoomFixtures::class];
    }
}
