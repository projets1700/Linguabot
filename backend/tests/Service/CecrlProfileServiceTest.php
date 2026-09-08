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

    public function testTranslationModeFadesOutAsTheLevelIncreases(): void
    {
        self::assertSame('visible', $this->service->forLevelCode('A0')['translationMode']);
        self::assertSame('off', $this->service->forLevelCode('B2')['translationMode']);
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
        self::assertArrayHasKey('keywordHelpEnabled', $payload);
        self::assertArrayHasKey('sentenceStarterEnabled', $payload);
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
}
