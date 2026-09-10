<?php

namespace App\Controller\Api;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class OnboardingController
{
    #[Route('/api/onboarding/complete', name: 'api_onboarding_complete', methods: ['POST'])]
    public function complete(#[CurrentUser] User $user, EntityManagerInterface $em): JsonResponse
    {
        $user->setOnboardingCompleted(true);
        $em->flush();

        return new JsonResponse(['onboardingCompleted' => true]);
    }
}
