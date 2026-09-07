<?php

namespace App\Tests\Service;

use App\Service\OpenAiChatService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class OpenAiChatServiceTest extends TestCase
{
    public function testChatReturnsNullWithoutAnyHttpCallWhenNoApiKeyIsConfigured(): void
    {
        $client = new MockHttpClient(function (): never {
            self::fail('No HTTP request should be made without an API key.');
        });
        $service = new OpenAiChatService($client, '', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsTheTrimmedReplyContentOnSuccess(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => "  Sure, here's a reply.  "]]],
            ])),
        ]);
        $service = new OpenAiChatService($client, 'fake-key', 'gpt-4o-mini');

        self::assertSame("Sure, here's a reply.", $service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsNullOnANetworkFailure(): void
    {
        $client = new MockHttpClient(function (): never {
            throw new TransportException('Connection timed out.');
        });
        $service = new OpenAiChatService($client, 'fake-key', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsNullOnANonSuccessHttpStatus(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode(['error' => ['message' => 'Invalid API key.']]), ['http_code' => 401]),
        ]);
        $service = new OpenAiChatService($client, 'bad-key', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }

    public function testChatReturnsNullWhenTheResponseBodyHasNoUsableContent(): void
    {
        $client = new MockHttpClient([
            new MockResponse(json_encode(['choices' => []])),
        ]);
        $service = new OpenAiChatService($client, 'fake-key', 'gpt-4o-mini');

        self::assertNull($service->chat([['role' => 'user', 'content' => 'Hi']]));
    }
}
