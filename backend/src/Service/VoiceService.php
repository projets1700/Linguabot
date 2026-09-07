<?php

namespace App\Service;

use App\Entity\Scenario;

/**
 * Simulated STT -> LLM -> TTS pipeline (TP chapitre 12.2). No real audio
 * capture or OpenAI call happens yet: the frontend sends typed text and gets
 * a scripted reply back. Whisper/GPT-4o/TTS wiring replaces the innards of
 * this class in a later chapter without changing SessionController's contract.
 */
final class VoiceService
{
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
}
