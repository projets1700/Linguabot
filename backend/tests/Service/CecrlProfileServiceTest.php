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
        self::assertArrayHasKey('transcriptMode', $payload);
        self::assertArrayHasKey('translationMode', $payload);
        self::assertArrayHasKey('keywordHelpEnabled', $payload);
        self::assertArrayHasKey('sentenceStarterEnabled', $payload);
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
}
