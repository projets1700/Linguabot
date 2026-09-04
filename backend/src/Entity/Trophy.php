<?php

namespace App\Entity;

use App\Enum\TrophyRarity;
use App\Repository\TrophyRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TrophyRepository::class)]
#[ORM\Table(name: 'trophies')]
class Trophy
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 50, unique: true)]
    private string $code;

    #[ORM\Column(length: 100)]
    private string $name;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(name: 'condition_type', length: 50)]
    private string $conditionType;

    #[ORM\Column(name: 'condition_value')]
    private int $conditionValue;

    #[ORM\Column(name: 'xp_reward')]
    private int $xpReward = 0;

    #[ORM\Column(type: 'string', enumType: TrophyRarity::class, columnDefinition: "trophy_rarity NOT NULL DEFAULT 'bronze'")]
    private TrophyRarity $rarity = TrophyRarity::BRONZE;

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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getConditionType(): string
    {
        return $this->conditionType;
    }

    public function setConditionType(string $conditionType): static
    {
        $this->conditionType = $conditionType;

        return $this;
    }

    public function getConditionValue(): int
    {
        return $this->conditionValue;
    }

    public function setConditionValue(int $conditionValue): static
    {
        $this->conditionValue = $conditionValue;

        return $this;
    }

    public function getXpReward(): int
    {
        return $this->xpReward;
    }

    public function setXpReward(int $xpReward): static
    {
        $this->xpReward = $xpReward;

        return $this;
    }

    public function getRarity(): TrophyRarity
    {
        return $this->rarity;
    }

    public function setRarity(TrophyRarity $rarity): static
    {
        $this->rarity = $rarity;

        return $this;
    }
}
