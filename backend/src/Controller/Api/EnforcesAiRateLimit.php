<?php

namespace App\Controller\Api;

use App\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\RateLimiter\RateLimiterFactory;

/**
 * Shared by every controller action that calls out to the external AI
 * provider (session/daily-challenge message, hint, translate; placement-test
 * message) - a single `ai_calls` bucket per user (config/packages/rate_limiter.yaml),
 * so a loop hitting several of these endpoints back to back can't multiply
 * its effective quota by spreading requests across routes.
 */
trait EnforcesAiRateLimit
{
    private function rejectIfAiRateLimited(RateLimiterFactory $aiCallsLimiter, User $user): ?JsonResponse
    {
        if ($aiCallsLimiter->create((string) $user->getId())->consume()->isAccepted()) {
            return null;
        }

        return new JsonResponse(['message' => 'Trop de requêtes, réessaie dans un instant.'], 429);
    }
}
