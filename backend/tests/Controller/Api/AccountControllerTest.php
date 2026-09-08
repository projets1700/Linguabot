<?php

namespace App\Tests\Controller\Api;

use App\Entity\User;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class AccountControllerTest extends ApiTestCase
{
    public function testDeleteRejectsAnIncorrectPassword(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'DELETE', '/api/me', $token, ['password' => 'wrong-password']);

        self::assertResponseStatusCodeSame(422);
    }

    public function testDeleteRejectsAMissingPassword(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'DELETE', '/api/me', $token, []);

        self::assertResponseStatusCodeSame(422);
    }

    public function testDeleteSoftDeletesTheAccountOnACorrectPassword(): void
    {
        $client = static::createClient();
        $email = 'delete-me-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);

        // registerAndGetToken always registers with this exact password.
        $this->jsonRequest($client, 'DELETE', '/api/me', $token, ['password' => 'Password123!']);

        self::assertResponseIsSuccessful();

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user);
        self::assertFalse($user->isActive());
        self::assertNotNull($user->getDeletedAt());
    }

    public function testExportReturnsTheLearnersOwnProfileAndActivity(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/me/export', $token);

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('Content-Disposition', 'attachment; filename="linguabot-mes-donnees.json"');

        $data = $this->decodeResponse($client);
        self::assertSame('Test', $data['profile']['prenom']);
        self::assertArrayHasKey('sessions', $data);
        self::assertArrayHasKey('quizAttempts', $data);
        self::assertArrayHasKey('dailyChallenges', $data);
        self::assertArrayHasKey('badges', $data);
        self::assertArrayHasKey('trophies', $data);
    }

    public function testAccountEndpointsRequireAuthentication(): void
    {
        $client = static::createClient();

        $client->request('DELETE', '/api/me');
        self::assertResponseStatusCodeSame(401);

        $client->request('GET', '/api/me/export');
        self::assertResponseStatusCodeSame(401);
    }
}
