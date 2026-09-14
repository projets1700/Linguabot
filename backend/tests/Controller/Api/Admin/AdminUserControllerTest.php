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
        // Two distinct accounts - one client, both tokens issued from it,
        // since createClient() can only be called once per test (see
        // ApiTestCase's own single-kernel-boot constraint). The admin
        // toggles the OTHER user, not itself - see
        // testAdminCannotDeactivateItself for the self-toggle case, which
        // this exact scenario used to (incorrectly) exercise.
        $client = static::createClient();
        $adminEmail = 'admin-'.uniqid().'@linguabot.fr';
        $adminToken = $this->registerAndGetToken($client, $adminEmail);
        $this->promoteToAdmin($adminEmail);

        $targetEmail = 'admin-target-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $targetEmail);

        $this->jsonRequest($client, 'GET', '/api/admin/users', $adminToken);
        self::assertResponseIsSuccessful();
        $users = $this->decodeResponse($client);
        self::assertNotEmpty($users);

        $target = current(array_filter($users, static fn (array $u) => $u['email'] === $targetEmail));
        self::assertNotFalse($target);
        self::assertTrue($target['isActive']);

        $this->jsonRequest($client, 'PATCH', "/api/admin/users/{$target['id']}/toggle-active", $adminToken);
        self::assertResponseIsSuccessful();
        self::assertFalse($this->decodeResponse($client)['isActive']);

        $this->jsonRequest($client, 'GET', '/api/admin/logs', $adminToken);
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
