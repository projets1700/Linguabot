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

    public function testMessageWorksNormallyWhenTheLearnerIsNotBlocked(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, [
            'message' => 'I usually eat eggs and toast for breakfast.',
            'learnerBlocked' => false,
        ]);

        self::assertResponseIsSuccessful();
        self::assertNotEmpty($this->decodeResponse($client)['assistantMessage']);
    }

    public function testMessageUsesTheGenericBlockedFallbackWhenTheLearnerIsFlaggedAsBlocked(): void
    {
        // AI_API_KEY is forced empty in the test env, so this exercises
        // VoiceService's fallback path - now deterministic for a blocked
        // turn (BLOCKED_FALLBACK_REPLY, see VoiceServiceTest for the unit
        // coverage), unlike the ordinary cycling pool, so this can assert
        // the exact reply rather than just "something came back".
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, [
            'message' => "I don't know.",
            'learnerBlocked' => true,
        ]);

        self::assertResponseIsSuccessful();
        $result = $this->decodeResponse($client);
        self::assertSame("I don't know.", $result['userTranscript']);
        self::assertSame('No problem! Try giving a short, simple answer - even one sentence is fine.', $result['assistantMessage']);
    }

    public function testMessageDefaultsLearnerBlockedToFalseWhenTheFieldIsOmitted(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        // No learnerBlocked key at all - older/other clients must keep working.
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, ['message' => 'Hello!']);

        self::assertResponseIsSuccessful();
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

    public function testFinishReturnsABilanWithCorrectObjectiveDataAndTheDeterministicFallbackSummary(): void
    {
        // AI_API_KEY is forced empty in the test env (phpunit.dist.xml), so
        // this also exercises SessionSummaryService's fallback path - the
        // same one used when Groq/OpenAI is genuinely unavailable in prod.
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, ['message' => 'Hello there!']);
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, ['message' => "I'd like a table for two, please."]);

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        self::assertResponseIsSuccessful();
        $result = $this->decodeResponse($client);

        self::assertArrayHasKey('summary', $result);
        $summary = $result['summary'];
        self::assertSame(2, $summary['exchangeCount']);
        self::assertSame($result['xpEarned'], $summary['xpEarned']);
        self::assertSame('completed', $summary['status']);
        self::assertNotEmpty($summary['scenarioTitle']);
        self::assertStringContainsString('Session terminée', $summary['summary']);
        self::assertStringContainsString('2 échanges', $summary['summary']);
        self::assertSame([], $summary['strengths']);
        self::assertSame([], $summary['reviewPoints']);
        self::assertSame([], $summary['usefulExpressions']);
        self::assertNotEmpty($summary['nextStep']);

        // No invented linguistic score anywhere in the bilan.
        self::assertArrayNotHasKey('grammarScore', $summary);
        self::assertArrayNotHasKey('pronunciationScore', $summary);
        self::assertArrayNotHasKey('vocabularyScore', $summary);
    }

    public function testBilanIsPersistedAndReturnedAgainOnAFreshGetAfterFinish(): void
    {
        // P2 stabilization fix: the bilan used to exist only in finish()'s
        // own HTTP response - a learner refreshing the page or revisiting
        // the session afterwards saw the live conversation UI again with no
        // way to see the summary a second time.
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/message", $token, ['message' => 'Hello there!']);

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        $finishResult = $this->decodeResponse($client);

        // Simulates a page refresh: a brand new GET, no state carried over
        // from the finish() call above beyond the session id in the URL.
        $this->jsonRequest($client, 'GET', "/api/sessions/{$sessionId}", $token);
        self::assertResponseIsSuccessful();
        $reloaded = $this->decodeResponse($client);

        self::assertSame('completed', $reloaded['status']);
        self::assertNotNull($reloaded['summary']);
        self::assertSame($finishResult['summary']['summary'], $reloaded['summary']['summary']);
        self::assertSame($finishResult['summary']['nextStep'], $reloaded['summary']['nextStep']);
        self::assertSame($finishResult['summary']['xpEarned'], $reloaded['summary']['xpEarned']);
    }

    public function testInProgressSessionHasNoSummaryYet(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'GET', "/api/sessions/{$sessionId}", $token);

        self::assertNull($this->decodeResponse($client)['summary']);
    }

    public function testFinishWithNoExchangesAtAllStillReturnsASoberBilanInsteadOfInventingOne(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        // Finish immediately, without ever sending a message.
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/finish", $token);
        self::assertResponseIsSuccessful();
        $summary = $this->decodeResponse($client)['summary'];

        self::assertSame(0, $summary['exchangeCount']);
        self::assertStringContainsString('sans échange', $summary['summary']);
        self::assertSame([], $summary['strengths']);
    }

    public function testFinishBilanWorksAtTheLowestAndHighestCecrlLevels(): void
    {
        $client = static::createClient();

        $a1Token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $a1ScenarioId = $this->findAnyScenarioId($client, $a1Token);
        $this->jsonRequest($client, 'POST', "/api/scenarios/{$a1ScenarioId}/sessions", $a1Token);
        $a1SessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/sessions/{$a1SessionId}/message", $a1Token, ['message' => 'Hi!']);
        $this->jsonRequest($client, 'POST', "/api/sessions/{$a1SessionId}/finish", $a1Token);
        $a1Summary = $this->decodeResponse($client)['summary'];
        self::assertSame(1, $a1Summary['exchangeCount']);

        $b2Token = $this->registerAndGetTokenAtLevel($client, 'B2');
        $b2ScenarioId = $this->findAnyScenarioId($client, $b2Token);
        $this->jsonRequest($client, 'POST', "/api/scenarios/{$b2ScenarioId}/sessions", $b2Token);
        $b2SessionId = $this->decodeResponse($client)['id'];
        $this->jsonRequest($client, 'POST', "/api/sessions/{$b2SessionId}/message", $b2Token, ['message' => 'Good morning!']);
        $this->jsonRequest($client, 'POST', "/api/sessions/{$b2SessionId}/finish", $b2Token);
        $b2Summary = $this->decodeResponse($client)['summary'];
        self::assertSame(1, $b2Summary['exchangeCount']);
        self::assertSame('completed', $b2Summary['status']);
    }

    public function testSessionResponseExposesTheLearnersCecrlProfile(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'B2');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $session = $this->decodeResponse($client);

        // B2 is the least-assisted profile (CecrlProfileService): transcript
        // hidden by default, translation off by default.
        self::assertSame('onDemand', $session['cecrlProfile']['transcriptMode']);
        self::assertSame('off', $session['cecrlProfile']['translationMode']);
    }

    public function testHintIsAvailableOnRequestRegardlessOfLevel(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'B2');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/hint", $token, ['tier' => 1]);

        self::assertResponseIsSuccessful();
        $hint = $this->decodeResponse($client);
        self::assertSame(1, $hint['tier']);
        self::assertNotEmpty($hint['content']);
    }

    public function testHintRejectsAnOutOfRangeTier(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/hint", $token, ['tier' => 7]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testTranslateReturnsAFrenchTranslationField(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $token);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $token);
        $sessionId = $this->decodeResponse($client)['id'];

        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/translate", $token, ['text' => 'What is your name?']);

        self::assertResponseIsSuccessful();
        self::assertNotEmpty($this->decodeResponse($client)['translation']);
    }

    public function testCannotRequestAHintForAnotherUsersSession(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerAndGetTokenAtLevel($client, 'A1');
        $scenarioId = $this->findAnyScenarioId($client, $ownerToken);

        $this->jsonRequest($client, 'POST', "/api/scenarios/{$scenarioId}/sessions", $ownerToken);
        $sessionId = $this->decodeResponse($client)['id'];

        $intruderToken = $this->registerAndGetToken($client);
        $this->jsonRequest($client, 'POST', "/api/sessions/{$sessionId}/hint", $intruderToken, ['tier' => 1]);

        self::assertResponseStatusCodeSame(403);
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
