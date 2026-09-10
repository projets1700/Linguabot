<?php

namespace App\Tests\Service;

use App\Service\CecrlProfileService;
use PHPUnit\Framework\TestCase;

final class CecrlProfileServiceTest extends TestCase
{
    private CecrlProfileService $service;

    protected function setUp(): void
    {
        $this->service = new CecrlProfileService();
    }

    public function testTranscriptModeIsAutoForBeginnersAndOnDemandForAdvancedLearners(): void
    {
        self::assertSame('auto', $this->service->forLevelCode('A0')['transcriptMode']);
        self::assertSame('onDemand', $this->service->forLevelCode('B2')['transcriptMode']);
    }

    public function testTranslationModeFadesFromVisibleToRareAsTheLevelIncreases(): void
    {
        self::assertSame('visible', $this->service->forLevelCode('A0')['translationMode']);
        self::assertSame('visible', $this->service->forLevelCode('A1')['translationMode']);
        self::assertSame('visible', $this->service->forLevelCode('A2')['translationMode']);
        self::assertSame('onDemand', $this->service->forLevelCode('B1')['translationMode']);
        self::assertSame('rare', $this->service->forLevelCode('B2')['translationMode']);
    }

    public function testUnknownLevelCodeFallsBackToTheA0Profile(): void
    {
        self::assertSame($this->service->forLevelCode('A0'), $this->service->forLevelCode('does-not-exist'));
    }

    public function testPublicPayloadOmitsInternalPromptingDetails(): void
    {
        $payload = $this->service->publicPayload('A0');

        self::assertArrayNotHasKey('aiComplexityInstruction', $payload);
        self::assertArrayNotHasKey('questionCountMax', $payload);
        self::assertArrayNotHasKey('summaryStrengths', $payload);
        self::assertArrayHasKey('transcriptMode', $payload);
        self::assertArrayHasKey('translationMode', $payload);
        self::assertArrayHasKey('hintMode', $payload);
        self::assertArrayHasKey('helpVisibleByDefault', $payload);
    }

    // --- hintMode: shape of the aid once shown, unaffected by whether it's shown automatically ---

    public function testA0AndA1GetTheFullAnswerHintMode(): void
    {
        self::assertSame('fullAnswer', $this->service->publicPayload('A0')['hintMode']);
        self::assertSame('fullAnswer', $this->service->publicPayload('A1')['hintMode']);
    }

    public function testA2AndB1GetTheKeywordsOnlyHintMode(): void
    {
        self::assertSame('keywords', $this->service->publicPayload('A2')['hintMode']);
        self::assertSame('keywords', $this->service->publicPayload('B1')['hintMode']);
    }

    public function testB2KeepsTheProgressiveHintLadderOnceHelpIsUnlocked(): void
    {
        self::assertSame('progressive', $this->service->publicPayload('B2')['hintMode']);
    }

    // --- helpVisibleByDefault: whether the aid is shown unprompted (V1.1 LOT 3) ---

    public function testHelpVisibleByDefaultIsTrueThroughA2AndFalseFromB1On(): void
    {
        self::assertTrue($this->service->publicPayload('A0')['helpVisibleByDefault']);
        self::assertTrue($this->service->publicPayload('A1')['helpVisibleByDefault']);
        self::assertTrue($this->service->publicPayload('A2')['helpVisibleByDefault']);
        self::assertFalse($this->service->publicPayload('B1')['helpVisibleByDefault']);
        self::assertFalse($this->service->publicPayload('B2')['helpVisibleByDefault']);
    }

    public function testComplexityInstructionMatchesTheOneUsedInTheConversationPrompt(): void
    {
        $prefix = $this->service->buildSystemPromptPrefix('A2', 0);

        self::assertSame($this->service->complexityInstruction('A2'), $prefix);
    }

    public function testSummaryDepthGrowsWithLevel(): void
    {
        $a0 = $this->service->summaryDepth('A0');
        $b2 = $this->service->summaryDepth('B2');

        self::assertSame(['strengths' => 1, 'reviewPoints' => 1, 'expressions' => 2], $a0);
        self::assertSame(['strengths' => 3, 'reviewPoints' => 3, 'expressions' => 4], $b2);
    }

    public function testBuildSystemPromptPrefixMentionsWrappingUpOnceThePerLevelQuestionCeilingIsReached(): void
    {
        $early = $this->service->buildSystemPromptPrefix('A0', 1);
        $late = $this->service->buildSystemPromptPrefix('A0', 10);

        self::assertStringNotContainsString('wrapping', $early);
        self::assertStringContainsString('wrapping', $late);
    }

    public function testBuildSystemPromptPrefixAlwaysIncludesTheLevelComplexityInstruction(): void
    {
        $prefix = $this->service->buildSystemPromptPrefix('B2', 0);

        self::assertStringContainsString('CEFR B2', $prefix);
    }

    public function testSupportInstructionWithoutBlockingIsJustTheLevelsOwnGuidance(): void
    {
        $a0 = $this->service->buildSupportInstruction('A0', false);
        $b2 = $this->service->buildSupportInstruction('B2', false);

        self::assertStringNotContainsString('do not know how to answer', $a0);
        self::assertStringNotContainsString('do not know how to answer', $b2);
        self::assertNotSame($a0, $b2);
    }

    public function testSupportInstructionMentionsInterruptingLessAtHigherLevels(): void
    {
        $a0 = $this->service->buildSupportInstruction('A0', false);
        $b2 = $this->service->buildSupportInstruction('B2', false);

        self::assertStringContainsString('often', $a0);
        self::assertStringContainsString('Rarely interrupt', $b2);
    }

