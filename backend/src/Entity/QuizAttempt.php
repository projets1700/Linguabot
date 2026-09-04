<?php

namespace App\Entity;

use App\Repository\QuizAttemptRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: QuizAttemptRepository::class)]
#[ORM\Table(name: 'quiz_attempts')]
class QuizAttempt
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: QuizModule::class)]
    #[ORM\JoinColumn(name: 'module_id', referencedColumnName: 'id', nullable: false)]
    private QuizModule $module;

    #[ORM\Column(type: 'smallint')]
    private int $score;

    /**
     * DB-computed (GENERATED ALWAYS AS (score >= 7) STORED): never written by
     * the application, so `passed` can never drift from `score` (RG09).
     */
    #[ORM\Column(insertable: false, updatable: false)]
    private bool $passed;

    #[ORM\Column(name: 'xp_earned')]
    private int $xpEarned = 0;

    #[ORM\Column(name: 'attempted_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $attemptedAt;

    public function __construct()
    {
        $this->attemptedAt = new \DateTimeImmutable();
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

    public function getModule(): QuizModule
    {
        return $this->module;
    }

    public function setModule(QuizModule $module): static
    {
        $this->module = $module;

        return $this;
    }

    public function getScore(): int
    {
        return $this->score;
    }

    public function setScore(int $score): static
    {
        $this->score = $score;

        return $this;
    }

    public function isPassed(): bool
    {
        return $this->passed;
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

    public function getAttemptedAt(): \DateTimeImmutable
    {
        return $this->attemptedAt;
    }
}
