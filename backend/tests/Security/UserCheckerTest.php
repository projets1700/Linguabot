<?php

namespace App\Tests\Security;

use App\Entity\User;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class UserCheckerTest extends ApiTestCase
{
    public function testLoginIsRejectedForADeactivatedAccount(): void
    {
        $client = static::createClient();
        $email = 'checker-deactivated-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $email);
        $this->setActive($email, false);

        $client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(401);
    }

    public function testLoginIsRejectedForASoftDeletedAccount(): void
    {
        $client = static::createClient();
        $email = 'checker-deleted-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $email);
        $this->softDelete($email);

        $client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'email' => $email,
            'password' => 'Password123!',
        ]));

        self::assertResponseStatusCodeSame(401);
    }

    public function testAnExistingJwtIsRejectedOnceTheAccountIsDeactivated(): void
    {
        $client = static::createClient();
        $email = 'checker-live-jwt-deactivated-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);

        // The token was already valid at this point - deactivation happens
        // afterward, simulating an admin toggling it off mid-session.
        $this->setActive($email, false);

        $this->jsonRequest($client, 'GET', '/api/me', $token);

        self::assertResponseStatusCodeSame(401);
    }

    public function testAnExistingJwtIsRejectedOnceTheAccountIsSoftDeleted(): void
    {
        $client = static::createClient();
        $email = 'checker-live-jwt-deleted-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);

        $this->softDelete($email);

        $this->jsonRequest($client, 'GET', '/api/me', $token);

        self::assertResponseStatusCodeSame(401);
    }

    private function setActive(string $email, bool $active): void
    {
        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user);
        $user->setIsActive($active);
        $em->flush();
    }

    private function softDelete(string $email): void
    {
        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user);
        $user->setDeletedAt(new \DateTimeImmutable());
        $em->flush();
    }
}
