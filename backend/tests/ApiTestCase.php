<?php

namespace App\Tests;

use App\Entity\Level;
use App\Entity\PendingRegistration;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
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
    /**
     * Registration no longer creates a User directly (email verification is
     * required first - see AuthController::verifyEmail()). This drives the
     * full two-step flow: register, read the verification token straight
     * from the database (no real email is sent in the test env, MAILER_DSN
     * is forced to null://null), then verify to obtain the real JWT.
     */
    protected function registerAndGetToken(KernelBrowser $client, ?string $email = null): string
    {
        $email ??= sprintf('test-%s-%s@linguabot.fr', str_replace('\\', '-', static::class), uniqid());

        $client->request('POST', '/api/auth/register', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'prenom' => 'Test',
            'nom' => 'User',
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(202, 'Registration did not accept: '.$client->getResponse()->getContent());

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $pending = $em->getRepository(PendingRegistration::class)->findOneBy(['email' => $email]);
        self::assertNotNull($pending, 'No pending registration was created for '.$email);

        $client->request('POST', '/api/auth/verify-email', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'token' => $pending->getToken(),
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        self::assertArrayHasKey('token', $data, 'Verification did not return a token: '.$client->getResponse()->getContent());

        return $data['token'];
    }

    /**
     * Every fresh registration lands at A0 (see AuthController::verifyEmail())
     * and scenarios only exist from A1 up (SessionController::start() now
     * locks anything above the learner's own level) - tests that need to
     * actually start a scenario session use this instead of bumping the
     * level by hand every time.
     */
    protected function registerAndGetTokenAtLevel(KernelBrowser $client, string $levelCode, ?string $email = null): string
    {
        $email ??= sprintf('test-%s-%s@linguabot.fr', str_replace('\\', '-', static::class), uniqid());
        $token = $this->registerAndGetToken($client, $email);

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        $level = $em->getRepository(Level::class)->findOneBy(['code' => $levelCode]);
        self::assertNotNull($user);
        self::assertNotNull($level, "Unknown level code: {$levelCode}");
        $user->setLevel($level);
        $em->flush();

        return $token;
    }

    protected function setUserTotalXp(string $email, int $totalXp): void
    {
        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user);
        $user->setTotalXp($totalXp);
        $em->flush();
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
