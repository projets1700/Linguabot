<?php

namespace App\Tests\Service;

use App\Entity\Level;
use App\Entity\Scenario;
use App\Enum\ScenarioCategory;
use App\Service\VoiceService;
use PHPUnit\Framework\TestCase;

final class VoiceServiceTest extends TestCase
{
    private VoiceService $service;

    protected function setUp(): void
    {
        $this->service = new VoiceService();
    }

    public function testOpeningMessageIncludesTheCharacterName(): void
    {
        $level = (new Level())->setCode('A1')->setName('Grands débuts')->setXpThreshold(300)->setOrderNum(1);
        $scenario = (new Scenario())
            ->setCode('QA1-2')
            ->setTitle('Commander au café')
            ->setContext('Demander un café, un jus, l\'addition')
            ->setLevel($level)
            ->setCategory(ScenarioCategory::QUOTIDIEN)
            ->setPromptTemplate('...')
            ->setCharacterName('Waiter / Barista')
            ->setDurationEstimate(10)
            ->setBaseXp(60);

        $opening = $this->service->openingMessage($scenario);

        self::assertStringContainsString('Waiter / Barista', $opening);
    }

    public function testOpeningMessageNeverLeaksTheFrenchCatalogueContext(): void
    {
        // Scenario::context/title are French catalogue copy for the learner
        // choosing a scenario; they must never end up in the spoken (English)
        // conversation itself.
        $level = (new Level())->setCode('A1')->setName('Grands débuts')->setXpThreshold(300)->setOrderNum(1);
        $scenario = (new Scenario())
            ->setCode('QA1-2')
            ->setTitle('Commander au café')
            ->setContext('Demander un café, un jus, l\'addition')
            ->setLevel($level)
            ->setCategory(ScenarioCategory::QUOTIDIEN)
            ->setPromptTemplate('...')
            ->setCharacterName('Waiter / Barista')
            ->setDurationEstimate(10)
            ->setBaseXp(60);

        $opening = $this->service->openingMessage($scenario);

        self::assertStringNotContainsString('Demander un café', $opening);
        self::assertStringNotContainsString('Commander au café', $opening);
    }

    public function testTranscribeAudioTrimsWhitespace(): void
    {
        self::assertSame('hello there', $this->service->transcribeAudio('  hello there  '));
    }

    public function testGenerateAnswerCyclesThroughRepliesByTurnNumber(): void
    {
        $first = $this->service->generateAnswer('hi', 0);
        $second = $this->service->generateAnswer('hi', 1);
        $sameAsFirst = $this->service->generateAnswer('hi', 6); // wraps around (6 replies in the pool)

        self::assertNotSame($first, $second);
        self::assertSame($first, $sameAsFirst);
    }

    public function testSynthesizeSpeechIsSimulatedAndReturnsNull(): void
    {
        self::assertNull($this->service->synthesizeSpeech('Hello!'));
    }
}
