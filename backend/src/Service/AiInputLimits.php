<?php

namespace App\Service;

use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Audit A4: the rate limiter (EnforcesAiRateLimit) caps how OFTEN a learner
 * can call an AI-backed endpoint, but nothing capped how LARGE a single
 * payload could be - a learner could submit a message/translation text of
 * unbounded length, driving up AI provider cost/latency and memory use for
 * no pedagogical reason (a real spoken turn is a sentence or two, not
 * thousands of characters). Centralized here so every caller enforces the
 * same limit rather than picking its own magic number.
 */
final class AiInputLimits
{
    /** A spoken conversational turn - generous for a real sentence or two, well short of anything a learner would legitimately dictate. */
    public const MAX_MESSAGE_LENGTH = 2000;

    /** The AI's own question/line being translated - same order of magnitude as a message. */
    public const MAX_TRANSLATE_TEXT_LENGTH = 2000;

    /**
     * Returns a 422 JsonResponse if $text exceeds $maxLength, or null if
     * it's within bounds - callers return the response immediately when
     * non-null, same short-circuit shape as EnforcesAiRateLimit::rejectIfAiRateLimited().
     */
    public static function rejectIfTooLong(string $text, int $maxLength): ?JsonResponse
    {
        if (mb_strlen($text) <= $maxLength) {
            return null;
        }

        return new JsonResponse([
            'message' => \sprintf('Texte trop long (%d caractères maximum).', $maxLength),
        ], 422);
    }
}
