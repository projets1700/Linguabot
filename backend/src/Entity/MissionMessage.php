<?php

namespace App\Entity;

use App\Enum\MessageRole;
use App\Repository\MissionMessageRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MissionMessageRepository::class)]
#[ORM\Table(name: 'mission_messages')]
#[ORM\Index(name: 'idx_mission_messages_mission_session_id', columns: ['mission_session_id'])]
class MissionMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: MissionSession::class, inversedBy: 'messages')]
    #[ORM\JoinColumn(name: 'mission_session_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private MissionSession $missionSession;

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

    public function getMissionSession(): MissionSession
    {
        return $this->missionSession;
    }

    public function setMissionSession(MissionSession $missionSession): static
    {
        $this->missionSession = $missionSession;

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
