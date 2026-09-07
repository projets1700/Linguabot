<?php

namespace App\Service;

use App\Entity\Scenario;

/**
 * Conversation logic for scenario sessions and the daily challenge (TP
 * chapitre 12.2). STT/TTS are real and run in the browser (VoiceInput/
 * speakText); generateAnswer() calls real GPT-4o via OpenAiChatService when
 * OPENAI_API_KEY is configured, and transparently falls back to a fixed
 * pool of encouraging replies otherwise - the app works either way.
 */
final class VoiceService
{
    /**
     * A learner's own words that are at least this many words long can be
     * judged reliably; anything shorter (e.g. "I don't know") is left alone
     * since a couple of incidentally-shared words would look artificially
     * "echoed" by pure chance.
     */
    private const MIN_WORDS_TO_JUDGE = 3;

    /**
     * Fraction of the learner's words that must also appear in the AI's own
     * last message for an answer to be treated as an echo rather than a
     * genuine (if short or reworded) reply.
     */
    private const ECHO_OVERLAP_THRESHOLD = 0.8;

    /**
     * Common phrasings for "I didn't catch that, say it again" - matched
     * loosely (substring, case-insensitive) since these are short, fixed
     * expressions rather than open-ended sentences worth a word-overlap
     * heuristic like isEchoOfQuestion().
     */
    private const REPEAT_REQUEST_PATTERNS = [
        'repeat',
        'again',
        'pardon',
        "didn't understand",
        'did not understand',
        "don't understand",
        'do not understand',
        'what did you say',
        'come again',
        'one more time',
    ];

    private const SIMULATED_REPLIES = [
        "That's interesting! Can you tell me more about that?",
        'I see. What happened next?',
        'Great, thank you for explaining. Could you say that in other words?',
        "Perfect. Let's continue - what would you like to do now?",
        'Good job! Your English is improving. Keep going.',
        'I understand. Can you describe that a bit more?',
    ];

    public function __construct(
        private readonly OpenAiChatService $openAiChatService,
    ) {
    }

    /**
     * Scenario::context/title are intentionally French (catalogue copy for
     * a French-speaking learner choosing a scenario) - they must never be
     * injected into the spoken conversation itself, which stays 100%
     * English (CDCF §1.2 "zéro saisie texte" / full voice immersion).
     */
    public function openingMessage(Scenario $scenario): string
    {
        return \sprintf(
            "Hello! I'm %s. Go ahead, say something to get started!",
            $scenario->getCharacterName(),
        );
    }

    /**
     * The frontend already does real speech-to-text in the browser
     * (VoiceInput, Web Speech API) and sends the recognized text here, so
     * this is just a trim - no server-side transcription needed.
     */
    public function transcribeAudio(string $input): string
    {
        return trim($input);
    }

    /**
     * Real GPT-4o reply when an API key is configured, playing the
     * character described by $systemPrompt and grounded in the actual
     * conversation so far; falls back to a fixed pool of encouraging
     * replies (cycled by turn number, ignoring content - the pre-AI
     * behaviour) if no key is set or the call fails for any reason.
     *
     * @param array<int, array{role: string, content: string}> $conversationHistory OpenAI-style {role, content} pairs, oldest first, already including the learner's latest message
     */
    public function generateAnswer(string $systemPrompt, array $conversationHistory, int $turnNumber): string
    {
        $reply = $this->openAiChatService->chat([
            ['role' => 'system', 'content' => $systemPrompt],
            ...$conversationHistory,
        ]);

        return $reply ?? self::SIMULATED_REPLIES[$turnNumber % \count(self::SIMULATED_REPLIES)];
    }

    /**
     * Rejects a "reply" that is really just the AI's own last question
     * bouncing back - the mic picking up the app's own voice through the
     * speakers (acoustic feedback) rather than the learner speaking. This
     * is a defence-in-depth server-side check: the frontend already stops
     * listening while the AI talks, but if that ever regresses (or a
     * browser's echo cancellation falls short), this stops the corrupted
     * "answer" from ever being recorded, instead of silently accepting it
     * and, for the placement test, deriving a level from it.
     *
     * Word-overlap based rather than exact/substring matching: real STT
     * output rarely matches the question verbatim (dropped articles,
     * "you've" vs "you", punctuation), so this asks "how much of what the
     * learner supposedly said also appears in the AI's own last message?"
     * rather than requiring an exact echo.
     */
    public function isEchoOfQuestion(string $answer, string $lastAssistantMessage): bool
    {
        $answerWords = self::normalizeToWords($answer);
        if (\count($answerWords) < self::MIN_WORDS_TO_JUDGE) {
            return false;
        }

        $availableWords = array_count_values(self::normalizeToWords($lastAssistantMessage));

        $matched = 0;
        foreach ($answerWords as $word) {
            if (($availableWords[$word] ?? 0) > 0) {
                ++$matched;
                --$availableWords[$word];
            }
        }

        return ($matched / \count($answerWords)) >= self::ECHO_OVERLAP_THRESHOLD;
    }

    /**
     * True STT never happened here, but the simulated conversation logic
     * (generateAnswer/PlacementTestService::nextQuestion) doesn't actually
     * understand anything either - without this, a learner saying "sorry,
     * can you repeat that?" gets treated as a real answer and the
     * conversation just moves on, never actually repeating itself.
     */
    public function isRepeatRequest(string $answer): bool
    {
        $normalized = mb_strtolower($answer);

        foreach (self::REPEAT_REQUEST_PATTERNS as $pattern) {
            if (str_contains($normalized, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Re-says the AI's last message instead of moving the conversation
     * forward, for when isRepeatRequest() catches a "come again?" turn.
     */
    public function repeatMessage(string $lastAssistantMessage): string
    {
        return \sprintf("No worries, I'll say it again: %s", $lastAssistantMessage);
    }

    /**
     * @return string[]
     */
    private static function normalizeToWords(string $text): array
    {
        $cleaned = preg_replace("/[^\p{L}\p{N}\s']/u", ' ', mb_strtolower($text));

        return preg_split('/\s+/', trim($cleaned ?? ''), -1, PREG_SPLIT_NO_EMPTY);
    }
}
