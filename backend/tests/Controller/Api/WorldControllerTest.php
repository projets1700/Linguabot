<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class WorldControllerTest extends ApiTestCase
{
    public function testWorldsIndexListsThePilotWorld(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/worlds', $token);

        self::assertResponseIsSuccessful();
        $worlds = $this->decodeResponse($client);
        self::assertCount(1, $worlds);
        self::assertSame('W1', $worlds[0]['code']);
        self::assertTrue($worlds[0]['unlocked']);
        self::assertSame(7, $worlds[0]['roomsCount']);
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
