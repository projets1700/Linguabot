<?php

namespace App\DataFixtures;

use App\Entity\World;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * V2 (LinguaBot_V2_Conception.md §5): all 8 worlds from the conception doc
 * are now seeded - Monde 1 "Vie quotidienne", Monde 2 "Sorties & loisirs",
 * Monde 3 "Voyage & transport", Monde 4 "Vacances & aventure", Monde 5
 * "Travail & études", Monde 6 "Services & ville", Monde 7 "Santé &
 * imprévus" and Monde 8 "Relations sociales".
 *
 * Titles/descriptions are in English (unlike the room/situation/mission
 * fixtures, still French for now) - these are the only V2 content strings
 * actually rendered on /aventure today, and the rest of the app's UI is
 * English since the translation pass - see AdventurePage.
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
    public const WORLD_4_REFERENCE = 'world-w4';
    public const WORLD_5_REFERENCE = 'world-w5';
    public const WORLD_6_REFERENCE = 'world-w6';
    public const WORLD_7_REFERENCE = 'world-w7';
    public const WORLD_8_REFERENCE = 'world-w8';

    /**
     * [reference, code, title, description, orderNum].
     */
    private const WORLDS = [
        [self::WORLD_1_REFERENCE, 'W1', 'Daily Life', 'Everyday places and situations: at home, at the café, running errands.', 0],
        [self::WORLD_2_REFERENCE, 'W2', 'Leisure & Outings', 'Places to go out and have fun: cafés, restaurants, the movies, sports, culture.', 1],
        [self::WORLD_3_REFERENCE, 'W3', 'Travel & Transport', 'Getting around and traveling: airports, train stations, taxis, car rentals, tourist offices.', 2],
        [self::WORLD_4_REFERENCE, 'W4', 'Vacation & Adventure', 'Vacation moments: hotels, beaches, camping, cruises, museums.', 3],
        [self::WORLD_5_REFERENCE, 'W5', 'Work & Studies', 'The professional and academic world: university, interviews, the office, meetings.', 4],
        [self::WORLD_6_REFERENCE, 'W6', 'City & Services', 'Everyday errands around town: the bank, the post office, the garage, real estate agencies.', 5],
        [self::WORLD_7_REFERENCE, 'W7', 'Health & Emergencies', 'Managing your health and the unexpected: the doctor, the pharmacy, the dentist, the ER.', 6],
        [self::WORLD_8_REFERENCE, 'W8', 'Social Life', 'Meeting and talking with other people in social settings.', 7],
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
