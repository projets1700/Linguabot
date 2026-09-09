<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class DailyChallengeControllerTest extends ApiTestCase
{
    public function testFullChallengeLifecycle(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client); // fresh user is level A0

        $this->jsonRequest($client, 'GET', '/api/daily-challenge', $token);
        self::assertResponseIsSuccessful();
        $challenge = $this->decodeResponse($client);
        self::assertFalse($challenge['started']);
        self::assertFalse($challenge['completed']);
        self::assertSame(60, $challenge['xpReward']); // A0 base 30 * 2 (CDCF: XP du niveau x2)
        self::assertCount(3, $challenge['keywords']);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/start', $token);
        self::assertResponseStatusCodeSame(201);
        self::assertNotEmpty($this->decodeResponse($client)['openingMessage']);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/message', $token, ['message' => 'Hello!', 'turnNumber' => 0]);
        self::assertResponseIsSuccessful();
        self::assertNotEmpty($this->decodeResponse($client)['assistantMessage']);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/finish', $token);
        self::assertResponseIsSuccessful();
        $result = $this->decodeResponse($client);
        self::assertSame(60, $result['xpEarned']);
        self::assertSame(60, $result['userTotalXp']);

        // Second GET should now report completed=true without re-generating.
        $this->jsonRequest($client, 'GET', '/api/daily-challenge', $token);
        self::assertTrue($this->decodeResponse($client)['completed']);
    }

    public function testMessageThatEchoesTheAisOwnLastLineIsRejectedWhenHistoryIsProvided(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/start', $token);
        $opening = $this->decodeResponse($client)['openingMessage'];

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/message', $token, [
            'message' => $opening,
            'turnNumber' => 0,
            'history' => [['role' => 'assistant', 'content' => $opening]],
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testAskingToRepeatReSaysTheAisLastLineWhenHistoryIsProvided(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/start', $token);
        $opening = $this->decodeResponse($client)['openingMessage'];

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/message', $token, [
            'message' => 'Sorry, can you repeat that?',
            'turnNumber' => 0,
            'history' => [['role' => 'assistant', 'content' => $opening]],
        ]);

        self::assertResponseIsSuccessful();
        self::assertStringContainsString($opening, $this->decodeResponse($client)['assistantMessage']);
    }

    public function testMessageUsesTheGenericBlockedFallbackWhenTheLearnerIsFlaggedAsBlocked(): void
    {
        // AI_API_KEY is forced empty in the test env, so this exercises
        // VoiceService's fallback path - deterministic for a blocked turn
        // (BLOCKED_FALLBACK_REPLY), same behavior as SessionController's
        // /message now that both build their level instruction via
        // CecrlProfileService::buildConversationInstruction().
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/start', $token);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/message', $token, [
            'message' => "I don't know.",
            'turnNumber' => 0,
            'learnerBlocked' => true,
        ]);

        self::assertResponseIsSuccessful();
        self::assertSame(
            'No problem! Try giving a short, simple answer - even one sentence is fine.',
            $this->decodeResponse($client)['assistantMessage'],
        );
    }

    public function testChallengeResponseExposesTheLearnersCecrlProfile(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client); // fresh user is level A0

        $this->jsonRequest($client, 'GET', '/api/daily-challenge', $token);

        $challenge = $this->decodeResponse($client);
        self::assertSame('auto', $challenge['cecrlProfile']['transcriptMode']);
        self::assertSame('visible', $challenge['cecrlProfile']['translationMode']);
    }

    public function testHintIsAvailableOnRequestWithHistorySuppliedByTheClient(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/hint', $token, [
            'tier' => 2,
            'history' => [['role' => 'assistant', 'content' => 'What would you like to order?']],
        ]);

        self::assertResponseIsSuccessful();
        $hint = $this->decodeResponse($client);
        self::assertSame(2, $hint['tier']);
        self::assertNotEmpty($hint['content']);
    }

    public function testTranslateReturnsAFrenchTranslationField(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/translate', $token, ['text' => 'What would you like to order?']);

        self::assertResponseIsSuccessful();
        self::assertNotEmpty($this->decodeResponse($client)['translation']);
    }

    public function testTranslateRejectsAnEmptyText(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/translate', $token, ['text' => '   ']);

        self::assertResponseStatusCodeSame(422);
    }

    public function testCannotFinishAChallengeThatWasNeverStarted(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/finish', $token);

        self::assertResponseStatusCodeSame(422);
    }

    public function testCannotFinishTheSameChallengeTwice(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/start', $token);
        $this->jsonRequest($client, 'POST', '/api/daily-challenge/finish', $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'POST', '/api/daily-challenge/finish', $token);
        self::assertResponseStatusCodeSame(422);
    }
}
