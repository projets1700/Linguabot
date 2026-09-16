<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class MissionControllerTest extends ApiTestCase
{
    public function testFullMissionLifecycle(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $missionId = $this->findAnyA1MissionId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        self::assertResponseStatusCodeSame(201);
        $missionSession = $this->decodeResponse($client);
        self::assertSame('in_progress', $missionSession['status']);
        self::assertCount(1, $missionSession['messages']);
        self::assertSame('assistant', $missionSession['messages'][0]['role']);
        self::assertArrayHasKey('worldCode', $missionSession['mission']);
        self::assertSame('W1', $missionSession['mission']['worldCode']);

        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSession['id']}/message", $token, ['message' => 'Hello!']);
        self::assertResponseIsSuccessful();
        $messageResult = $this->decodeResponse($client);
        self::assertSame('Hello!', $messageResult['userTranscript']);
        self::assertNotEmpty($messageResult['assistantMessage']);

        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSession['id']}/finish", $token);
        self::assertResponseIsSuccessful();
        $finishResult = $this->decodeResponse($client);
        self::assertGreaterThan(0, $finishResult['xpEarned']);
        self::assertContains('BADGE_ADVENTURE_START', array_column($finishResult['newBadges'], 'code'));
        self::assertContains('TROPHY_WORLD_EXPLORER', array_column($finishResult['newTrophies'], 'code'));
    }

    public function testCannotFinishAnAlreadyFinishedMission(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $missionId = $this->findAnyA1MissionId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $missionSessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSessionId}/finish", $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSessionId}/finish", $token);
        self::assertResponseStatusCodeSame(422);
    }

    public function testCannotStartAMissionAboveTheLearnersOwnLevel(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $missions = $this->decodeResponse($client)['rooms'][0]['situations'][0]['missions'];
        $a2MissionId = null;
        foreach ($missions as $mission) {
            if ('A2' === $mission['level']) {
                $a2MissionId = $mission['id'];
            }
        }
        self::assertNotNull($a2MissionId);

        $this->jsonRequest($client, 'POST', "/api/missions/{$a2MissionId}/sessions", $token);

        self::assertResponseStatusCodeSame(403);
    }

    public function testMessageRejectsATranscriptOverTheSizeLimit(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $missionId = $this->findAnyA1MissionId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $missionSessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSessionId}/message", $token, [
            'message' => str_repeat('a', 2001),
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testCannotAccessAnotherUsersMissionSession(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerAndGetTokenAtLevel($client, 'A1');
        $missionId = $this->findAnyA1MissionId($client, $ownerToken);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $ownerToken);
        $missionSessionId = $this->decodeResponse($client)['id'];

        $intruderToken = $this->registerAndGetToken($client);
        $this->jsonRequest($client, 'GET', "/api/mission-sessions/{$missionSessionId}", $intruderToken);

        self::assertResponseStatusCodeSame(403);
    }

    public function testFinishReturnsABilanWithTheMissionTitleAsScenarioTitle(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $missionId = $this->findAnyA1MissionId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/missions/{$missionId}/sessions", $token);
        $missionSessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSessionId}/message", $token, ['message' => 'Hi there!']);

        $this->jsonRequest($client, 'POST', "/api/mission-sessions/{$missionSessionId}/finish", $token);
        self::assertResponseIsSuccessful();
        $summary = $this->decodeResponse($client)['summary'];

        self::assertSame(1, $summary['exchangeCount']);
        self::assertNotEmpty($summary['scenarioTitle']);
    }

    private function findAnyA1MissionId(mixed $client, string $token): int
    {
        $this->jsonRequest($client, 'GET', '/api/worlds/W1', $token);
        $missions = $this->decodeResponse($client)['rooms'][0]['situations'][0]['missions'];

        foreach ($missions as $mission) {
            if ('A1' === $mission['level']) {
                return $mission['id'];
            }
        }

        self::fail('No A1 mission found in the pilot world fixtures.');
    }
}
