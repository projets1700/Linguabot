<?php

namespace App\Tests\Controller\Api\Admin;

use App\Enum\UserRole;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class AdminUserControllerTest extends ApiTestCase
{
    public function testRegularUserIsDeniedAccessToAdminRoutes(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client);

        $this->jsonRequest($client, 'GET', '/api/admin/users', $token);

        self::assertResponseStatusCodeSame(403);
    }

    public function testAdminCanListAndToggleUsers(): void
    {
        $client = static::createClient();
        $email = 'admin-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'GET', '/api/admin/users', $token);
        self::assertResponseIsSuccessful();
        $users = $this->decodeResponse($client);
        self::assertNotEmpty($users);

        $target = current(array_filter($users, static fn (array $u) => $u['email'] === $email));
        self::assertNotFalse($target);
        self::assertTrue($target['isActive']);

        $this->jsonRequest($client, 'PATCH', "/api/admin/users/{$target['id']}/toggle-active", $token);
        self::assertResponseIsSuccessful();
        self::assertFalse($this->decodeResponse($client)['isActive']);

        $this->jsonRequest($client, 'GET', '/api/admin/logs', $token);
        self::assertResponseIsSuccessful();
        $logs = $this->decodeResponse($client);
        self::assertSame('user.disable', $logs[0]['action']);
    }

    private function promoteToAdmin(string $email): void
    {
        $container = static::getContainer();
        /** @var EntityManagerInterface $em */
        $em = $container->get(EntityManagerInterface::class);

        $user = $em->getRepository(\App\Entity\User::class)->findOneBy(['email' => $email]);
        $user->setRole(UserRole::ADMIN);
        $em->flush();
    }
}
