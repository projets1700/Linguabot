<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class MeControllerTest extends ApiTestCase
{
    public function testMeResponseIncludesTheLearnersCecrlProfileAtA0(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client); // fresh user is level A0

        $this->jsonRequest($client, 'GET', '/api/me', $token);

        self::assertResponseIsSuccessful();
        $cecrlProfile = $this->decodeResponse($client)['cecrlProfile'];
        self::assertSame('fullAnswer', $cecrlProfile['hintMode']);
        self::assertSame('visible', $cecrlProfile['translationMode']);
        self::assertTrue($cecrlProfile['helpVisibleByDefault']);
    }

    public function testMeResponseReflectsTheLeastAssistedProfileAtB1(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetTokenAtLevel($client, 'B1');

        $this->jsonRequest($client, 'GET', '/api/me', $token);

        self::assertResponseIsSuccessful();
        $cecrlProfile = $this->decodeResponse($client)['cecrlProfile'];
        self::assertSame('keywords', $cecrlProfile['hintMode']);
        self::assertSame('onDemand', $cecrlProfile['translationMode']);
        self::assertFalse($cecrlProfile['helpVisibleByDefault']);
    }
}
