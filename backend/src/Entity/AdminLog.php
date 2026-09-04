<?php

namespace App\Entity;

use App\Repository\AdminLogRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: AdminLogRepository::class)]
#[ORM\Table(name: 'admin_logs')]
class AdminLog
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'admin_id', referencedColumnName: 'id', nullable: false)]
    private User $admin;

    #[ORM\Column(length: 100)]
    private string $action;

    #[ORM\Column(name: 'target_type', length: 50, nullable: true)]
    private ?string $targetType = null;

    #[ORM\Column(name: 'target_id', type: 'bigint', nullable: true)]
    private ?int $targetId = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $details = null;

    #[ORM\Column(name: 'created_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAdmin(): User
    {
        return $this->admin;
    }

    public function setAdmin(User $admin): static
    {
        $this->admin = $admin;

        return $this;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function setAction(string $action): static
    {
        $this->action = $action;

        return $this;
    }

    public function getTargetType(): ?string
    {
        return $this->targetType;
    }

    public function setTargetType(?string $targetType): static
    {
        $this->targetType = $targetType;

        return $this;
    }

    public function getTargetId(): ?int
    {
        return $this->targetId;
    }

    public function setTargetId(?int $targetId): static
    {
        $this->targetId = $targetId;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getDetails(): ?array
    {
        return $this->details;
    }

    /** @param array<string, mixed>|null $details */
    public function setDetails(?array $details): static
    {
        $this->details = $details;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
