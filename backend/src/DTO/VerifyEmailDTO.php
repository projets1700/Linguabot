<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

final class VerifyEmailDTO
{
    #[Assert\NotBlank]
    public string $token = '';
}
