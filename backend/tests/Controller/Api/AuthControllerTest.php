<?php

namespace App\Tests\Controller\Api;

use App\Entity\PendingRegistration;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class AuthControllerTest extends ApiTestCase
{
    public function testRegisterDoesNotCreateAUserAndReturnsNoToken(): void
    {
        $client = static::createClient();
        $email = 'register-'.uniqid().'@linguabot.fr';

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(202);
        $data = $this->decodeResponse($client);
        self::assertArrayNotHasKey('token', $data);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $pending = $em->getRepository(PendingRegistration::class)->findOneBy(['email' => $email]);
        self::assertNotNull($pending, 'A pending registration should have been created');
        self::assertFalse($pending->isExpired());
    }

    public function testVerifyEmailCreatesTheAccountAtLevelA0AndReturnsAToken(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/me', $token);
        self::assertResponseIsSuccessful();
        $me = $this->decodeResponse($client);
        self::assertSame('A0', $me['level']['code']);
        self::assertSame(0, $me['totalXp']);
    }

    public function testVerifyEmailWithUnknownTokenReturns404(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/auth/verify-email', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'token' => 'does-not-exist',
        ]));

        self::assertResponseStatusCodeSame(404);
    }

    public function testVerifyEmailWithExpiredTokenReturns410AndDeletesThePendingRow(): void
    {
        $client = static::createClient();
        $email = 'expired-'.uniqid().'@linguabot.fr';

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));
        self::assertResponseStatusCodeSame(202);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $repository = $em->getRepository(PendingRegistration::class);
        $pending = $repository->findOneBy(['email' => $email]);
        self::assertNotNull($pending);
        $token = $pending->getToken();

        // Force the row into the past directly in SQL: there is no public
        // setter for expiresAt, the entity is designed to only ever push it
        // forward via refreshToken().
        // date_trunc('second', ...) matters: a raw now() carries microsecond
        // precision that Doctrine's strict "Y-m-d H:i:sO" parser rejects on
        // the next read (see DailyChallenge fixture incident for the same
        // class of bug).
        $em->getConnection()->executeStatement(
            'UPDATE pending_registrations SET expires_at = date_trunc(\'second\', now() - interval \'1 hour\') WHERE token = :token',
            ['token' => $token],
        );
        $em->clear();

        $client->request('POST', '/api/auth/verify-email', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'token' => $token,
        ]));

        self::assertResponseStatusCodeSame(410);
        self::assertNull($repository->findOneBy(['email' => $email]));
    }

    public function testRegisteringTwiceBeforeVerifyingRefreshesTheSamePendingRowInsteadOfErroring(): void
    {
        $client = static::createClient();
        $email = 'refresh-'.uniqid().'@linguabot.fr';
        $payload = [
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ];

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($payload));
        self::assertResponseStatusCodeSame(202);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $repository = $em->getRepository(PendingRegistration::class);
        $firstToken = $repository->findOneBy(['email' => $email])->getToken();
        $em->clear();

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($payload));
        self::assertResponseStatusCodeSame(202);

        self::assertCount(1, $repository->findBy(['email' => $email]), 'Re-registering must not create a duplicate row');
        $secondToken = $repository->findOneBy(['email' => $email])->getToken();
        self::assertNotSame($firstToken, $secondToken);
    }

    public function testVerifyEmailWithDuplicateEmailIsRejected(): void
    {
        $client = static::createClient();
        $email = 'duplicate-'.uniqid().'@linguabot.fr';

        $this->registerAndGetToken($client, $email);

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(422);
    }

    public function testRegisterWithInvalidDataIsRejected(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => '',
            'nom' => 'Amrane',
            'email' => 'not-an-email',
            'password' => 'short',
        ]));

        self::assertResponseStatusCodeSame(422);
    }

    public function testLoginWithCorrectCredentialsReturnsToken(): void
    {
        $client = static::createClient();
        $email = 'login-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $email);

        $client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseIsSuccessful();
        self::assertArrayHasKey('token', $this->decodeResponse($client));
    }

    public function testLoginBeforeEmailVerificationIsRejected(): void
    {
        $client = static::createClient();
        $email = 'unverified-'.uniqid().'@linguabot.fr';

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));
        self::assertResponseStatusCodeSame(202);

        $client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(401);
    }

    public function testLoginWithWrongPasswordIsRejected(): void
    {
        $client = static::createClient();
        $email = 'wrongpass-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $email);

        $client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'email' => $email,
            'password' => 'WrongPassword!',
        ]));

        self::assertResponseStatusCodeSame(401);
    }

    public function testProtectedEndpointRejectsRequestsWithoutAToken(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/me');

        self::assertResponseStatusCodeSame(401);
    }
}
