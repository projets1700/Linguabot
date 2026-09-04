<?php

namespace App\Entity;

use App\Repository\QuizQuestionRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: QuizQuestionRepository::class)]
#[ORM\Table(name: 'quiz_questions')]
#[ORM\UniqueConstraint(name: 'uniq_quiz_questions_module_order', columns: ['module_id', 'order_num'])]
class QuizQuestion
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: QuizModule::class)]
    #[ORM\JoinColumn(name: 'module_id', referencedColumnName: 'id', nullable: false)]
    private QuizModule $module;

    #[ORM\Column(name: 'question_text', type: 'text')]
    private string $questionText;

    #[ORM\Column(name: 'correct_answer', length: 200)]
    private string $correctAnswer;

    #[ORM\Column(name: 'order_num', type: 'smallint')]
    private int $orderNum;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getModule(): QuizModule
    {
        return $this->module;
    }

    public function setModule(QuizModule $module): static
    {
        $this->module = $module;

        return $this;
    }

    public function getQuestionText(): string
    {
        return $this->questionText;
    }

    public function setQuestionText(string $questionText): static
    {
        $this->questionText = $questionText;

        return $this;
    }

    public function getCorrectAnswer(): string
    {
        return $this->correctAnswer;
    }

    public function setCorrectAnswer(string $correctAnswer): static
    {
        $this->correctAnswer = $correctAnswer;

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
}
