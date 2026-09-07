<?php

namespace App\Tests\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class HealthControllerTest extends WebTestCase
{
    public function testHealthEndpointIsPublicAndReturnsOk(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/health');

        self::assertResponseIsSuccessful();
        self::assertJsonStringEqualsJsonString(
            '{"status":"ok","service":"LinguaBot API"}',
            $client->getResponse()->getContent(),
        );
    }
}
