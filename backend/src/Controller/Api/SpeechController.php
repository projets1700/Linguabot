<?php

namespace App\Controller\Api;

use App\Service\AzureSpeechTokenService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class SpeechController
{
    /**
     * Short-lived Azure Speech token for the frontend's real-audio-plus-native-visemes
     * path (English only - see AzureSpeechTokenService). 204 with no body when
     * Azure isn't configured, so the frontend falls back to speechSynthesis
     * exactly as it does today.
     */
    #[Route('/api/speech/token', name: 'api_speech_token', methods: ['GET'])]
    public function token(AzureSpeechTokenService $azureSpeechTokenService): JsonResponse
    {
        $result = $azureSpeechTokenService->issueToken();
        if (null === $result) {
            return new JsonResponse(null, 204);
        }

        return new JsonResponse($result);
    }
}
