<?php

namespace App\Service;

/**
 * Generates the qualitative part of an end-of-session bilan (V1 spec §16):
 * a short summary, a few strengths/review points, useful expressions
 * actually used, and a next-step suggestion. Objective facts (exchange
 * count, XP, status, scenario) are computed by SessionController itself and
 * never asked of the AI - this service only ever fills in the parts that
 * genuinely require reading the conversation.
 *
 * No phonetic or numeric linguistic score is ever produced here (V1 spec:
 * "pas de faux score de prononciation") - the AI is explicitly instructed
 * never to output one, and the deterministic fallback below never invents
 * one either.
 */
final class SessionSummaryService
{
    private const MAX_TOKENS = 500;

    private const SYSTEM_PROMPT_TEMPLATE = <<<'PROMPT'
        You are a supportive English conversation coach reviewing the transcript of a practice session for a learner at CEFR level %s.

        Rules you must follow exactly:
        - Base every comment ONLY on the conversation transcript given to you as the following messages. Never invent mistakes, words, topics, or events that are not actually present in it.
        - You are reading text, not hearing audio: you cannot measure pronunciation, accent, or phonetics. Never claim to, and never mention pronunciation quality at all.
        - Never output a numeric score, a percentage, or anything formatted like "82/100" or "75%%" - for anything.
        - Keep every comment short, specific to this conversation, and encouraging without being vague ("good job" alone is not useful).
        - If the learner only said a few short words across the whole session, say so plainly in the summary instead of inventing a detailed analysis you cannot actually support.
        - Write at a level appropriate for this learner: %s
        - Respond with ONLY a single JSON object, no markdown fences, no extra text, matching exactly this shape:
        {"summary": "one or two sentences", "strengths": ["...", up to %d items], "reviewPoints": ["...", up to %d items], "usefulExpressions": ["...", up to %d items actually said in the conversation], "nextStep": "one short, concrete suggestion"}
        PROMPT;

    public function __construct(
        private readonly AiChatService $aiChatService,
        private readonly CecrlProfileService $cecrlProfileService,
    ) {
    }

    /**
     * @param array<int, array{role: string, content: string}> $conversationHistory oldest first, as stored on the session
     *
     * @return array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string}
     */
    public function summarize(array $conversationHistory, string $levelCode, int $exchangeCount, string $scenarioTitle): array
    {
        // Nothing to actually analyze - skip the AI call entirely rather
        // than asking it to comment on silence.
        if ($exchangeCount < 1) {
            return $this->deterministicFallback($exchangeCount, $scenarioTitle);
        }

        $profile = $this->cecrlProfileService->forLevelCode($levelCode);
        $depth = $this->cecrlProfileService->summaryDepth($levelCode);

        $systemPrompt = \sprintf(
            self::SYSTEM_PROMPT_TEMPLATE,
            $levelCode,
            $profile['aiComplexityInstruction'],
            $depth['strengths'],
            $depth['reviewPoints'],
            $depth['expressions'],
        );

        $raw = $this->aiChatService->chat([
            ['role' => 'system', 'content' => $systemPrompt],
            ...$conversationHistory,
        ], 0.5, self::MAX_TOKENS);

        if (null === $raw) {
            return $this->deterministicFallback($exchangeCount, $scenarioTitle);
        }

        $parsed = $this->parseAiResponse($raw);
        if (null === $parsed) {
            return $this->deterministicFallback($exchangeCount, $scenarioTitle);
        }

        return [
            'summary' => $parsed['summary'],
            'strengths' => \array_slice($parsed['strengths'], 0, $depth['strengths']),
            'reviewPoints' => \array_slice($parsed['reviewPoints'], 0, $depth['reviewPoints']),
            'usefulExpressions' => \array_slice($parsed['usefulExpressions'], 0, $depth['expressions']),
            'nextStep' => $parsed['nextStep'],
        ];
    }

    /**
     * @return array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string}
     */
    private function deterministicFallback(int $exchangeCount, string $scenarioTitle): array
    {
        $summary = 0 === $exchangeCount
            ? \sprintf('Session terminée dans le scénario "%s" sans échange enregistré.', $scenarioTitle)
            : \sprintf(
                'Session terminée. Tu as réalisé %d échange%s dans le scénario "%s".',
                $exchangeCount,
                $exchangeCount > 1 ? 's' : '',
                $scenarioTitle,
            );

        return [
            'summary' => $summary,
            'strengths' => [],
            'reviewPoints' => [],
            'usefulExpressions' => [],
            'nextStep' => 'Rejoue ce scénario ou essaie-en un nouveau pour continuer à progresser.',
        ];
    }

    /**
     * Defensive parsing: the model is instructed to return pure JSON, but
     * nothing here trusts that blindly. Any missing/malformed field
     * degrades to an empty value; a genuinely unusable response (no
     * summary at all) returns null so the caller falls back entirely,
     * rather than showing a half-empty AI-generated bilan.
     *
     * @return array{summary: string, strengths: string[], reviewPoints: string[], usefulExpressions: string[], nextStep: string}|null
     */
    private function parseAiResponse(string $raw): ?array
    {
        $cleaned = trim($raw);
        // The model occasionally wraps its JSON in a ```json fence despite
        // being told not to - stripped defensively rather than trusted away.
        $cleaned = preg_replace('/^```(?:json)?\s*|\s*```$/', '', $cleaned) ?? $cleaned;

        $decoded = json_decode($cleaned, true);
        if (!\is_array($decoded)) {
            return null;
        }

        $summary = \is_string($decoded['summary'] ?? null) ? trim($decoded['summary']) : '';
        if ('' === $summary) {
            return null;
        }

        return [
            'summary' => $summary,
            'strengths' => $this->toStringList($decoded['strengths'] ?? null),
            'reviewPoints' => $this->toStringList($decoded['reviewPoints'] ?? null),
            'usefulExpressions' => $this->toStringList($decoded['usefulExpressions'] ?? null),
            'nextStep' => \is_string($decoded['nextStep'] ?? null) ? trim($decoded['nextStep']) : '',
        ];
    }

    /**
     * @return string[]
     */
    private function toStringList(mixed $value): array
    {
        if (!\is_array($value)) {
            return [];
        }

        $strings = array_map(
            static fn (mixed $item): string => \is_string($item) ? trim($item) : '',
            $value,
        );

        return array_values(array_filter($strings, static fn (string $item): bool => '' !== $item));
    }
}
