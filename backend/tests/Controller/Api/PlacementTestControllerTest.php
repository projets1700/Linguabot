<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class PlacementTestControllerTest extends ApiTestCase
{
    public function testStartCreatesATestWithAnOpeningQuestion(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);

        self::assertResponseStatusCodeSame(201);
        $data = $this->decodeResponse($client);
        self::assertSame('in_progress', $data['status']);
        self::assertSame(5, $data['totalQuestions']);
        self::assertSame(0, $data['answeredCount']);
        self::assertCount(1, $data['messages']);
        self::assertSame('assistant', $data['messages'][0]['role']);
    }

    public function testStartTwiceResumesTheSameTestInsteadOfCreatingAnother(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        $firstId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        self::assertResponseStatusCodeSame(200);
        self::assertSame($firstId, $this->decodeResponse($client)['id']);
    }

    public function testFullConversationSetsTheUserLevelAndCompletesTheTest(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        $testId = $this->decodeResponse($client)['id'];

        // Deliberately long, elaborate answers so the simulated heuristic
        // (average words per answer) places this learner above A0.
        $answer = 'I usually wake up early, have a big breakfast, and then go to work by train while listening to podcasts about history.';

        for ($i = 0; $i < 4; $i++) {
            $this->jsonRequest($client, 'POST', "/api/placement-test/{$testId}/message", $token, ['message' => $answer]);
            self::assertResponseIsSuccessful();
            $data = $this->decodeResponse($client);
            self::assertFalse($data['readyToFinish']);
        }

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$testId}/message", $token, ['message' => $answer]);
        $lastMessageData = $this->decodeResponse($client);
        self::assertTrue($lastMessageData['readyToFinish']);
        self::assertSame(5, $lastMessageData['answeredCount']);

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$testId}/finish", $token);
        self::assertResponseIsSuccessful();
        $result = $this->decodeResponse($client);
        self::assertArrayHasKey('level', $result);
        self::assertNotSame('A0', $result['level']['code']);

        $this->jsonRequest($client, 'GET', '/api/me', $token);
        $me = $this->decodeResponse($client);
        self::assertTrue($me['placementTestCompleted']);
        self::assertSame($result['level']['code'], $me['level']['code']);
    }

    public function testFinishBeforeAnsweringAllQuestionsIsRejected(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        $testId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$testId}/message", $token, ['message' => 'Hi there']);

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$testId}/finish", $token);
        self::assertResponseStatusCodeSame(422);
    }

    public function testMessageThatEchoesTheAisOwnQuestionIsRejected(): void
    {
        // Regression: a real user's placement test got filled with garbage
        // like "what did you do last weekend" as their own "answer" - the
        // mic picking the AI's own voice back up through the speakers
        // rather than being stopped while it talked.
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        $test = $this->decodeResponse($client);
        $opening = $test['messages'][0]['content'];

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$test['id']}/message", $token, ['message' => $opening]);

        self::assertResponseStatusCodeSame(422);

        // Rejected as an echo, not counted as a real (wasted) answer.
        $this->jsonRequest($client, 'GET', "/api/placement-test/{$test['id']}", $token);
        self::assertSame(0, $this->decodeResponse($client)['answeredCount']);
    }

    public function testAskingToRepeatReSaysTheSameQuestionWithoutCountingAsAnAnswer(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        $test = $this->decodeResponse($client);
        $firstQuestion = $test['messages'][0]['content'];

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$test['id']}/message", $token, ['message' => "Sorry, can you repeat that?"]);

        self::assertResponseIsSuccessful();
        $repeatResult = $this->decodeResponse($client);
        self::assertStringContainsString($firstQuestion, $repeatResult['assistantMessage']);
        self::assertSame(0, $repeatResult['answeredCount']);
        self::assertFalse($repeatResult['readyToFinish']);

        // Nothing was persisted for the repeat request.
        $this->jsonRequest($client, 'GET', "/api/placement-test/{$test['id']}", $token);
        $refreshed = $this->decodeResponse($client);
        self::assertSame(0, $refreshed['answeredCount']);
        self::assertCount(1, $refreshed['messages']);

        // A real answer right after still works normally.
        $this->jsonRequest($client, 'POST', "/api/placement-test/{$test['id']}/message", $token, ['message' => 'My name is Adam and I live in Paris.']);
        self::assertResponseIsSuccessful();
        self::assertSame(1, $this->decodeResponse($client)['answeredCount']);
    }

    public function testBlockedAcknowledgmentIsPrependedWithoutRevealingAnAnswerOrChangingProgression(): void
    {
        // The placement test is a graded evaluation (see
        // PlacementTestService::BLOCKED_ACKNOWLEDGMENT) - a blocked turn may
        // get a warm acknowledgment, but must never reveal/hint an answer,
        // and must advance exactly like any other answered turn.
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $token);
        $test = $this->decodeResponse($client);

        $this->jsonRequest($client, 'POST', "/api/placement-test/{$test['id']}/message", $token, [
            'message' => "I don't know.",
            'learnerBlocked' => true,
        ]);

        self::assertResponseIsSuccessful();
        $data = $this->decodeResponse($client);
        self::assertStringStartsWith("That's okay, let's continue.", $data['assistantMessage']);
        self::assertSame(1, $data['answeredCount']);
        self::assertFalse($data['readyToFinish']);

        // A normal (non-blocked) turn right after is completely unaffected.
        $this->jsonRequest($client, 'POST', "/api/placement-test/{$test['id']}/message", $token, [
            'message' => 'My name is Adam and I live in Paris.',
        ]);
        self::assertResponseIsSuccessful();
        self::assertStringNotContainsString("That's okay, let's continue.", $this->decodeResponse($client)['assistantMessage']);
    }

    public function testMessageOnAnotherUsersTestIsForbidden(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerAndGetToken($client);
        $this->jsonRequest($client, 'POST', '/api/placement-test/start', $ownerToken);
        $testId = $this->decodeResponse($client)['id'];

        $intruderToken = $this->registerAndGetToken($client);
        $this->jsonRequest($client, 'POST', "/api/placement-test/{$testId}/message", $intruderToken, ['message' => 'Hi']);
        self::assertResponseStatusCodeSame(403);
    }

    public function testMeReflectsPlacementTestNotCompletedRightAfterRegistration(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/me', $token);
        $me = $this->decodeResponse($client);

        self::assertFalse($me['placementTestCompleted']);
    }
}
