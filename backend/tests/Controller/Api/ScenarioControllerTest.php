<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class ScenarioControllerTest extends ApiTestCase
{
    public function testCatalogListsAll40Scenarios(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/scenarios', $token);

        self::assertResponseIsSuccessful();
        self::assertCount(40, $this->decodeResponse($client));
    }

    public function testCatalogFiltersByLevelAndCategory(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/scenarios?level=A1&category=quotidien', $token);

        self::assertResponseIsSuccessful();
        $scenarios = $this->decodeResponse($client);
        self::assertCount(5, $scenarios);
        foreach ($scenarios as $scenario) {
            self::assertSame('A1', $scenario['level']);
            self::assertSame('quotidien', $scenario['category']);
        }
    }

    public function testCatalogRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/scenarios');

        self::assertResponseStatusCodeSame(401);
    }
}
