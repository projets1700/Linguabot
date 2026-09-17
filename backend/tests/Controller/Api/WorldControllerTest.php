<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class WorldControllerTest extends ApiTestCase
{
    public function testWorldsIndexListsBothSeededWorlds(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/worlds', $token);

        self::assertResponseIsSuccessful();
        $worlds = $this->decodeResponse($client);
        self::assertCount(6, $worlds);
        self::assertSame('W1', $worlds[0]['code']);
        self::assertTrue($worlds[0]['unlocked']);
        self::assertSame(7, $worlds[0]['roomsCount']);
        self::assertSame('W2', $worlds[1]['code']);
        self::assertTrue($worlds[1]['unlocked']);
        self::assertSame(9, $worlds[1]['roomsCount']);
        self::assertSame('W3', $worlds[2]['code']);
        self::assertTrue($worlds[2]['unlocked']);
        self::assertSame(10, $worlds[2]['roomsCount']);
        self::assertSame('W4', $worlds[3]['code']);
        self::assertTrue($worlds[3]['unlocked']);
        self::assertSame(5, $worlds[3]['roomsCount']);
        self::assertSame('W5', $worlds[4]['code']);
        self::assertTrue($worlds[4]['unlocked']);
        self::assertSame(7, $worlds[4]['roomsCount']);
        self::assertSame('W6', $worlds[5]['code']);
        self::assertTrue($worlds[5]['unlocked']);
        self::assertSame(7, $worlds[5]['roomsCount']);
    }

    public function testWorldsIndexRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/worlds');

        self::assertResponseStatusCodeSame(401);
    }

    public function testWorldDetailListsRoomsSituationsAndMissions(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);

        self::assertResponseIsSuccessful();
        $world = $this->decodeResponse($client);
        self::assertSame('W1', $world['code']);
        self::assertCount(7, $world['rooms']);

        $livingRoom = $world['rooms'][0];
        self::assertSame('W1-R1', $livingRoom['code']);
        self::assertCount(2, $livingRoom['situations']);
        self::assertCount(2, $livingRoom['situations'][0]['missions']);
    }

    public function testWorldTwoDetailListsItsNineRooms(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W2', $token);

        self::assertResponseIsSuccessful();
        $world = $this->decodeResponse($client);
        self::assertSame('W2', $world['code']);
        self::assertTrue($world['unlocked']);
        self::assertCount(9, $world['rooms']);

        $coffeeShop = $world['rooms'][0];
        self::assertSame('W2-R1', $coffeeShop['code']);
        self::assertCount(2, $coffeeShop['situations']);
        self::assertCount(2, $coffeeShop['situations'][0]['missions']);
    }

    public function testWorldThreeDetailListsItsTenRooms(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W3', $token);

        self::assertResponseIsSuccessful();
        $world = $this->decodeResponse($client);
        self::assertSame('W3', $world['code']);
        self::assertTrue($world['unlocked']);
        self::assertCount(10, $world['rooms']);

        $airportTerminal = $world['rooms'][0];
        self::assertSame('W3-R1', $airportTerminal['code']);
        self::assertCount(2, $airportTerminal['situations']);
        self::assertCount(2, $airportTerminal['situations'][0]['missions']);
    }

    public function testWorldFourDetailListsItsFiveRooms(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W4', $token);

        self::assertResponseIsSuccessful();
        $world = $this->decodeResponse($client);
        self::assertSame('W4', $world['code']);
        self::assertTrue($world['unlocked']);
        self::assertCount(5, $world['rooms']);

        $hotelLobby = $world['rooms'][0];
        self::assertSame('W4-R1', $hotelLobby['code']);
        self::assertCount(2, $hotelLobby['situations']);
        self::assertCount(2, $hotelLobby['situations'][0]['missions']);
    }

    public function testWorldFiveDetailListsItsSevenRooms(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W5', $token);

        self::assertResponseIsSuccessful();
        $world = $this->decodeResponse($client);
        self::assertSame('W5', $world['code']);
        self::assertTrue($world['unlocked']);
        self::assertCount(7, $world['rooms']);

        $lectureHall = $world['rooms'][0];
        self::assertSame('W5-R1', $lectureHall['code']);
        self::assertCount(2, $lectureHall['situations']);
        self::assertCount(2, $lectureHall['situations'][0]['missions']);
    }

    public function testWorldSixDetailListsItsSevenRooms(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W6', $token);

        self::assertResponseIsSuccessful();
        $world = $this->decodeResponse($client);
        self::assertSame('W6', $world['code']);
        self::assertTrue($world['unlocked']);
        self::assertCount(7, $world['rooms']);

        $bank = $world['rooms'][0];
        self::assertSame('W6-R1', $bank['code']);
        self::assertCount(2, $bank['situations']);
        self::assertCount(2, $bank['situations'][0]['missions']);
    }

    public function testUnknownWorldCodeReturns404(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/worlds/DOES-NOT-EXIST', $token);

        self::assertResponseStatusCodeSame(404);
    }

    public function testFirstSituationInARoomIsAlwaysUnlockedButTheSecondIsNotUntilTheFirstIsCompleted(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A2');

        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $situations = $this->decodeResponse($client)['rooms'][0]['situations'];

        self::assertTrue($situations[0]['unlocked']);
        self::assertFalse($situations[0]['completed']);
        self::assertFalse($situations[1]['unlocked']);
    }

    public function testCompletingAMissionUnlocksTheNextSituationInTheSameRoom(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $firstSituationMissionId = $this->decodeResponse($client)['rooms'][0]['situations'][0]['missions'][0]['id'];

        $this->jsonRequest($client, 'POST', "/api/missions/{$firstSituationMissionId}/sessions", $token);
        $missionSessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSessionId}/finish", $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $situations = $this->decodeResponse($client)['rooms'][0]['situations'];

        self::assertTrue($situations[0]['completed']);
        self::assertTrue($situations[1]['unlocked']);
    }

    public function testAMissionAboveTheLearnersLevelIsLockedEvenWhenItsSituationIsUnlocked(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $missions = $this->decodeResponse($client)['rooms'][0]['situations'][0]['missions'];

        $a1Mission = self::findMissionAtLevel($missions, 'A1');
        $a2Mission = self::findMissionAtLevel($missions, 'A2');

        self::assertTrue($a1Mission['unlocked']);
        self::assertFalse($a2Mission['unlocked']);
    }

    /**
     * @param array<int, array{level: string}> $missions
     *
     * @return array{level: string}
     */
    private static function findMissionAtLevel(array $missions, string $levelCode): array
    {
        foreach ($missions as $mission) {
            if ($levelCode === $mission['level']) {
                return $mission;
            }
        }

        self::fail("No mission found at level {$levelCode}");
    }
}
