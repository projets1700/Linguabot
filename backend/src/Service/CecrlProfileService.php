<?php

namespace App\Service;

/**
 * Single source of truth for how much help a learner gets, driven purely by
 * their CECRL level (A0-B2) - deterministic and identical for every learner
 * at a given level, not personalized yet (V1 scope, see
 * Evolution/V1_amélioration_de_l'expérience_utilisateurs.docx §21: "éviter
 * de disperser les règles A0-B2 dans chaque page").
 *
 * @phpstan-type Profile array{
 *     questionCountMax: int,
 *     aiComplexityInstruction: string,
 *     transcriptMode: 'auto'|'available'|'onDemand',
 *     translationMode: 'visible'|'onDemand'|'rare'|'off',
 *     keywordHelpEnabled: bool,
 *     sentenceStarterEnabled: bool,
 * }
 */
final class CecrlProfileService
{
    /**
     * @var array<string, Profile>
     */
    private const PROFILES = [
        'A0' => [
            'questionCountMax' => 5,
            'aiComplexityInstruction' => 'The learner is a complete beginner (CEFR A0). Use very short sentences '.
                '(5-8 words), only the most common everyday words, and one idea per message. Keep a warm, '.
                'reassuring tone and ask exactly one short question at a time.',
            'transcriptMode' => 'auto',
            'translationMode' => 'visible',
            'keywordHelpEnabled' => true,
            'sentenceStarterEnabled' => true,
        ],
        'A1' => [
            'questionCountMax' => 7,
            'aiComplexityInstruction' => 'The learner is a beginner (CEFR A1). Use short, simple sentences and '.
                'common vocabulary. Ask simple questions, one at a time, and offer an easy reformulation if the '.
                'learner seems stuck.',
            'transcriptMode' => 'auto',
            'translationMode' => 'onDemand',
            'keywordHelpEnabled' => true,
            'sentenceStarterEnabled' => true,
        ],
        'A2' => [
            'questionCountMax' => 9,
            'aiComplexityInstruction' => 'The learner is a lower-intermediate speaker (CEFR A2). Use moderate '.
                'sentences with a bit more context, and ask questions that invite a couple of connected pieces '.
                'of information rather than a single word.',
            'transcriptMode' => 'available',
            'translationMode' => 'onDemand',
            'keywordHelpEnabled' => true,
            'sentenceStarterEnabled' => false,
        ],
        'B1' => [
            'questionCountMax' => 12,
            'aiComplexityInstruction' => 'The learner is an intermediate speaker (CEFR B1). Use natural, '.
                'everyday sentences and ask follow-up questions that invite an opinion or a short justification.',
            'transcriptMode' => 'onDemand',
            'translationMode' => 'rare',
            'keywordHelpEnabled' => false,
            'sentenceStarterEnabled' => false,
        ],
        'B2' => [
            'questionCountMax' => 15,
            'aiComplexityInstruction' => 'The learner is an advanced speaker (CEFR B2). Use natural, nuanced '.
                'language with richer sentence structures and longer utterances, and ask follow-up questions '.
                'that invite argumentation, examples and nuance.',
            'transcriptMode' => 'onDemand',
            'translationMode' => 'off',
            'keywordHelpEnabled' => false,
            'sentenceStarterEnabled' => false,
        ],
    ];

    /**
     * @return Profile
     */
    public function forLevelCode(string $levelCode): array
    {
        return self::PROFILES[$levelCode] ?? self::PROFILES['A0'];
    }

    /**
     * The subset of the profile the frontend actually needs to decide what
     * to show by default - internal prompting details
     * (aiComplexityInstruction, questionCountMax) stay server-side.
     *
     * @return array{transcriptMode: string, translationMode: string, keywordHelpEnabled: bool, sentenceStarterEnabled: bool}
     */
    public function publicPayload(string $levelCode): array
    {
        $profile = $this->forLevelCode($levelCode);

        return [
            'transcriptMode' => $profile['transcriptMode'],
            'translationMode' => $profile['translationMode'],
            'keywordHelpEnabled' => $profile['keywordHelpEnabled'],
            'sentenceStarterEnabled' => $profile['sentenceStarterEnabled'],
        ];
    }

    /**
     * The instruction block prepended to a scenario/challenge's system
     * prompt (see VoiceService::generateAnswer()) - adapts vocabulary,
     * sentence length and question complexity to the learner's level, and
     * nudges the AI to start closing the conversation once it has run
     * roughly as long as this level's sessions are meant to.
     */
    public function buildSystemPromptPrefix(string $levelCode, int $turnNumber): string
    {
        $profile = $this->forLevelCode($levelCode);
        $instruction = $profile['aiComplexityInstruction'];

        if ($turnNumber >= $profile['questionCountMax']) {
            $instruction .= ' This conversation has been going on for a while now - naturally start wrapping it up in your next message.';
        }

        return $instruction;
    }
}
