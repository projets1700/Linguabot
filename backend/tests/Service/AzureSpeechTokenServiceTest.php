<?php

namespace App\Tests\Service;

use App\Service\AzureSpeechTokenService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AzureSpeechTokenServiceTest extends TestCase
{
    public function testIssueTokenReturnsNullWithoutAnyHttpCallWhenNoKeyIsConfigured(): void
    {
        $client = new MockHttpClient(function (): never {
            self::fail('No HTTP request should be made without a subscription key.');
        });
        $service = new AzureSpeechTokenService($client, '', 'westeurope');

        self::assertNull($service->issueToken());
    }

    public function testIssueTokenReturnsNullWithoutAnyHttpCallWhenNoRegionIsConfigured(): void
    {
        $client = new MockHttpClient(function (): never {
            self::fail('No HTTP request should be made without a region.');
        });
        $service = new AzureSpeechTokenService($client, 'fake-key', '');

        self::assertNull($service->issueToken());
    }

    public function testIssueTokenReturnsTheTrimmedTokenAndRegionOnSuccess(): void
    {
        $client = new MockHttpClient([
            new MockResponse("  fake-jwt-token  \n"),
        ]);
        $service = new AzureSpeechTokenService($client, 'fake-key', 'westeurope');

        self::assertSame(
            ['token' => 'fake-jwt-token', 'region' => 'westeurope'],
            $service->issueToken(),
        );
    }

    public function testIssueTokenReturnsNullOnANetworkFailure(): void
    {
        $client = new MockHttpClient(function (): never {
            throw new TransportException('Connection timed out.');
        });
        $service = new AzureSpeechTokenService($client, 'fake-key', 'westeurope');

        self::assertNull($service->issueToken());
    }

    public function testIssueTokenReturnsNullOnANonSuccessHttpStatus(): void
    {
        $client = new MockHttpClient([
            new MockResponse('Access denied.', ['http_code' => 401]),
        ]);
        $service = new AzureSpeechTokenService($client, 'bad-key', 'westeurope');

        self::assertNull($service->issueToken());
    }
}
