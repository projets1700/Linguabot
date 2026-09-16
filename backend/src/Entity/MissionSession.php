<?php

namespace App\Entity;

use App\Enum\SessionStatus;
use App\Repository\MissionSessionRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * A learner's playthrough of one Mission - a new sibling table to Session
 * rather than a widened Session (mirrors how ChallengeSession was added
 * for the Daily Challenge instead of reusing Session, since Session's own
 * scenario_id FK is NOT NULL/RESTRICT and can't become polymorphic).
 */
#[ORM\Entity(repositoryClass: MissionSessionRepository::class)]
#[ORM\Table(name: 'mission_sessions')]
#[ORM\Index(name: 'idx_mission_sessions_user_id', columns: ['user_id'])]
#[ORM\Index(name: 'idx_mission_sessions_mission_id', columns: ['mission_id'])]
#[ORM\Index(name: 'idx_mission_sessions_status', columns: ['status'])]
class MissionSession
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Mission::class)]
    #[ORM\JoinColumn(name: 'mission_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Mission $mission;

    #[ORM\Column(name: 'xp_earned')]
    private int $xpEarned = 0;

    #[ORM\Column(type: 'string', enumType: SessionStatus::class, columnDefinition: "session_status NOT NULL DEFAULT 'in_progress'")]
    private SessionStatus $status = SessionStatus::IN_PROGRESS;

    #[ORM\Column(name: 'started_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(name: 'ended_at', type: 'datetimetz_immutable', nullable: true)]
    private ?\DateTimeImmutable $endedAt = null;

    /**
     * Same shape as Session::$summaryData (SessionSummaryService::summarize()'s
     * return value) - persisted so a finished mission's bilan survives reload.
     *
     * @var array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string}|null
     */
    #[ORM\Column(name: 'summary_data', type: 'json', nullable: true)]
    private ?array $summaryData = null;

    /** @var Collection<int, MissionMessage> */
    #[ORM\OneToMany(targetEntity: MissionMessage::class, mappedBy: 'missionSession', orphanRemoval: true)]
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

    public function getMission(): Mission
    {
        return $this->mission;
    }

    public function setMission(Mission $mission): static
    {
        $this->mission = $mission;

        return $this;
    }

    public function getXpEarned(): int
    {
        return $this->xpEarned;
    }

    public function setXpEarned(int $xpEarned): static
    {
        $this->xpEarned = $xpEarned;

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

    /** @return array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string}|null */
    public function getSummaryData(): ?array
    {
        return $this->summaryData;
    }

    /** @param array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string} $summaryData */
    public function setSummaryData(array $summaryData): static
    {
        $this->summaryData = $summaryData;

        return $this;
    }

    /** @return Collection<int, MissionMessage> */
    public function getMessages(): Collection
    {
        return $this->messages;
    }

    public function addMessage(MissionMessage $message): static
    {
        if (!$this->messages->contains($message)) {
            $this->messages->add($message);
            $message->setMissionSession($this);
        }

        return $this;
    }
}
