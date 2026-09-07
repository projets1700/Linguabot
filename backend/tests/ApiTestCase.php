<?php

namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Shared helpers for functional API tests: registering a throwaway user and
 * making authenticated JSON requests against the real (test) database and
 * fixtures. Every test method gets its own unique email so tests can run in
 * any order without unique-constraint collisions.
 */
abstract class ApiTestCase extends WebTestCase
{
    protected function registerAndGetToken(KernelBrowser $client, ?string $email = null): string
    {
        $email ??= sprintf('test-%s-%s@linguabot.fr', str_replace('\\', '-', static::class), uniqid());

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Test',
            'nom' => 'User',
            'email' => $email,
            'password' => 'Password123!',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        self::assertArrayHasKey('token', $data, 'Registration did not return a token: '.$client->getResponse()->getContent());

        return $data['token'];
    }

    /**
     * @param array<string, mixed>|null $payload
     */
    protected function jsonRequest(KernelBrowser $client, string $method, string $uri, string $token, ?array $payload = null): void
    {
        $client->request(
            $method,
            $uri,
            server: [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            ],
            content: null !== $payload ? json_encode($payload) : null,
        );
    }

    /**
     * @return array<mixed>
     */
    protected function decodeResponse(KernelBrowser $client): array
    {
        return json_decode($client->getResponse()->getContent(), true) ?? [];
    }
}
