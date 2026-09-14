<?php

namespace App\Service;

use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Audit P2-05: SessionController and DailyChallengeController's hint()/
 * translate() endpoints repeated the same tier validation, empty/length
 * checks on translate text, and response shape - only how each builds its
 * own conversation history (from SessionMessage vs ChallengeMessage)
 * actually differs, so that part stays in each controller. Rate limiting
 * (EnforcesAiRateLimit) is a separate, already-shared concern, not
 * duplicated here either.
 */
final class LearningAidRequestHandler
{
    public function __construct(
        private readonly LearningAidService $learningAidService,
        private readonly CecrlProfileService $cecrlProfileService,
    ) {
    }

    /**
     * @param array<int, array{role: string, content: string}> $conversationHistory
     *
     * @return array{tier: int, content: string}|JsonResponse A JsonResponse (422) on an invalid tier - callers return it as-is; otherwise the payload to wrap in their own JsonResponse.
     */
    public function hint(array $conversationHistory, int $tier, string $levelCode): array|JsonResponse
    {
        if ($tier < 1 || $tier > 3) {
            return new JsonResponse(['message' => 'Palier d\'aide invalide.'], 422);
        }

        $levelInstruction = $this->cecrlProfileService->complexityInstruction($levelCode);

        return [
            'tier' => $tier,
            'content' => $this->learningAidService->hint($conversationHistory, $tier, $levelInstruction),
        ];
    }

    /**
     * @return array{translation: string}|JsonResponse A JsonResponse (422) on a missing/oversized text - callers return it as-is; otherwise the payload to wrap in their own JsonResponse.
     */
    public function translate(string $text): array|JsonResponse
    {
        $text = trim($text);
        if ('' === $text) {
            return new JsonResponse(['message' => 'Texte manquant.'], 422);
        }

        $tooLong = AiInputLimits::rejectIfTooLong($text, AiInputLimits::MAX_TRANSLATE_TEXT_LENGTH);
        if (null !== $tooLong) {
            return $tooLong;
        }

        return ['translation' => $this->learningAidService->translate($text)];
    }
}
