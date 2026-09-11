<?php

namespace App\Tests\Service;

use App\Service\AiChatService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AiChatServiceTest extends TestCase
{
    public function testChatReturnsNullWithoutAnyHttpCallWhenNoApiKeyIsConfigured(): void
    {
        $client = new MockHttpClient(function (): never {
            self::fail('No HTTP request should be made without an API key.');
        });
        $service = new AiChatService($client, '', 'https://example.test/chat', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsTheTrimmedReplyContentOnSuccess(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => "  Sure, here's a reply.  "]]],
            ])),
        ]);
        $service = new AiChatService($client, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini');

        self::assertSame("Sure, here's a reply.", $service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsNullOnANetworkFailure(): void
    {
        $client = new MockHttpClient(function (): never {
            throw new TransportException('Connection timed out.');
        });
        $service = new AiChatService($client, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsNullOnANonSuccessHttpStatus(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode(['error' => ['message' => 'Invalid API key.']]), ['http_code' => 401]),
        ]);
        $service = new AiChatService($client, 'bad-key', 'https://example.test/chat', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsNullWhenTheResponseBodyHasNoUsableContent(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode(['choices' => []])),
        ]);
        $service = new AiChatService($client, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatLogsTimingOnSuccess(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'Sure.']]],
                'usage' => ['total_tokens' => 42],
            ])),
        ]);
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('info')->with(
            'ai_chat_call',
            self::callback(function (array $context): bool {
                self::assertSame('gpt-4o-mini', $context['model']);
                self::assertIsInt($context['totalMs']);
                self::assertIsInt($context['providerMs']);
                self::assertTrue($context['success']);
                self::assertSame(['total_tokens' => 42], $context['usage']);

                return true;
            }),
        );
        $service = new AiChatService($client, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini', $logger);

        $service->chat([['role' => 'user', 'content' => 'Hi']]);
    }

    public function testChatLogsTimingOnNetworkFailure(): void
    {
        $client = new MockHttpClient(function (): never {
            throw new TransportException('Connection timed out.');
        });
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('info')->with(
            'ai_chat_call',
            self::callback(function (array $context): bool {
                self::assertIsInt($context['totalMs']);
                self::assertNull($context['providerMs']); // never reached toArray()
                self::assertFalse($context['success']);

                return true;
            }),
        );
        $service = new AiChatService($client, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini', $logger);

        $service->chat([['role' => 'user', 'content' => 'Hi']]);
    }
}
