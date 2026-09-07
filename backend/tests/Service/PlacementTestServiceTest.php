<?php

namespace App\Tests\Service;

use App\Service\PlacementTestService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PlacementTestServiceTest extends TestCase
{
    private PlacementTestService $service;

    protected function setUp(): void
    {
        $this->service = new PlacementTestService();
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
    public function testEvaluateLevelBucketsByAverageWordsPerAnswer(array $answers, string $expectedLevel): void
    {
        self::assertSame($expectedLevel, $this->service->evaluateLevel($answers));
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
