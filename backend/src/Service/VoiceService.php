<?php

namespace App\Service;

use App\Entity\Scenario;

/**
 * Simulated LLM/TTS pipeline (TP chapitre 12.2): the frontend now does real
 * browser-side STT/TTS (VoiceInput/speakText), sending the recognized text
 * here and reading the reply aloud - GPT-4o/OpenAI TTS wiring replaces the
 * innards of this class in a later chapter without changing the
 * controllers' contract.
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


    private const SIMULATED_REPLIES = [
        "That's interesting! Can you tell me more about that?",
        'I see. What happened next?',
        'Great, thank you for explaining. Could you say that in other words?',
        "Perfect. Let's continue - what would you like to do now?",
        'Good job! Your English is improving. Keep going.',
        'I understand. Can you describe that a bit more?',
    ];

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
     * Simulated Whisper STT: the frontend already sends typed text (voice
     * capture is not implemented yet), so this is a pass-through for now.
     */
    public function transcribeAudio(string $input): string
    {
        return trim($input);
    }

    /**
     * Simulated GPT-4o: rotates through a fixed set of encouraging replies
     * instead of generating a real contextual answer.
     */
    public function generateAnswer(string $userMessage, int $turnNumber): string
    {
        return self::SIMULATED_REPLIES[$turnNumber % \count(self::SIMULATED_REPLIES)];
    }

    /**
     * Simulated OpenAI TTS: no audio is actually synthesized yet.
     */
    public function synthesizeSpeech(string $text): ?string
    {
        return null;
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
     * @return string[]
     */
    private static function normalizeToWords(string $text): array
    {
        $cleaned = preg_replace("/[^\p{L}\p{N}\s']/u", ' ', mb_strtolower($text));

        return preg_split('/\s+/', trim($cleaned ?? ''), -1, PREG_SPLIT_NO_EMPTY);
    }
}
