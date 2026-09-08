<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class SpeechControllerTest extends ApiTestCase
{
    public function testTokenReturns204WhenAzureIsNotConfigured(): void
    {
        // phpunit.dist.xml forces AZURE_SPEECH_KEY="" in the test env, so
        // this always exercises the no-key fallback path - no real Azure
        // resource is ever required to run this suite.
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/speech/token', $token);

        self::assertResponseStatusCodeSame(204);
    }

    public function testTokenRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/speech/token');

        self::assertResponseStatusCodeSame(401);
    }
}
