<?php

namespace App\Entity;

use App\Repository\DailyChallengeRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DailyChallengeRepository::class)]
#[ORM\Table(name: 'daily_challenges')]
#[ORM\UniqueConstraint(name: 'uniq_daily_challenges_level_date', columns: ['level_id', 'challenge_date'])]
class DailyChallenge
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Level::class)]
    #[ORM\JoinColumn(name: 'level_id', referencedColumnName: 'id', nullable: false)]
    private Level $level;

    #[ORM\Column(length: 200)]
    private string $title;

    #[ORM\Column(type: 'text')]
    private string $context;

    #[ORM\Column(type: 'text')]
    private string $objective;

    /** @var string[] */
    #[ORM\Column(type: 'json')]
    private array $keywords = [];

    #[ORM\Column(name: 'character_name', length: 100)]
    private string $characterName;

    #[ORM\Column(name: 'challenge_date', type: 'date_immutable')]
    private \DateTimeImmutable $challengeDate;

    #[ORM\Column(name: 'generated_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $generatedAt;

    public function __construct()
    {
        $this->generatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLevel(): Level
    {
        return $this->level;
    }

    public function setLevel(Level $level): static
    {
        $this->level = $level;

        return $this;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getContext(): string
    {
        return $this->context;
    }

    public function setContext(string $context): static
    {
        $this->context = $context;

        return $this;
    }

    public function getObjective(): string
    {
        return $this->objective;
    }

    public function setObjective(string $objective): static
    {
        $this->objective = $objective;

        return $this;
    }

    /** @return string[] */
    public function getKeywords(): array
    {
        return $this->keywords;
    }

    /** @param string[] $keywords */
    public function setKeywords(array $keywords): static
    {
        $this->keywords = $keywords;

        return $this;
    }

    public function getCharacterName(): string
    {
        return $this->characterName;
    }

    public function setCharacterName(string $characterName): static
    {
        $this->characterName = $characterName;

        return $this;
    }

    public function getChallengeDate(): \DateTimeImmutable
    {
        return $this->challengeDate;
    }

    public function setChallengeDate(\DateTimeImmutable $challengeDate): static
    {
        $this->challengeDate = $challengeDate;

        return $this;
    }

    public function getGeneratedAt(): \DateTimeImmutable
    {
        return $this->generatedAt;
    }
}
