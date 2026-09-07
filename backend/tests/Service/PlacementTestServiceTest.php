<?php

namespace App\Tests\Service;

use App\Service\AiChatService;
use App\Service\PlacementTestService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PlacementTestServiceTest extends TestCase
{
    private PlacementTestService $service;

    protected function setUp(): void
    {
        // Empty API key: evaluateLevel() always falls through to the
        // word-count heuristic in these tests (the AI path is covered
        // separately, with a mocked response).
        $this->service = new PlacementTestService(new AiChatService(new MockHttpClient(), '', 'https://example.test/chat', 'gpt-4o-mini'));
    }

    public function testTotalQuestionsMatchesTheScript(): void
    {
        self::assertSame(5, $this->service->totalQuestions());
    }

    public function testNextQuestionCyclesThroughTheFixedScriptThenReturnsNull(): void
    {
        self::assertNotNull($this->service->nextQuestion(0));
        self::assertNotNull($this->service->nextQuestion(4));
        self::assertNull($this->service->nextQuestion(5));
    }

    public function testEvaluateLevelWithNoAnswersDefaultsToA0(): void
    {
        self::assertSame('A0', $this->service->evaluateLevel([]));
    }

    #[DataProvider('answerLengthProvider')]
    public function testEvaluateLevelFallsBackToBucketingByAverageWordsPerAnswerWithNoApiKey(array $answers, string $expectedLevel): void
    {
        self::assertSame($expectedLevel, $this->service->evaluateLevel($answers));
    }

    public function testEvaluateLevelUsesTheRealAiJudgementWhenTheApiCallSucceeds(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'B1']]],
            ])),
        ]);
        $service = new PlacementTestService(new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'));

        // Deliberately short answers that the word-count heuristic alone
        // would bucket as A0 - if this comes back B1, the real AI path (not
        // the fallback) is what actually produced the result.
        self::assertSame('B1', $service->evaluateLevel(['Yes', 'No', 'Ok', 'Sure', 'Fine']));
    }

    public function testEvaluateLevelFallsBackWhenTheAiResponseHasNoRecognizableLevelCode(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => "I'm not sure, hard to tell."]]],
            ])),
        ]);
        $service = new PlacementTestService(new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'));

        self::assertSame('A0', $service->evaluateLevel(['Hi', 'Ok']));
    }

    public static function answerLengthProvider(): array
    {
        return [
            'very short, one or two words' => [['Hi', 'Ok fine'], 'A0'],
            'short sentences, ~5 words' => [['My name is Adam', 'I live in Paris'], 'A1'],
            'moderate sentences, ~10 words' => [['I usually wake up early and have breakfast at home'], 'A2'],
            'longer sentences, ~16 words' => [['Last weekend I went hiking with some friends and it was really a great experience overall'], 'B1'],
            'long, detailed answers, ~27 words' => [['I faced a difficult challenge at work last year when our main project failed unexpectedly and I had to rebuild the entire plan from scratch under pressure'], 'B2'],
        ];
    }
}
