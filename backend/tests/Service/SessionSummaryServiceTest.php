<?php

namespace App\Tests\Service;

use App\Service\AiChatService;
use App\Service\CecrlProfileService;
use App\Service\SessionSummaryService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class SessionSummaryServiceTest extends TestCase
{
    private const HISTORY = [
        ['role' => 'assistant', 'content' => "Hello! I'm the waiter. What would you like to order?"],
        ['role' => 'user', 'content' => "I would like a coffee, please."],
        ['role' => 'assistant', 'content' => 'Sure! Anything else?'],
        ['role' => 'user', 'content' => 'No, that is all, thank you.'],
    ];

    private function serviceWithAiResponse(string $rawContent): SessionSummaryService
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode(['choices' => [['message' => ['content' => $rawContent]]]])),
        ]);

        return new SessionSummaryService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );
    }

    private function serviceWithNoApiKey(): SessionSummaryService
    {
        return new SessionSummaryService(
            new AiChatService(new MockHttpClient(), '', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );
    }

    public function testParsesAWellFormedAiResponseForANormalSessionWithSeveralExchanges(): void
    {
        $service = $this->serviceWithAiResponse(json_encode([
            'summary' => 'You practiced ordering a drink at a café and closed the conversation politely.',
            'strengths' => ['Used "please" and "thank you" naturally', 'Answered in full sentences'],
            'reviewPoints' => ['Try adding a bit more detail to your requests'],
            'usefulExpressions' => ['I would like...', 'that is all, thank you'],
            'nextStep' => 'Try a similar restaurant scenario next.',
        ]));

        $result = $service->summarize(self::HISTORY, 'A2', 2, 'Commander au café');

        self::assertSame('You practiced ordering a drink at a café and closed the conversation politely.', $result['summary']);
        self::assertCount(2, $result['strengths']);
        self::assertSame(['I would like...', 'that is all, thank you'], $result['usefulExpressions']);
        self::assertSame('Try a similar restaurant scenario next.', $result['nextStep']);
    }

    public function testNeverProducesANumericOrPercentScoreField(): void
    {
        $service = $this->serviceWithAiResponse(json_encode([
            'summary' => 'Good short exchange.',
            'strengths' => ['Clear pronunciation of key words'],
            'reviewPoints' => [],
            'usefulExpressions' => [],
            'nextStep' => 'Keep practicing.',
        ]));

        $result = $service->summarize(self::HISTORY, 'B1', 2, 'Commander au café');

        self::assertArrayNotHasKey('score', $result);
        self::assertArrayNotHasKey('pronunciationScore', $result);
        self::assertArrayNotHasKey('grammarScore', $result);
        self::assertArrayNotHasKey('vocabularyScore', $result);
    }

    public function testClampsEachListToTheLevelsSummaryDepthEvenIfTheAiReturnsMore(): void
    {
        // A0's summaryDepth is strengths=1, reviewPoints=1, expressions=2 (CecrlProfileService).
        $service = $this->serviceWithAiResponse(json_encode([
            'summary' => 'Nice short chat.',
            'strengths' => ['Said hello', 'Answered clearly', 'Stayed on topic'],
            'reviewPoints' => ['Try longer answers', 'Use more vocabulary'],
            'usefulExpressions' => ['hello', 'thank you', 'goodbye', 'please'],
            'nextStep' => 'Try again tomorrow.',
        ]));

        $result = $service->summarize(self::HISTORY, 'A0', 2, 'Se présenter');

        self::assertCount(1, $result['strengths']);
        self::assertCount(1, $result['reviewPoints']);
        self::assertCount(2, $result['usefulExpressions']);
    }

    public function testFallsBackToADeterministicSummaryWithoutAnyLinguisticFeedbackWhenNoApiKeyIsConfigured(): void
    {
        $service = $this->serviceWithNoApiKey();

        $result = $service->summarize(self::HISTORY, 'A2', 2, 'Commander au café');

        self::assertSame('Session terminée. Tu as réalisé 2 échanges dans le scénario "Commander au café".', $result['summary']);
        self::assertSame([], $result['strengths']);
        self::assertSame([], $result['reviewPoints']);
        self::assertSame([], $result['usefulExpressions']);
        self::assertNotSame('', $result['nextStep']);
    }

    public function testFallsBackWhenTheAiReturnsMalformedJson(): void
    {
        $service = $this->serviceWithAiResponse('this is not json at all');

        $result = $service->summarize(self::HISTORY, 'B1', 2, 'Commander au café');

        self::assertStringContainsString('Session terminée', $result['summary']);
        self::assertSame([], $result['strengths']);
    }

    public function testFallsBackWhenTheAiJsonIsMissingTheSummaryField(): void
    {
        $service = $this->serviceWithAiResponse(json_encode([
            'strengths' => ['Something'],
            'reviewPoints' => [],
            'usefulExpressions' => [],
            'nextStep' => 'Continue.',
        ]));

        $result = $service->summarize(self::HISTORY, 'B1', 2, 'Commander au café');

        self::assertStringContainsString('Session terminée', $result['summary']);
    }

    public function testStripsAMarkdownCodeFenceAroundTheJsonDefensively(): void
    {
        $service = $this->serviceWithAiResponse("```json\n".json_encode([
            'summary' => 'Fenced but still valid JSON.',
            'strengths' => [],
            'reviewPoints' => [],
            'usefulExpressions' => [],
            'nextStep' => 'Keep going.',
        ])."\n```");

        $result = $service->summarize(self::HISTORY, 'B1', 2, 'Commander au café');

        self::assertSame('Fenced but still valid JSON.', $result['summary']);
    }

    public function testSkipsTheAiCallEntirelyAndUsesADeterministicSummaryWhenThereWereNoExchanges(): void
    {
        $mockClient = new MockHttpClient(function (): never {
            self::fail('No AI call should be made when there is nothing to analyze.');
        });
        $service = new SessionSummaryService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );

        $result = $service->summarize([], 'A1', 0, 'Se présenter');

        self::assertStringContainsString('sans échange', $result['summary']);
        self::assertSame([], $result['strengths']);
    }

    public function testNeverMentionsPronunciationInTheDeterministicFallback(): void
    {
        $service = $this->serviceWithNoApiKey();

        $result = $service->summarize(self::HISTORY, 'A0', 3, 'Se présenter');

        self::assertStringNotContainsStringIgnoringCase('pronunciation', $result['summary']);
        self::assertStringNotContainsStringIgnoringCase('accent', $result['summary']);
    }
}
