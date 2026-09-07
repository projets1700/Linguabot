<?php

namespace App\Entity;

use App\Enum\MessageRole;
use App\Repository\PlacementTestMessageRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PlacementTestMessageRepository::class)]
#[ORM\Table(name: 'placement_test_messages')]
#[ORM\Index(name: 'idx_placement_test_messages_test_id', columns: ['placement_test_id'])]
class PlacementTestMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: PlacementTest::class, inversedBy: 'messages')]
    #[ORM\JoinColumn(name: 'placement_test_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private PlacementTest $placementTest;

    #[ORM\Column(type: 'string', enumType: MessageRole::class, columnDefinition: 'message_role NOT NULL')]
    private MessageRole $role;

    #[ORM\Column(type: 'text')]
    private string $content;

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

    public function getPlacementTest(): PlacementTest
    {
        return $this->placementTest;
    }

    public function setPlacementTest(PlacementTest $placementTest): static
    {
        $this->placementTest = $placementTest;

        return $this;
    }

    public function getRole(): MessageRole
    {
        return $this->role;
    }

    public function setRole(MessageRole $role): static
    {
        $this->role = $role;

        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): static
    {
        $this->content = $content;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
