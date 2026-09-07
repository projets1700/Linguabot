<?php

namespace App\Entity;

use App\Enum\AvatarType;
use App\Repository\PendingRegistrationRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Holds a registration's data until the owner clicks the verification link
 * sent by email. No row in `users` exists until that happens - re-submitting
 * the register form for the same email just refreshes this row (new token,
 * new expiry) instead of erroring, which doubles as a "resend" mechanism.
 */
#[ORM\Entity(repositoryClass: PendingRegistrationRepository::class)]
#[ORM\Table(name: 'pending_registrations')]
#[ORM\UniqueConstraint(name: 'uniq_pending_registrations_email', columns: ['email'])]
#[ORM\UniqueConstraint(name: 'uniq_pending_registrations_token', columns: ['token'])]
class PendingRegistration
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $email;

    #[ORM\Column(length: 100)]
    private string $prenom;

    #[ORM\Column(length: 100)]
    private string $nom;

    #[ORM\Column(name: 'password_hash', length: 255)]
    private string $passwordHash;

    #[ORM\Column(name: 'avatar_type', type: 'string', enumType: AvatarType::class, columnDefinition: "avatar_type NOT NULL DEFAULT 'male'")]
    private AvatarType $avatarType = AvatarType::MALE;

    #[ORM\Column(length: 64)]
    private string $token;

    #[ORM\Column(name: 'expires_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(name: 'created_at', type: 'datetimetz_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->refreshToken();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function getPrenom(): string
    {
        return $this->prenom;
    }

    public function setPrenom(string $prenom): static
    {
        $this->prenom = $prenom;

        return $this;
    }

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getPasswordHash(): string
    {
        return $this->passwordHash;
    }

    public function setPasswordHash(string $passwordHash): static
    {
        $this->passwordHash = $passwordHash;

        return $this;
    }

    public function getAvatarType(): AvatarType
    {
        return $this->avatarType;
    }

    public function setAvatarType(AvatarType $avatarType): static
    {
        $this->avatarType = $avatarType;

        return $this;
    }

    public function getToken(): string
    {
        return $this->token;
    }

    /**
     * Generates a fresh, unguessable token and pushes the expiry window
     * forward by an hour - called on creation and whenever the same email
     * registers again before verifying.
     */
    public function refreshToken(): static
    {
        $this->token = bin2hex(random_bytes(32));
        $this->expiresAt = (new \DateTimeImmutable())->modify('+1 hour');

        return $this;
    }

    public function getExpiresAt(): \DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function isExpired(): bool
    {
        return $this->expiresAt < new \DateTimeImmutable();
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
