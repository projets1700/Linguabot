<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class QuizControllerTest extends ApiTestCase
{
    private const M0_1_ANSWERS = [
        'hello', 'goodbye', 'thank you', 'please', 'good night',
        'how are you', 'nice to meet you', 'see you soon', 'excuse me', 'good evening',
    ];

    /**
     * Real answer banks per module (QuizFixtures), keyed by module code -
     * unlike M0-1, these are only needed for the multi-module unlock test.
     */
    private const ANSWERS_BY_MODULE_CODE = [
        'M0-1' => self::M0_1_ANSWERS,
        'M0-2' => ['one', 'two', 'three', 'four', 'five', 'ten', 'twenty', 'one hundred', 'zero', 'one thousand'],
        'M0-3' => ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'pink', 'grey'],
        'M0-4' => ['mother', 'father', 'brother', 'sister', 'daughter', 'son', 'grandmother', 'grandfather', 'cousin', 'child'],
    ];

    public function testModulesListShowsAllSixUnpassed(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);

        self::assertResponseIsSuccessful();
        $modules = $this->decodeResponse($client);
        self::assertCount(6, $modules);
        foreach ($modules as $module) {
            self::assertFalse($module['passed']);
        }
    }

    public function testQuestionsListNeverExposesTheCorrectAnswer(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);

        self::assertResponseIsSuccessful();
        $questions = $this->decodeResponse($client);
        self::assertCount(10, $questions);
        foreach ($questions as $question) {
            self::assertArrayHasKey('questionText', $question);
            self::assertArrayNotHasKey('correctAnswer', $question);
        }
    }

    public function testPerfectAttemptScoresTenAndAwardsModuleBonus(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);

        $answers = [];
        foreach ($questions as $index => $question) {
            $answers[(string) $question['id']] = self::M0_1_ANSWERS[$index];
        }

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answers,
        ]);

        self::assertResponseStatusCodeSame(201);
        $result = $this->decodeResponse($client);

        self::assertSame(10, $result['score']);
        self::assertTrue($result['passed']);
        // 10 correct * 10 XP + 50 XP first-time module bonus (CDCF §3.6)
        self::assertSame(150, $result['xpEarned']);
        self::assertNull($result['levelUp']); // only 1 of the 4 required modules
    }

    public function testRetryingAnAlreadyPassedModuleEarnsNoAdditionalXp(): void
    {
        // Regression: XP_PER_CORRECT_ANSWER used to be credited on every
        // attempt regardless of $alreadyPassed - only the module bonus was
        // guarded - so replaying an already-passed module farmed unlimited
        // XP, 10 per correct answer every time.
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);

        $answers = [];
        foreach ($questions as $index => $question) {
            $answers[(string) $question['id']] = self::M0_1_ANSWERS[$index];
        }

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answers,
        ]);
        $firstResult = $this->decodeResponse($client);
        self::assertSame(150, $firstResult['xpEarned']);

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answers,
        ]);
        self::assertResponseStatusCodeSame(201);
        $secondResult = $this->decodeResponse($client);

        self::assertSame(10, $secondResult['score']);
        self::assertTrue($secondResult['passed']);
        self::assertSame(0, $secondResult['xpEarned'], 'A retry of an already-passed module must not earn any XP.');
    }

    public function testHelpedAnswerDoesNotScoreLikeAnUnaidedOne(): void
    {
        // P0 stabilization fix: revealing the correct answer after a
        // detected "I don't know" (GET /quiz/questions/{id}/answer) must not
        // let the learner then repeat it back and have it scored identically
        // to a question answered without help.
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);

        $answers = [];
        foreach ($questions as $index => $question) {
            $answers[(string) $question['id']] = self::M0_1_ANSWERS[$index];
        }
        $helpedQuestionId = $questions[0]['id'];

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answers,
            'helpedQuestionIds' => [$helpedQuestionId],
        ]);

        self::assertResponseStatusCodeSame(201);
        $result = $this->decodeResponse($client);

        // 9 correct-unaided answers, not 10: the helped one scores nothing
        // even though the repeated answer is objectively correct. Still
        // clears the 7-correct pass threshold on its own.
        self::assertSame(9, $result['score']);
        self::assertTrue($result['passed']);
        // 9 correct * 10 XP + 50 XP module bonus = 140, i.e. 10 XP less than
        // the 150 a fully-unaided perfect attempt earns (see the perfect-
        // attempt test above) - exactly the one helped question's share.
        self::assertSame(140, $result['xpEarned']);
    }

    public function testFourthPassedModuleUnlocksLevelA1(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        $modules = $this->decodeResponse($client);

        $lastResult = null;
        foreach (\array_slice($modules, 0, 4) as $module) {
            $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$module['id']}/questions", $token);
            $questions = $this->decodeResponse($client);

            $bank = self::ANSWERS_BY_MODULE_CODE[$module['code']]
                ?? self::fail("No answer bank for module {$module['code']} in this test.");

            $answers = [];
            foreach ($questions as $index => $question) {
                $answers[(string) $question['id']] = $bank[$index];
            }

            $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
                'moduleId' => $module['id'],
                'answers' => $answers,
            ]);
            $lastResult = $this->decodeResponse($client);
            self::assertTrue($lastResult['passed'], "Module {$module['code']} was expected to pass: ".json_encode($lastResult));
        }

        self::assertNotNull($lastResult['levelUp'], 'Expected the 4th passed module to trigger the A0->A1 unlock: '.json_encode($lastResult));
        self::assertSame('A1', $lastResult['levelUp']['code']);
        self::assertNotEmpty($lastResult['levelUp']['name']);
        self::assertSame('A1', $lastResult['userLevel']);
    }

    public function testAnswerEndpointRevealsTheCorrectAnswerForOneQuestionOnRequest(): void
    {
        // A separate, on-demand endpoint from questions() above (which must
        // keep never exposing correctAnswer in bulk) - this one exists
        // specifically for the frontend to call when detectLearnerBlock()
        // flags "I don't know", so the avatar can say "You can say: hello."
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);
        $firstQuestionId = $questions[0]['id'];

        $this->jsonRequest($client, 'GET', "/api/quiz/questions/{$firstQuestionId}/answer", $token);

        self::assertResponseIsSuccessful();
        self::assertSame('hello', $this->decodeResponse($client)['answer']);
    }

    private function findModuleId(mixed $client, string $token, string $code): int
    {
        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        foreach ($this->decodeResponse($client) as $module) {
            if ($module['code'] === $code) {
                return $module['id'];
            }
        }

        self::fail("Quiz module {$code} not found - are fixtures loaded in the test database?");
    }
}
