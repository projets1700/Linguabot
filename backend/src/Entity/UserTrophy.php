<?php

namespace App\Entity;

use App\Repository\UserTrophyRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserTrophyRepository::class)]
#[ORM\Table(name: 'user_trophies')]
#[ORM\UniqueConstraint(name: 'uniq_user_trophies_user_trophy', columns: ['user_id', 'trophy_id'])]
class UserTrophy
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Trophy::class)]
    #[ORM\JoinColumn(name: 'trophy_id', referencedColumnName: 'id', nullable: false)]
    private Trophy $trophy;

    #[ORM\Column(name: 'progress_current')]
    private int $progressCurrent = 0;

    #[ORM\Column(name: 'progress_total')]
    private int $progressTotal;

    #[ORM\Column(name: 'earned_at', type: 'datetimetz_immutable', nullable: true)]
    private ?\DateTimeImmutable $earnedAt = null;

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

    public function getTrophy(): Trophy
    {
        return $this->trophy;
    }

    public function setTrophy(Trophy $trophy): static
    {
        $this->trophy = $trophy;

        return $this;
    }

    public function getProgressCurrent(): int
    {
        return $this->progressCurrent;
    }

    public function setProgressCurrent(int $progressCurrent): static
    {
        $this->progressCurrent = $progressCurrent;

        return $this;
    }

    public function getProgressTotal(): int
    {
        return $this->progressTotal;
    }

    public function setProgressTotal(int $progressTotal): static
    {
        $this->progressTotal = $progressTotal;

        return $this;
    }

    public function getEarnedAt(): ?\DateTimeImmutable
    {
        return $this->earnedAt;
    }

    public function setEarnedAt(?\DateTimeImmutable $earnedAt): static
    {
        $this->earnedAt = $earnedAt;

        return $this;
    }

    public function isEarned(): bool
    {
        return null !== $this->earnedAt;
    }
}
