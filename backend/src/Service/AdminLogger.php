<?php

namespace App\Service;

use App\Entity\AdminLog;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Records admin actions (TP §16, exercice 5): scenario.create,
 * scenario.update, scenario.toggle_active, user.toggle_active, user.delete,
 * daily_challenge.regenerate, badge.toggle_active.
 */
final class AdminLogger
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    /**
     * @param array<string, mixed>|null $details
     */
    public function log(User $admin, string $action, ?string $targetType = null, ?int $targetId = null, ?array $details = null): void
    {
        $log = (new AdminLog())
            ->setAdmin($admin)
            ->setAction($action)
            ->setTargetType($targetType)
            ->setTargetId($targetId)
            ->setDetails($details);

        $this->em->persist($log);
        $this->em->flush();
    }
}
