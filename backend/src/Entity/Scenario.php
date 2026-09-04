<?php

namespace App\Entity;

use App\Enum\ScenarioCategory;
use App\Repository\ScenarioRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ScenarioRepository::class)]
#[ORM\Table(name: 'scenarios')]
#[ORM\Index(name: 'idx_scenarios_level_id', columns: ['level_id'])]
#[ORM\Index(name: 'idx_scenarios_category', columns: ['category'])]
#[ORM\Index(name: 'idx_scenarios_is_active', columns: ['is_active'])]
class Scenario
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 20, unique: true)]
    private string $code;

    #[ORM\Column(length: 200)]
    private string $title;

    #[ORM\Column(type: 'text')]
    private string $context;

    #[ORM\ManyToOne(targetEntity: Level::class, inversedBy: 'scenarios')]
    #[ORM\JoinColumn(name: 'level_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Level $level;

    #[ORM\Column(type: 'string', enumType: ScenarioCategory::class, columnDefinition: 'scenario_category NOT NULL')]
    private ScenarioCategory $category;

    #[ORM\Column(name: 'prompt_template', type: 'text')]
    private string $promptTemplate;

    #[ORM\Column(name: 'character_name', length: 100)]
    private string $characterName;

    #[ORM\Column(name: 'character_voice', length: 50)]
    private string $characterVoice = 'alloy';

    #[ORM\Column(name: 'duration_estimate', type: 'smallint')]
    private int $durationEstimate;

    #[ORM\Column(name: 'base_xp', type: 'smallint')]
    private int $baseXp;

    #[ORM\Column(name: 'is_active')]
    private bool $isActive = true;

    #[ORM\Column(name: 'play_count')]
    private int $playCount = 0;

    #[ORM\Column(name: 'created_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: 'datetimetz_immutable', nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

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

    public function getLevel(): Level
    {
        return $this->level;
    }

    public function setLevel(Level $level): static
    {
        $this->level = $level;

        return $this;
    }

    public function getCategory(): ScenarioCategory
    {
        return $this->category;
    }

    public function setCategory(ScenarioCategory $category): static
    {
        $this->category = $category;

        return $this;
    }

    public function getPromptTemplate(): string
    {
        return $this->promptTemplate;
    }

    public function setPromptTemplate(string $promptTemplate): static
    {
        $this->promptTemplate = $promptTemplate;

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

    public function getCharacterVoice(): string
    {
        return $this->characterVoice;
    }

    public function setCharacterVoice(string $characterVoice): static
    {
        $this->characterVoice = $characterVoice;

        return $this;
    }

    public function getDurationEstimate(): int
    {
        return $this->durationEstimate;
    }

    public function setDurationEstimate(int $durationEstimate): static
    {
        $this->durationEstimate = $durationEstimate;

        return $this;
    }

    public function getBaseXp(): int
    {
        return $this->baseXp;
    }

    public function setBaseXp(int $baseXp): static
    {
        $this->baseXp = $baseXp;

        return $this;
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): static
    {
        $this->isActive = $isActive;

        return $this;
    }

    public function getPlayCount(): int
    {
        return $this->playCount;
    }

    public function setPlayCount(int $playCount): static
    {
        $this->playCount = $playCount;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTimeImmutable $updatedAt): static
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }
}
