<?php

namespace App\Service;

/**
 * On-demand learning aids: progressive hints ("Je suis bloqué", V1 spec §11)
 * and translation (§9). Reachable by any learner regardless of their CECRL
 * level (RF-03: an aid a level's profile doesn't show by default must still
 * be reachable manually) - CecrlProfileService only shapes what the frontend
 * surfaces up front, never what this service will answer on request.
 *
 * Reuses the same AiChatService chokepoint as VoiceService rather than a new
 * provider, with short/low-temperature prompts and a graceful French
 * fallback message (never a raw failure) when no AI key is configured.
 */
final class LearningAidService
{
    /**
     * @var array<int, string>
     */
    private const HINT_INSTRUCTIONS = [
        1 => 'You are a helpful English tutor. Give only 3 to 5 key English words or short phrases '.
            '(comma-separated) the learner could use to answer the last question. No full sentence, no '.
            'explanation, no extra commentary.',
        2 => 'You are a helpful English tutor. Give only a short English sentence starter (a few words) the '.
            'learner could complete to answer the last question. No explanation, no extra commentary.',
        3 => 'You are a helpful English tutor. Give only one complete, natural English example answer to the '.
            'last question. No explanation, no extra commentary.',
    ];

    private const HINT_FALLBACK = "Aide indisponible pour le moment - réessaie dans quelques instants.";

    private const TRANSLATION_FALLBACK = "Traduction indisponible pour le moment.";

    public function __construct(
        private readonly AiChatService $aiChatService,
    ) {
    }

    /**
     * @param array<int, array{role: string, content: string}> $conversationHistory Recent turns, oldest first, normally ending with the AI's own last question
     */
    public function hint(array $conversationHistory, int $tier): string
    {
        $instruction = self::HINT_INSTRUCTIONS[$tier] ?? self::HINT_INSTRUCTIONS[1];

        // Only the last few turns are needed for context - keeps the hint
        // call small and fast regardless of how long the conversation is.
        $reply = $this->aiChatService->chat([
            ['role' => 'system', 'content' => $instruction],
            ...\array_slice($conversationHistory, -6),
        ], 0.4, 60);

        return $reply ?? self::HINT_FALLBACK;
    }

    public function translate(string $text): string
    {
        $reply = $this->aiChatService->chat([
            ['role' => 'system', 'content' => 'Translate the following English sentence into French. Reply with only the translation, nothing else.'],
            ['role' => 'user', 'content' => $text],
        ], 0.2, 80);

        return $reply ?? self::TRANSLATION_FALLBACK;
    }
}
