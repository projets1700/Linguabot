<?php

namespace App\Entity;

use App\Repository\UserBadgeRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserBadgeRepository::class)]
#[ORM\Table(name: 'user_badges')]
#[ORM\UniqueConstraint(name: 'uniq_user_badges_user_badge', columns: ['user_id', 'badge_id'])]
class UserBadge
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Badge::class)]
    #[ORM\JoinColumn(name: 'badge_id', referencedColumnName: 'id', nullable: false)]
    private Badge $badge;

    #[ORM\Column(name: 'earned_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $earnedAt;

    public function __construct()
    {
        $this->earnedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): static
    {
        $this->user = $user;

        return $this;
    }

    public function getBadge(): Badge
    {
        return $this->badge;
    }

    public function setBadge(Badge $badge): static
    {
        $this->badge = $badge;

        return $this;
    }

    public function getEarnedAt(): \DateTimeImmutable
    {
        return $this->earnedAt;
    }
}
