<?php

namespace App\Entity;

use App\Enum\MessageRole;
use App\Enum\SessionStatus;
use App\Repository\PlacementTestRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * A one-shot oral placement test taken right after registration (see
 * PlacementTestController): a short scripted conversation whose answers set
 * the learner's starting Level instead of always defaulting to A0. One row
 * per user, ever - the unique constraint on user_id both prevents retakes
 * and lets an interrupted (in_progress) test be resumed by re-fetching it.
 * Not part of the original Jalon 3 MPD.
 */
#[ORM\Entity(repositoryClass: PlacementTestRepository::class)]
#[ORM\Table(name: 'placement_tests')]
#[ORM\UniqueConstraint(name: 'uniq_placement_tests_user_id', columns: ['user_id'])]
class PlacementTest
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: 'string', enumType: SessionStatus::class, columnDefinition: "session_status NOT NULL DEFAULT 'in_progress'")]
    private SessionStatus $status = SessionStatus::IN_PROGRESS;

    #[ORM\ManyToOne(targetEntity: Level::class)]
    #[ORM\JoinColumn(name: 'result_level_id', referencedColumnName: 'id', nullable: true, onDelete: 'RESTRICT')]
    private ?Level $resultLevel = null;

    #[ORM\Column(name: 'started_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(name: 'ended_at', type: 'datetimetz_immutable', nullable: true)]
    private ?\DateTimeImmutable $endedAt = null;

    /** @var Collection<int, PlacementTestMessage> */
    #[ORM\OneToMany(targetEntity: PlacementTestMessage::class, mappedBy: 'placementTest', orphanRemoval: true)]
    #[ORM\OrderBy(['createdAt' => 'ASC'])]
    private Collection $messages;

    public function __construct()
    {
        $this->startedAt = new \DateTimeImmutable();
        $this->messages = new ArrayCollection();
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

    public function getStatus(): SessionStatus
    {
        return $this->status;
    }

    public function setStatus(SessionStatus $status): static
    {
        $this->status = $status;

        return $this;
    }

    public function getResultLevel(): ?Level
    {
        return $this->resultLevel;
    }

    public function setResultLevel(?Level $resultLevel): static
    {
        $this->resultLevel = $resultLevel;

        return $this;
    }

    public function getStartedAt(): \DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getEndedAt(): ?\DateTimeImmutable
    {
        return $this->endedAt;
    }

    public function setEndedAt(?\DateTimeImmutable $endedAt): static
    {
        $this->endedAt = $endedAt;

        return $this;
    }

    /** @return Collection<int, PlacementTestMessage> */
    public function getMessages(): Collection
    {
        return $this->messages;
    }

    /**
     * Keeps both sides of the relation in sync so a freshly-created test
     * reflects messages added in the same request, without needing a reload.
     */
    public function addMessage(PlacementTestMessage $message): static
    {
        if (!$this->messages->contains($message)) {
            $this->messages->add($message);
            $message->setPlacementTest($this);
        }

        return $this;
    }

    public function countUserAnswers(): int
    {
        return $this->messages->filter(
            static fn (PlacementTestMessage $m) => MessageRole::USER === $m->getRole(),
        )->count();
    }
}
