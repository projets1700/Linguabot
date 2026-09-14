<?php

namespace App\Entity;

use App\Enum\MessageRole;
use App\Repository\ChallengeMessageRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Same shape/role as SessionMessage, for ChallengeSession instead of
 * Session - added so DailyChallengeController can rebuild the conversation
 * history from what was actually persisted, rather than trusting whatever
 * `history` array the client sends with each message()/hint() call (audit
 * P1-03: a client could otherwise fabricate assistant turns to steer the
 * AI's context).
 */
#[ORM\Entity(repositoryClass: ChallengeMessageRepository::class)]
#[ORM\Table(name: 'challenge_messages')]
#[ORM\Index(name: 'idx_challenge_messages_challenge_session_id', columns: ['challenge_session_id'])]
class ChallengeMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: ChallengeSession::class, inversedBy: 'messages')]
    #[ORM\JoinColumn(name: 'challenge_session_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ChallengeSession $challengeSession;

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

    public function getChallengeSession(): ChallengeSession
    {
        return $this->challengeSession;
    }

    public function setChallengeSession(ChallengeSession $challengeSession): static
    {
        $this->challengeSession = $challengeSession;

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
