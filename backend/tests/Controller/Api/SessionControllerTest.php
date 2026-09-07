<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class SessionControllerTest extends ApiTestCase
{
    public function testFullSessionLifecycle(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
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
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        self::assertResponseStatusCodeSame(422);
    }

    public function testMessageThatEchoesTheAisOwnQuestionIsRejected(): void
    {
        // Regression: the mic used to keep listening (or get abandoned
        // rather than stopped) while the AI's own voice was still playing,
        // so its own opening line could get picked up and submitted back
        // as if the learner had said it.
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $session = $this->decodeResponse($client);
        $opening = $session['messages'][0]['content'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$session['id']}/message", $token, ['message' => $opening]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testAskingToRepeatReSaysTheSameLineWithoutAdvancingTheConversation(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $session = $this->decodeResponse($client);
        $opening = $session['messages'][0]['content'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$session['id']}/message", $token, ['message' => "Sorry, I didn't understand, can you repeat?"]);

        self::assertResponseIsSuccessful();
        $repeatResult = $this->decodeResponse($client);
        self::assertStringContainsString($opening, $repeatResult['assistantMessage']);

        $this->jsonRequest($client, 'GET', "/api/sessions/{$session['id']}", $token);
        self::assertCount(1, $this->decodeResponse($client)['messages']);
    }

    public function testCannotStartAScenarioAboveTheLearnersOwnLevel(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/scenarios?level=B2', $token);
        $lockedScenarioId = $this->decodeResponse($client)[0]['id'];

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$lockedScenarioId}/sessions", $token);

        self::assertResponseStatusCodeSame(403);
    }

    public function testFinishingASessionCanTriggerALevelUpWhenXpThresholdIsReached(): void
    {
        $client = static::createClient();
        $email = 'level-up-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetTokenAtLevel($client, 'A1', $email);
        $scenarioId = $this->findAnyScenarioId($client, $token);

        // A2's threshold is 1000 XP (LevelFixtures) - park the learner just
        // under it so finishing one more session tips them over.
        $this->setUserTotalXp($email, 990);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, ['message' => 'Hello there!']);

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        $result = $this->decodeResponse($client);

        self::assertNotNull($result['levelUp']);
        self::assertSame('A2', $result['levelUp']['code']);

        // ... and a B2 scenario is still locked, but an A2 one is now
        // reachable - the level actually changed, not just the response field.
        $this->jsonRequest($client, 'GET', '/api/scenarios?level=A2', $token);
        self::assertFalse($this->decodeResponse($client)[0]['locked']);
    }

    public function testCannotAccessAnotherUsersSession(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerAndGetTokenAtLevel($client, 'A1');
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
