<?php

namespace App\Entity;

use App\Repository\ChallengeSessionRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ChallengeSessionRepository::class)]
#[ORM\Table(name: 'challenge_sessions')]
#[ORM\UniqueConstraint(name: 'uniq_challenge_sessions_user_challenge', columns: ['user_id', 'challenge_id'])]
class ChallengeSession
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: DailyChallenge::class)]
    #[ORM\JoinColumn(name: 'challenge_id', referencedColumnName: 'id', nullable: false)]
    private DailyChallenge $challenge;

    #[ORM\Column(name: 'xp_earned')]
    private int $xpEarned = 0;

    #[ORM\Column(name: 'completed_at', type: 'datetimetz_immutable', nullable: true)]
    private ?\DateTimeImmutable $completedAt = null;

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

    public function getChallenge(): DailyChallenge
    {
        return $this->challenge;
    }

    public function setChallenge(DailyChallenge $challenge): static
    {
        $this->challenge = $challenge;

        return $this;
    }

    public function getXpEarned(): int
    {
        return $this->xpEarned;
    }

    public function setXpEarned(int $xpEarned): static
    {
        $this->xpEarned = $xpEarned;

        return $this;
    }

    public function getCompletedAt(): ?\DateTimeImmutable
    {
        return $this->completedAt;
    }

    public function setCompletedAt(?\DateTimeImmutable $completedAt): static
    {
        $this->completedAt = $completedAt;

        return $this;
    }

    public function isCompleted(): bool
    {
        return null !== $this->completedAt;
    }
}
