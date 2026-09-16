<?php

namespace App\Entity;

use App\Repository\RoomRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RoomRepository::class)]
#[ORM\Table(name: 'rooms')]
#[ORM\Index(name: 'idx_rooms_world_id', columns: ['world_id'])]
class Room
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: World::class, inversedBy: 'rooms')]
    #[ORM\JoinColumn(name: 'world_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private World $world;

    #[ORM\Column(length: 20, unique: true)]
    private string $code;

    #[ORM\Column(length: 200)]
    private string $title;

    /**
     * Path/URL of the room's backdrop image, composited behind a
     * transparent-background AvatarScene (same technique already used by
     * the Dashboard classroom intro) - null renders a plain gradient
     * fallback instead of a broken image, same graceful-degradation
     * principle as CLASSROOM_BACKGROUND_SRC on the frontend.
     */
    #[ORM\Column(name: 'background_image_src', length: 255, nullable: true)]
    private ?string $backgroundImageSrc = null;

    #[ORM\Column(name: 'order_num', type: 'smallint')]
    private int $orderNum;

    #[ORM\Column(name: 'is_active')]
    private bool $isActive = true;

    /** @var Collection<int, Situation> */
    #[ORM\OneToMany(targetEntity: Situation::class, mappedBy: 'room')]
    private Collection $situations;

    public function __construct()
    {
        $this->situations = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getWorld(): World
    {
        return $this->world;
    }

    public function setWorld(World $world): static
    {
        $this->world = $world;

        return $this;
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

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getBackgroundImageSrc(): ?string
    {
        return $this->backgroundImageSrc;
    }

    public function setBackgroundImageSrc(?string $backgroundImageSrc): static
    {
        $this->backgroundImageSrc = $backgroundImageSrc;

        return $this;
    }

    public function getOrderNum(): int
    {
        return $this->orderNum;
    }

    public function setOrderNum(int $orderNum): static
    {
        $this->orderNum = $orderNum;

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

    /** @return Collection<int, Situation> */
    public function getSituations(): Collection
    {
        return $this->situations;
    }
}
