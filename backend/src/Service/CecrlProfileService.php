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
 *     summaryStrengths: int,
 *     summaryReviewPoints: int,
 *     summaryExpressions: int,
 *     supportGuidance: string,
 * }
 */
final class CecrlProfileService
{
    /**
     * Appended to supportGuidance only for the specific turn where the
     * learner explicitly signaled they're stuck (frontend's
     * detectLearnerBlock()) - same wording at every level, since it's the
     * level's own aiComplexityInstruction (already part of the combined
     * prompt) that keeps the example itself at the right vocabulary.
     */
    private const BLOCKED_INSTRUCTION = 'The learner just indicated they do not know how to answer or do not '.
        'understand the question (V1 explicit "I don\'t know" detection). Briefly and kindly acknowledge this '.
        'without making them feel bad - never say "wrong" or similar. Then give exactly ONE example sentence '.
        'they could say to answer the previous question, clearly presented as one possible answer among others, '.
        'not the only correct one. Then continue the conversation naturally.';

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
            'summaryStrengths' => 1,
            'summaryReviewPoints' => 1,
            'summaryExpressions' => 2,
            'supportGuidance' => 'If the learner seems stuck or gives an unclear answer, offer help often and '.
                'warmly with a very short, simple example sentence. If their answer has a grammar error, do not '.
                'point it out unless it truly blocks understanding - keep the conversation moving.',
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
            'summaryStrengths' => 2,
            'summaryReviewPoints' => 1,
            'summaryExpressions' => 2,
            'supportGuidance' => 'Offer help often when the learner seems stuck, with a simple example sentence. '.
                'Only gently reformulate an answer when the error is obvious and simple to fix, in one short '.
                'natural sentence, then move on.',
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
            'summaryStrengths' => 2,
            'summaryReviewPoints' => 2,
            'summaryExpressions' => 3,
            'supportGuidance' => 'Offer help when the learner seems stuck, with a short example. Reformulate an '.
                'obvious error briefly, without dwelling on it, then continue.',
        ],
        'B1' => [
            'questionCountMax' => 12,
            'aiComplexityInstruction' => 'The learner is an intermediate speaker (CEFR B1). Use natural, '.
                'everyday sentences and ask follow-up questions that invite an opinion or a short justification.',
            'transcriptMode' => 'onDemand',
            'translationMode' => 'rare',
            'keywordHelpEnabled' => false,
            'sentenceStarterEnabled' => false,
            'summaryStrengths' => 3,
            'summaryReviewPoints' => 2,
            'summaryExpressions' => 3,
            'supportGuidance' => 'Only step in with a correction or an example when it truly adds value - do not '.
                'interrupt for minor issues. Keep any reformulation short and natural.',
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
            'summaryStrengths' => 3,
            'summaryReviewPoints' => 3,
            'summaryExpressions' => 4,
            'supportGuidance' => 'Rarely interrupt. Only offer a correction for a genuinely significant error or '.
                'a distinctly unnatural phrasing, phrased briefly, then continue the conversation naturally.',
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
     * How much detail SessionSummaryService should ask the AI for in an
     * end-of-session bilan - more for a more advanced learner, matching the
     * V1 spec's "A0/A1: 1 à 2 points positifs, 1 point à revoir... B1/B2:
     * feedback plus précis". Backend-only (prompt-building detail, not
     * exposed to the frontend, same as aiComplexityInstruction).
     *
     * @return array{strengths: int, reviewPoints: int, expressions: int}
     */
    public function summaryDepth(string $levelCode): array
    {
        $profile = $this->forLevelCode($levelCode);

        return [
            'strengths' => $profile['summaryStrengths'],
            'reviewPoints' => $profile['summaryReviewPoints'],
            'expressions' => $profile['summaryExpressions'],
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

    /**
     * How much LinguaBot should step in to help/correct, adapted to level
     * (V1 spec: "plus le niveau augmente, moins LinguaBot interrompt
     * automatiquement") and, for this specific turn, whether the learner
     * just explicitly signaled they're stuck (frontend's
     * detectLearnerBlock()). Combined with buildSystemPromptPrefix() in the
     * caller's system prompt - kept separate from it since one is about
     * vocabulary/sentence complexity and this one is about when/how much to
     * intervene, two different concerns.
     */
    public function buildSupportInstruction(string $levelCode, bool $learnerBlocked): string
    {
        $profile = $this->forLevelCode($levelCode);
        $instruction = $profile['supportGuidance'];

        if ($learnerBlocked) {
            $instruction .= ' '.self::BLOCKED_INSTRUCTION;
        }

        return $instruction;
    }
}
