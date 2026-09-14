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

    public function testAdminCannotDeactivateItself(): void
    {
        $client = static::createClient();
        $email = 'admin-self-toggle-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'GET', '/api/admin/users', $token);
        $self = current(array_filter($this->decodeResponse($client), static fn (array $u) => $u['email'] === $email));

        $this->jsonRequest($client, 'PATCH', "/api/admin/users/{$self['id']}/toggle-active", $token);
        self::assertResponseStatusCodeSame(400);

        // Still active and authenticated afterward - the account was never touched.
        $this->jsonRequest($client, 'GET', '/api/me', $token);
        self::assertResponseIsSuccessful();
    }

    public function testAdminCannotDeleteItself(): void
    {
        $client = static::createClient();
        $email = 'admin-self-delete-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'GET', '/api/admin/users', $token);
        $self = current(array_filter($this->decodeResponse($client), static fn (array $u) => $u['email'] === $email));

        $this->jsonRequest($client, 'DELETE', "/api/admin/users/{$self['id']}", $token);

        self::assertResponseStatusCodeSame(400);

        // Still authenticated afterward - the account was never touched.
        $this->jsonRequest($client, 'GET', '/api/me', $token);
        self::assertResponseIsSuccessful();
    }

    public function testAdminCanDeactivateAndReactivateADifferentAdminWhenAnotherOneRemainsActive(): void
    {
        // The "last admin" guard only ever matters for a different-admin
        // target (self-deactivation is already refused above) - reachable
        // here because the acting admin itself stays active throughout,
        // so deactivating the OTHER admin never drops the active count to 0.
        $client = static::createClient();
        $actingAdminEmail = 'admin-acting-'.uniqid().'@linguabot.fr';
        $actingToken = $this->registerAndGetToken($client, $actingAdminEmail);
        $this->promoteToAdmin($actingAdminEmail);

        $otherAdminEmail = 'admin-other-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $otherAdminEmail);
        $this->promoteToAdmin($otherAdminEmail);

        $this->jsonRequest($client, 'GET', '/api/admin/users', $actingToken);
        $other = current(array_filter($this->decodeResponse($client), static fn (array $u) => $u['email'] === $otherAdminEmail));

        $this->jsonRequest($client, 'PATCH', "/api/admin/users/{$other['id']}/toggle-active", $actingToken);
        self::assertResponseIsSuccessful();
        self::assertFalse($this->decodeResponse($client)['isActive']);
    }

    public function testCountActiveAdminsExcludesInactiveAndSoftDeletedAdmins(): void
    {
        $client = static::createClient();
        $em = static::getContainer()->get(EntityManagerInterface::class);
        /** @var \App\Repository\UserRepository $userRepository */
        $userRepository = $em->getRepository(\App\Entity\User::class);
        $before = $userRepository->countActiveAdmins();

        $activeEmail = 'admin-count-active-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $activeEmail);
        $this->promoteToAdmin($activeEmail);
        self::assertSame($before + 1, $userRepository->countActiveAdmins());

        $inactiveEmail = 'admin-count-inactive-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $inactiveEmail);
        $this->promoteToAdmin($inactiveEmail);
        $inactiveAdmin = $em->getRepository(\App\Entity\User::class)->findOneBy(['email' => $inactiveEmail]);
        $inactiveAdmin->setIsActive(false);
        $em->flush();

        self::assertSame($before + 1, $userRepository->countActiveAdmins(), 'A deactivated admin must not be counted.');
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
