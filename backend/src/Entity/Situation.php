<?php

namespace App\Entity;

use App\Repository\SituationRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SituationRepository::class)]
#[ORM\Table(name: 'situations')]
#[ORM\Index(name: 'idx_situations_room_id', columns: ['room_id'])]
class Situation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Room::class, inversedBy: 'situations')]
    #[ORM\JoinColumn(name: 'room_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Room $room;

    #[ORM\Column(length: 20, unique: true)]
    private string $code;

    #[ORM\Column(length: 200)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(name: 'order_num', type: 'smallint')]
    private int $orderNum;

    #[ORM\Column(name: 'is_active')]
    private bool $isActive = true;

    /** @var Collection<int, Mission> */
    #[ORM\OneToMany(targetEntity: Mission::class, mappedBy: 'situation')]
    private Collection $missions;

    public function __construct()
    {
        $this->missions = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getRoom(): Room
    {
        return $this->room;
    }

    public function setRoom(Room $room): static
    {
        $this->room = $room;

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

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;

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

    /** @return Collection<int, Mission> */
    public function getMissions(): Collection
    {
        return $this->missions;
    }
}
