<?php

namespace App\Entity;

use App\Repository\MissionRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * A concrete, playable objective within a Situation, fixed to exactly one
 * CECRL level (same one-level-per-content-item principle as Scenario) -
 * several Missions can share the same Situation at different levels
 * (e.g. an A1 and an A2 variant of "order a coffee"), which is what lets a
 * Room stay relevant as the learner's level rises (V2 conception doc §8).
 */
#[ORM\Entity(repositoryClass: MissionRepository::class)]
#[ORM\Table(name: 'missions')]
#[ORM\Index(name: 'idx_missions_situation_id', columns: ['situation_id'])]
#[ORM\Index(name: 'idx_missions_level_id', columns: ['level_id'])]
class Mission
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Situation::class, inversedBy: 'missions')]
    #[ORM\JoinColumn(name: 'situation_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Situation $situation;

    #[ORM\ManyToOne(targetEntity: Level::class)]
    #[ORM\JoinColumn(name: 'level_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Level $level;

    #[ORM\Column(length: 20, unique: true)]
    private string $code;

    #[ORM\Column(length: 200)]
    private string $title;

    #[ORM\Column(type: 'text')]
    private string $objective;

    #[ORM\Column(name: 'prompt_template', type: 'text')]
    private string $promptTemplate;

    #[ORM\Column(name: 'character_name', length: 100)]
    private string $characterName;

    #[ORM\Column(name: 'character_voice', length: 50)]
    private string $characterVoice = 'alloy';

    #[ORM\Column(name: 'base_xp', type: 'smallint')]
    private int $baseXp;

    #[ORM\Column(name: 'order_num', type: 'smallint')]
    private int $orderNum;

    #[ORM\Column(name: 'is_active')]
    private bool $isActive = true;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSituation(): Situation
    {
        return $this->situation;
    }

    public function setSituation(Situation $situation): static
    {
        $this->situation = $situation;

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

    public function getObjective(): string
    {
        return $this->objective;
    }

    public function setObjective(string $objective): static
    {
        $this->objective = $objective;

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

    public function getBaseXp(): int
    {
        return $this->baseXp;
    }

    public function setBaseXp(int $baseXp): static
    {
        $this->baseXp = $baseXp;

        return $this;
    }

    public function getOrderNum(): int
    {
        return $this->orderNum;
    }

    public function setOrderNum(int $orderNum): static
    {
        $this->orderNum = $orderNum;

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
}
