<?php

namespace App\Tests\Controller\Api;

use App\Tests\ApiTestCase;

final class AuthControllerTest extends ApiTestCase
{
    public function testRegisterReturnsTokenAndCreatesAccountAtLevelA0(): void
    {
        $client = static::createClient();
        $email = 'register-'.uniqid().'@linguabot.fr';

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(201);
        $data = $this->decodeResponse($client);
        self::assertArrayHasKey('token', $data);

        $this->jsonRequest($client, 'GET', '/api/me', $data['token']);
        self::assertResponseIsSuccessful();
        $me = $this->decodeResponse($client);
        self::assertSame($email, $me['email']);
        self::assertSame('A0', $me['level']['code']);
        self::assertSame(0, $me['totalXp']);
    }

    public function testRegisterWithDuplicateEmailIsRejected(): void
    {
        $client = static::createClient();
        $email = 'duplicate-'.uniqid().'@linguabot.fr';
        $payload = [
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ];

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($payload));
        self::assertResponseStatusCodeSame(201);

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($payload));
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

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));
        self::assertResponseStatusCodeSame(201);

        $client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseIsSuccessful();
        self::assertArrayHasKey('token', $this->decodeResponse($client));
    }

    public function testLoginWithWrongPasswordIsRejected(): void
    {
        $client = static::createClient();
        $email = 'wrongpass-'.uniqid().'@linguabot.fr';

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Adam',
            'nom' => 'Amrane',
            'email' => $email,
            'password' => 'Password123!',
        ]));

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
