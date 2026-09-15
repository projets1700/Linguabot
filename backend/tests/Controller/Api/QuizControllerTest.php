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

    public function testModulesListShowsAllSixUnpassedAndUnattempted(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);

        self::assertResponseIsSuccessful();
        $body = $this->decodeResponse($client);
        self::assertCount(6, $body['modules']);
        foreach ($body['modules'] as $module) {
            self::assertFalse($module['passed']);
            self::assertFalse($module['attempted']);
            self::assertNull($module['bestScore']);
        }
    }

    public function testModulesResponseExposesTheRealPassAndUnlockRules(): void
    {
        // These used to be private QuizService constants the frontend had no
        // way to know - now surfaced read-only so it can show real numbers
        // instead of hardcoding 7/4/"A1".
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);

        self::assertResponseIsSuccessful();
        $body = $this->decodeResponse($client);
        self::assertSame(7, $body['passThreshold']);
        self::assertSame(4, $body['requiredForLevelUp']);
        self::assertSame('A1', $body['targetLevelCode']);
    }

    public function testAttemptedButFailedModuleReportsBestScoreWithoutBeingPassed(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);

        // Only the first 3 answers correct - well under the 7-correct pass
        // threshold, so this attempt fails but is still real and recorded.
        $answers = [];
        foreach ($questions as $index => $question) {
            $answers[(string) $question['id']] = $index < 3 ? self::M0_1_ANSWERS[$index] : 'wrong';
        }

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answers,
        ]);
        self::assertResponseStatusCodeSame(201);
        self::assertSame(3, $this->decodeResponse($client)['score']);
        self::assertFalse($this->decodeResponse($client)['passed']);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        $module = $this->findModuleInList($client, 'M0-1');

        self::assertTrue($module['attempted']);
        self::assertFalse($module['passed']);
        self::assertSame(3, $module['bestScore']);
    }

    public function testBestScoreReflectsTheHighestOfSeveralAttemptsIncludingAfterPassing(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');
        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);

        $answersScoring = function (int $correctCount) use ($questions): array {
            $answers = [];
            foreach ($questions as $index => $question) {
                $answers[(string) $question['id']] = $index < $correctCount ? self::M0_1_ANSWERS[$index] : 'wrong';
            }

            return $answers;
        };

        // Attempt 1: fails with a low score.
        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answersScoring(3),
        ]);
        self::assertSame(3, $this->decodeResponse($client)['score']);

        // Attempt 2: still fails, but scores higher - bestScore must follow
        // the highest attempt, not just the most recent one.
        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answersScoring(6),
        ]);
        self::assertSame(6, $this->decodeResponse($client)['score']);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        $module = $this->findModuleInList($client, 'M0-1');
        self::assertFalse($module['passed']);
        self::assertTrue($module['attempted']);
        self::assertSame(6, $module['bestScore']);

        // Attempt 3: a full pass. bestScore now reflects the perfect score,
        // and passed flips to true.
        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answersScoring(10),
        ]);
        self::assertSame(10, $this->decodeResponse($client)['score']);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        $module = $this->findModuleInList($client, 'M0-1');
        self::assertTrue($module['passed']);
        self::assertSame(10, $module['bestScore']);
    }

    public function testReplayingAnAlreadyPassedModuleKeepsItPassedEvenIfTheRetryScoresLower(): void
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
        self::assertTrue($this->decodeResponse($client)['passed']);

        // Replay with a deliberately weaker attempt (still >= 7, module
        // scoring/XP rules themselves are untouched by this task).
        $weakerAnswers = $answers;
        $lastQuestionId = (string) $questions[9]['id'];
        $weakerAnswers[$lastQuestionId] = 'wrong';
        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $weakerAnswers,
        ]);
        self::assertSame(9, $this->decodeResponse($client)['score']);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        $module = $this->findModuleInList($client, 'M0-1');
        self::assertTrue($module['passed']);
        self::assertTrue($module['attempted']);
        // Best score still remembers the earlier perfect attempt.
        self::assertSame(10, $module['bestScore']);
    }

    public function testModulesListIsEmptyForALearnerAboveA1(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'B1');

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);

        self::assertResponseIsSuccessful();
        $body = $this->decodeResponse($client);
        self::assertSame([], $body['modules']);
        // The pass/unlock rules are still returned even when the module list
        // is empty - a page rendered before redirecting away can rely on a
        // consistent response shape either way.
        self::assertSame(7, $body['passThreshold']);
    }

    public function testModulesListAndAttemptStillWorkForAnA1Learner(): void
    {
        // A1 learners just unlocked past the vocabulary test (see
        // testFourthPassedModuleUnlocksLevelA1 below) but can still revisit
        // it - only A2 and above have moved on far enough that it's hidden.
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'A1');

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        self::assertResponseIsSuccessful();
        $modules = $this->decodeResponse($client)['modules'];
        self::assertCount(6, $modules);

        $moduleId = $this->findModuleId($client, $token, 'M0-1');
        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        self::assertResponseIsSuccessful();
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
        self::assertSame(10, $this->decodeResponse($client)['score']);
    }

    public function testAttemptsIsRejectedForALearnerAboveA1EvenWithAGuessedModuleId(): void
    {
        $client = static::createClient();
        $a0Token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $a0Token, 'M0-1');

        $token = $this->registerAndGetTokenAtLevel($client, 'B1');

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => [],
        ]);

        self::assertResponseStatusCodeSame(403);
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
        // to a question answered without help. The submission itself never
        // lists which question was helped (that used to be a client-trusted
        // "helpedQuestionIds" field, now removed) - the server already knows,
        // from having served that GET request itself.
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $token, 'M0-1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        $questions = $this->decodeResponse($client);

        $answers = [];
        foreach ($questions as $index => $question) {
            $answers[(string) $question['id']] = self::M0_1_ANSWERS[$index];
        }

        $this->jsonRequest($client, 'GET', "/api/quiz/questions/{$questions[0]['id']}/answer", $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'POST', '/api/quiz/attempts', $token, [
            'moduleId' => $moduleId,
            'answers' => $answers,
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

    public function testASubmittedHelpedQuestionIdsFieldHasNoEffect(): void
    {
        // Audit A6: helpedQuestionIds used to be entirely client-supplied -
        // a client could call answer() to see a question's correct answer,
        // then simply not list its id here to still score the point. It's
        // now ignored entirely: the previous test proves the server catches
        // a real reveal on its own; this one proves the field itself, even
        // when present, can no longer grant a point back (nor cost one for
        // a question that was never actually revealed).
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
            // Never actually revealed via GET .../answer - listing it here
            // must not zero the point either.
            'helpedQuestionIds' => [$questions[0]['id']],
        ]);

        self::assertResponseStatusCodeSame(201);
        self::assertSame(10, $this->decodeResponse($client)['score']);
    }

    public function testQuestionsListAndAnswerRevealAreRejectedForALearnerAboveA1(): void
    {
        $client = static::createClient();
        $a0Token = $this->registerAndGetToken($client);
        $moduleId = $this->findModuleId($client, $a0Token, 'M0-1');
        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $a0Token);
        $questionId = $this->decodeResponse($client)[0]['id'];

        $token = $this->registerAndGetTokenAtLevel($client, 'B1');

        $this->jsonRequest($client, 'GET', "/api/quiz/modules/{$moduleId}/questions", $token);
        self::assertResponseStatusCodeSame(403);

        $this->jsonRequest($client, 'GET', "/api/quiz/questions/{$questionId}/answer", $token);
        self::assertResponseStatusCodeSame(403);
    }

    public function testFourthPassedModuleUnlocksLevelA1(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/quiz/modules', $token);
        $modules = $this->decodeResponse($client)['modules'];

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
        foreach ($this->decodeResponse($client)['modules'] as $module) {
            if ($module['code'] === $code) {
                return $module['id'];
            }
        }

        self::fail("Quiz module {$code} not found - are fixtures loaded in the test database?");
    }

    /**
     * Reads a module's full entry (id/code/title/questionCount/passed/
     * attempted/bestScore) from the response of a GET /api/quiz/modules call
     * already made on $client - unlike findModuleId(), does not re-request.
     *
     * @return array{id: int, code: string, title: string, questionCount: int, passed: bool, attempted: bool, bestScore: int|null}
     */
    private function findModuleInList(mixed $client, string $code): array
    {
        foreach ($this->decodeResponse($client)['modules'] as $module) {
            if ($module['code'] === $code) {
                return $module;
            }
        }

        self::fail("Quiz module {$code} not found in the last /api/quiz/modules response.");
    }
}
