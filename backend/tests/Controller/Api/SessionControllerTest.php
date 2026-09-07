<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class SessionControllerTest extends ApiTestCase
{
    public function testFullSessionLifecycle(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        self::assertResponseStatusCodeSame(201);
        $session = $this->decodeResponse($client);
        self::assertSame('in_progress', $session['status']);
        self::assertCount(1, $session['messages']); // opening message from the "character"
        self::assertSame('assistant', $session['messages'][0]['role']);

        $this->jsonRequest($client, 'POST', "/api/sessions/{$session['id']}/message", $token, ['message' => 'Hello!']);
        self::assertResponseIsSuccessful();
        $messageResult = $this->decodeResponse($client);
        self::assertSame('Hello!', $messageResult['userTranscript']);
        self::assertNotEmpty($messageResult['assistantMessage']);

        $this->jsonRequest($client, 'POST', "/api/sessions/{$session['id']}/finish", $token);
        self::assertResponseIsSuccessful();
        $finishResult = $this->decodeResponse($client);
        self::assertGreaterThan(0, $finishResult['xpEarned']);
        self::assertSame(1, $finishResult['userSessionsCount']);
        self::assertContains('BADGE_FIRST_STEP', array_column($finishResult['newBadges'], 'code'));
    }

    public function testCannotFinishAnAlreadyFinishedSession(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        self::assertResponseStatusCodeSame(422);
    }

    public function testCannotAccessAnotherUsersSession(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerAndGetToken($client);
        $scenarioId = $this->findAnyScenarioId($client, $ownerToken);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $ownerToken);
        $sessionId = $this->decodeResponse($client)['id'];

        $intruderToken = $this->registerAndGetToken($client);
        $this->jsonRequest($client, 'GET', "/api/sessions/{$sessionId}", $intruderToken);

        self::assertResponseStatusCodeSame(403);
    }

    private function findAnyScenarioId(mixed $client, string $token): int
    {
        $this->jsonRequest($client, 'GET', '/api/scenarios', $token);

        return $this->decodeResponse($client)[0]['id'];
    }
}
