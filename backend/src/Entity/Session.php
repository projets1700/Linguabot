<?php

namespace App\Entity;

use App\Enum\SessionStatus;
use App\Repository\SessionRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SessionRepository::class)]
#[ORM\Table(name: 'sessions')]
#[ORM\Index(name: 'idx_sessions_user_id', columns: ['user_id'])]
#[ORM\Index(name: 'idx_sessions_scenario_id', columns: ['scenario_id'])]
#[ORM\Index(name: 'idx_sessions_status', columns: ['status'])]
class Session
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Scenario::class)]
    #[ORM\JoinColumn(name: 'scenario_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Scenario $scenario;

    #[ORM\Column(type: 'decimal', precision: 5, scale: 2, nullable: true)]
    private ?string $score = null;

    #[ORM\Column(name: 'xp_earned')]
    private int $xpEarned = 0;

    #[ORM\Column(name: 'duration_seconds', nullable: true)]
    private ?int $durationSeconds = null;

    #[ORM\Column(type: 'string', enumType: SessionStatus::class, columnDefinition: "session_status NOT NULL DEFAULT 'in_progress'")]
    private SessionStatus $status = SessionStatus::IN_PROGRESS;

    #[ORM\Column(name: 'started_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(name: 'ended_at', type: 'datetimetz_immutable', nullable: true)]
    private ?\DateTimeImmutable $endedAt = null;

    /**
     * The qualitative end-of-session bilan (SessionSummaryService::summarize()'s
     * return shape: summary/strengths/reviewPoints/usefulExpressions/nextStep) -
     * persisted so a learner who refreshes or revisits a completed session
     * can still see it, instead of it only ever existing in the one HTTP
     * response from finish(). Null until the session is finished.
     *
     * @var array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string}|null
     */
    #[ORM\Column(name: 'summary_data', type: 'json', nullable: true)]
    private ?array $summaryData = null;

    /** @var Collection<int, SessionMessage> */
    #[ORM\OneToMany(targetEntity: SessionMessage::class, mappedBy: 'session', orphanRemoval: true)]
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

    public function getScenario(): Scenario
    {
        return $this->scenario;
    }

    public function setScenario(Scenario $scenario): static
    {
        $this->scenario = $scenario;

        return $this;
    }

    public function getScore(): ?string
    {
        return $this->score;
    }

    public function setScore(?string $score): static
    {
        $this->score = $score;

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

    public function getDurationSeconds(): ?int
    {
        return $this->durationSeconds;
    }

    public function setDurationSeconds(?int $durationSeconds): static
    {
        $this->durationSeconds = $durationSeconds;

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

    /** @return Collection<int, SessionMessage> */
    public function getMessages(): Collection
    {
        return $this->messages;
    }

    /**
     * Keeps both sides of the relation in sync so a freshly-created Session
     * reflects messages added in the same request, without needing a reload.
     */
    public function addMessage(SessionMessage $message): static
    {
        if (!$this->messages->contains($message)) {
            $this->messages->add($message);
            $message->setSession($this);
        }

        return $this;
    }
}