    public function testSupportInstructionAppendsTheBlockedGuidanceOnlyWhenLearnerIsBlocked(): void
    {
        $notBlocked = $this->service->buildSupportInstruction('A1', false);
        $blocked = $this->service->buildSupportInstruction('A1', true);

        self::assertStringNotContainsString('exactly ONE example sentence', $notBlocked);
        self::assertStringContainsString('exactly ONE example sentence', $blocked);
        // Never presented as the single correct answer.
        self::assertStringContainsString('not the only correct one', $blocked);
    }

    public function testBlockedInstructionNeverTellsTheAiToSayWrong(): void
    {
        $blocked = $this->service->buildSupportInstruction('A0', true);

        self::assertStringContainsString('never say "wrong"', $blocked);
    }

    public function testBlockedInstructionStatesItsPriorityOverTheCorrectionPolicy(): void
    {
        $blocked = $this->service->buildSupportInstruction('A1', true);

        self::assertStringContainsString('takes priority', $blocked);
    }

    // --- buildConversationInstruction(): the fully composed, labeled prompt ---

    public function testConversationInstructionContainsAllLabeledSectionsWhenNotBlocked(): void
    {
        $instruction = $this->service->buildConversationInstruction('A1', 1, false);

        self::assertStringContainsString('CECRL behavior:', $instruction);
        self::assertStringContainsString('Correction policy:', $instruction);
        self::assertStringContainsString('Learner support:', $instruction);
        self::assertStringNotContainsString('Blocked learner behavior:', $instruction);
    }

    public function testConversationInstructionAddsTheBlockedSectionOnlyWhenLearnerIsBlocked(): void
    {
        $blocked = $this->service->buildConversationInstruction('A1', 1, true);

        self::assertStringContainsString('Blocked learner behavior:', $blocked);
        self::assertStringContainsString('exactly ONE example sentence', $blocked);
        self::assertStringContainsString('not the only correct one', $blocked);
    }

    public function testConversationInstructionNeverPresentsTheExampleAsTheOnlyCorrectAnswer(): void
    {
        $blocked = $this->service->buildConversationInstruction('A1', 1, true);

        self::assertStringNotContainsString('the correct answer', $blocked);
        self::assertStringNotContainsString('the only correct answer', $blocked);
    }

    public function testConversationInstructionReusesBuildSystemPromptPrefixVerbatimInTheCecrlSection(): void
    {
        $prefix = $this->service->buildSystemPromptPrefix('B1', 3);
        $instruction = $this->service->buildConversationInstruction('B1', 3, false);

        self::assertStringContainsString($prefix, $instruction);
    }

    public function testCorrectionPolicyPrefersNaturalRephrasingAndAvoidsGradingLanguage(): void
    {
        $instruction = $this->service->buildConversationInstruction('B1', 1, false);

        self::assertStringContainsString('A more natural way to say it is', $instruction);
        self::assertStringContainsString('never say things like "you made a grammar error"', $instruction);
        self::assertStringNotContainsString('/100', $instruction);
        // The words "score"/"grade" do appear, but only inside the
        // instruction telling the AI never to mention one - confirmed by
        // checking that exact surrounding phrase rather than mere absence.
        self::assertStringContainsString('never mention a grade, a score', $instruction);
    }

    public function testCorrectionPolicyAsksToContinueNaturallyAfterward(): void
    {
        $instruction = $this->service->buildConversationInstruction('B2', 1, false);

        self::assertStringContainsString('continue the conversation naturally', $instruction);
    }

    public function testCorrectionPolicyDiscouragesCorrectingEverySmallMistake(): void
    {
        $instruction = $this->service->buildConversationInstruction('B1', 1, false);

        self::assertStringContainsString('never for every small mistake', $instruction);
    }

    // --- Per-level reinforcement (V1 spec §5) ---

    public function testA0NeverLeavesTheLearnerStuckForLong(): void
    {
        self::assertStringContainsString('never leave them stuck for long', $this->service->buildSupportInstruction('A0', false));
    }

    public function testA2LetsTheLearnerDevelopTheirOwnAnswer(): void
    {
        self::assertStringContainsString('develop their own answer', $this->service->buildSupportInstruction('A2', false));
    }

    public function testB1OffersHelpMostlyOnRequestAndConsidersRecurringErrors(): void
    {
        $b1 = $this->service->buildSupportInstruction('B1', false);

        self::assertStringContainsString('mostly when asked', $b1);
        self::assertStringContainsString('recurring', $b1);
    }

    public function testB2ExplicitlyPrioritizesFluentConversation(): void
    {
        self::assertStringContainsString('fluent', $this->service->buildSupportInstruction('B2', false));
    }

    public function testAssistanceVerifiablyDecreasesAcrossAllFiveLevels(): void
    {
        $a0 = $this->service->buildSupportInstruction('A0', false);
        $a1 = $this->service->buildSupportInstruction('A1', false);
        $a2 = $this->service->buildSupportInstruction('A2', false);
        $b1 = $this->service->buildSupportInstruction('B1', false);
        $b2 = $this->service->buildSupportInstruction('B2', false);

        // A0/A1: proactive, frequent help.
        self::assertStringContainsString('often', $a0);
        self::assertStringContainsString('often', $a1);
        // A2: still offers help, but explicitly makes room for the learner.
        self::assertStringContainsString('develop their own answer', $a2);
        // B1: help becomes reactive ("mostly when asked") rather than proactive.
        self::assertStringContainsString('mostly when asked', $b1);
        // B2: the fewest interventions of all five.
        self::assertStringContainsString('Rarely interrupt', $b2);
    }
}
