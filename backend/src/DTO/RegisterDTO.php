<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

final class RegisterDTO
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    public string $prenom = '';

    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    public string $nom = '';

    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 255)]
    public string $email = '';

    #[Assert\NotBlank]
    #[Assert\Length(min: 8, max: 4096)]
    public string $password = '';
}
