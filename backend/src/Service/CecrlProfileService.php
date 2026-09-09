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
     *
     * Explicitly states its own priority over the correction policy below
     * (V1 spec: a blocked learner must be helped to answer, never
     * corrected on how they phrased "I don't know" instead).
     */
    private const BLOCKED_INSTRUCTION = 'The learner just indicated they do not know how to answer or do not '.
        'understand the question (V1 explicit "I don\'t know" detection). This takes priority over the '.
        'correction policy below for this turn - focus entirely on helping them answer, not on correcting how '.
        'they phrased their "I don\'t know". Briefly and kindly acknowledge this without making them feel bad - '.
        'never say "wrong" or similar. Then give exactly ONE example sentence they could say to answer '.
        'the previous question, at the vocabulary level described above, clearly presented as one possible '.
        'answer among others, not the only correct one. Keep your whole reply short. Then continue the '.
        'conversation naturally.';

    /**
     * Level-independent phrasing policy for any correction/reformulation
     * (V1 spec §3: distinguish an error worth reformulating from one to
     * let go, and never phrase it like a grading remark). Always included
     * in the composed prompt, regardless of level or blocking - the
     * per-level supportGuidance below controls WHETHER/how often to
     * correct, this controls HOW to phrase it when it does.
     */
    private const CORRECTION_POLICY_INSTRUCTION = 'When you do offer a correction or reformulation, keep it '.
        'short, natural, and encouraging - never mention a grade, a score, or a technical grammar term, and '.
        'never say things like "you made a grammar error" or "that is wrong". Prefer a natural rephrasing such '.
        'as "A more natural way to say it is: ...". Only correct when it genuinely helps understanding or '.
        'sounds significantly more natural - never for every small mistake. Always continue the conversation '.
        'naturally afterward.';

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
                'warmly with a very short, simple example sentence - never leave them stuck for long. If their '.
                'answer has a grammar error, do not point it out unless it truly blocks understanding - keep '.
                'the conversation moving.',
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
                'Reformulate an answer fairly visibly, as a short teaching moment, when the error is obvious and '.
                'simple to fix, then move on.',
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
            'supportGuidance' => 'Offer help when the learner seems stuck, with a short example. Let the '.
                'learner develop their own answer rather than jumping in - reformulate mainly when the error is '.
                'significant, briefly and without dwelling on it.',
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
            'supportGuidance' => 'Offer help mostly when asked, rather than proactively. Only correct an error '.
                'that is significant or that keeps recurring in this turn - prioritize the flow of the '.
                'conversation over precision.',
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
            'supportGuidance' => 'Rarely interrupt. Only offer a correction for a genuinely significant error, a '.
                'distinctly unnatural phrasing, or real ambiguity, phrased briefly. Prioritize natural, fluent '.
                'conversation over correction.',
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
     * intervene, two different concerns. Labeled sections (not one fragile
     * paragraph) so the underlying instructions stay easy to read/audit -
     * see buildConversationInstruction() for the fully composed prompt.
     */
    public function buildSupportInstruction(string $levelCode, bool $learnerBlocked): string
    {
        $profile = $this->forLevelCode($levelCode);
        $instruction = 'Learner support: '.$profile['supportGuidance'];

        if ($learnerBlocked) {
            $instruction .= "\n\nBlocked learner behavior: ".self::BLOCKED_INSTRUCTION;
        }

        return $instruction;
    }

    /**
     * The full CECRL-driven conversation instruction for one turn of a
     * scenario/challenge session: complexity/pacing (buildSystemPromptPrefix),
     * the level-independent correction phrasing policy, and how much to
     * help/correct this turn (buildSupportInstruction, including the
     * blocked-learner behavior when applicable) - each its own labeled
     * section rather than one large paragraph, per the V1 spec's request
     * for a structured system prompt ("Conversation style / Learner
     * support / Correction policy / Blocked learner behavior / CECRL
     * behavior"). Prepended, never replacing, the scenario's own
     * promptTemplate (see VoiceService::generateAnswer()), which already
     * covers character/role - not duplicated here.
     */
    public function buildConversationInstruction(string $levelCode, int $turnNumber, bool $learnerBlocked): string
    {
        return implode("\n\n", [
            'CECRL behavior: '.$this->buildSystemPromptPrefix($levelCode, $turnNumber),
            'Correction policy: '.self::CORRECTION_POLICY_INSTRUCTION,
            $this->buildSupportInstruction($levelCode, $learnerBlocked),
        ]);
    }
}
