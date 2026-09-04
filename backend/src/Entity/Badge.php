<?php

namespace App\Entity;

use App\Repository\BadgeRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: BadgeRepository::class)]
#[ORM\Table(name: 'badges')]
class Badge
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

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $icon = null;

    #[ORM\Column(name: 'condition_type', length: 50)]
    private string $conditionType;

    #[ORM\Column(name: 'condition_value')]
    private int $conditionValue;

    #[ORM\Column(name: 'xp_bonus')]
    private int $xpBonus = 0;

    #[ORM\Column(name: 'is_active')]
    private bool $isActive = true;

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

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): static
    {
        $this->icon = $icon;

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

    public function getXpBonus(): int
    {
        return $this->xpBonus;
    }

    public function setXpBonus(int $xpBonus): static
    {
        $this->xpBonus = $xpBonus;

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
