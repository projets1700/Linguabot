<?php

namespace App\Tests\Service;

use App\Service\AiChatService;
use App\Service\LearningAidService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class LearningAidServiceTest extends TestCase
{
    public function testHintFallsBackToAFrenchMessageWithNoApiKey(): void
    {
        $service = new LearningAidService(new AiChatService(new MockHttpClient(), '', 'https://example.test/chat', 'gpt-4o-mini'));

        $hint = $service->hint([['role' => 'assistant', 'content' => 'What is your name?']], 1);

        self::assertStringContainsString('indisponible', $hint);
    }

    public function testHintReturnsTheRealAiReplyWhenTheApiCallSucceeds(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'name, I am, my name']]],
            ])),
        ]);
        $service = new LearningAidService(new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'));

        $hint = $service->hint([['role' => 'assistant', 'content' => 'What is your name?']], 1);

        self::assertSame('name, I am, my name', $hint);
    }

    public function testHintPrependsTheLevelInstructionToTheSystemPromptSentToTheAi(): void
    {
        // Without this, a hint used to come back at the same vocabulary
        // complexity for an A0 beginner and a B2 advanced learner alike.
        $capturedMessages = null;
        $mockClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedMessages): MockResponse {
            $body = $options['body'] ?? null;
            $capturedMessages = json_decode(\is_string($body) ? $body : json_encode($options['json'] ?? []), true)['messages'] ?? [];

            return new MockResponse(json_encode(['choices' => [['message' => ['content' => 'a hint']]]]));
        });
        $service = new LearningAidService(new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'));

        $service->hint([['role' => 'assistant', 'content' => 'What is your name?']], 1, 'Speak very simply, CEFR A0 level.');

        self::assertStringContainsString('Speak very simply, CEFR A0 level.', $capturedMessages[0]['content']);
    }

    public function testHintWorksWithoutALevelInstruction(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode(['choices' => [['message' => ['content' => 'a hint']]]])),
        ]);
        $service = new LearningAidService(new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'));

        self::assertSame('a hint', $service->hint([['role' => 'assistant', 'content' => 'What is your name?']], 1));
    }

    public function testHintForAnUnknownTierFallsBackToTierOnesInstruction(): void
    {
        // No exception, no out-of-range access - just treated like tier 1.
        $service = new LearningAidService(new AiChatService(new MockHttpClient(), '', 'https://example.test/chat', 'gpt-4o-mini'));

        $hint = $service->hint([], 99);

        self::assertStringContainsString('indisponible', $hint);
    }

    public function testTranslateFallsBackToAFrenchMessageWithNoApiKey(): void
    {
        $service = new LearningAidService(new AiChatService(new MockHttpClient(), '', 'https://example.test/chat', 'gpt-4o-mini'));

        self::assertStringContainsString('indisponible', $service->translate('What is your name?'));
    }

    public function testTranslateReturnsTheRealAiReplyWhenTheApiCallSucceeds(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'Comment tu t\'appelles ?']]],
            ])),
        ]);
        $service = new LearningAidService(new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'));

        self::assertSame('Comment tu t\'appelles ?', $service->translate('What is your name?'));
    }
}
