<?php

namespace App\Security;

use App\Entity\User;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Refuses authentication for a deactivated or soft-deleted account - without
 * this, User::isActive/deletedAt (set by AccountController::delete and
 * AdminUserController::toggleActive/delete) were never actually enforced:
 * a deactivated/deleted user could still log in, and a JWT already issued
 * before deactivation kept working until it expired (checkPostAuth runs on
 * every authenticated request through the stateless `api` firewall, not
 * just at login).
 */
final class UserChecker implements UserCheckerInterface
{
    public function checkPreAuth(UserInterface $user): void
    {
        $this->assertActive($user);
    }

    public function checkPostAuth(UserInterface $user): void
    {
        $this->assertActive($user);
    }

    private function assertActive(UserInterface $user): void
    {
        if (!$user instanceof User) {
            return;
        }

        if (null !== $user->getDeletedAt()) {
            throw new CustomUserMessageAccountStatusException('Ce compte a été supprimé.');
        }

        if (!$user->isActive()) {
            throw new CustomUserMessageAccountStatusException('Ce compte a été désactivé.');
        }
    }
}
