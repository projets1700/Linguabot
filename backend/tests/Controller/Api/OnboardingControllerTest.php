<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class OnboardingControllerTest extends ApiTestCase
{
    public function testMeReflectsOnboardingNotCompletedRightAfterRegistration(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/me', $token);

        self::assertResponseIsSuccessful();
        self::assertFalse($this->decodeResponse($client)['onboardingCompleted']);
    }

    public function testCompleteMarksOnboardingCompletedAndPersists(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/onboarding/complete', $token);

        self::assertResponseIsSuccessful();
        self::assertTrue($this->decodeResponse($client)['onboardingCompleted']);

        $this->jsonRequest($client, 'GET', '/api/me', $token);
        self::assertTrue($this->decodeResponse($client)['onboardingCompleted']);
    }

    public function testCompleteIsIdempotentWhenCalledTwice(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'POST', '/api/onboarding/complete', $token);
        self::assertResponseIsSuccessful();

        $this->jsonRequest($client, 'POST', '/api/onboarding/complete', $token);
        self::assertResponseIsSuccessful();
        self::assertTrue($this->decodeResponse($client)['onboardingCompleted']);
    }
}
