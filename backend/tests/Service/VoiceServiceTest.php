<?php

namespace App\Tests\Service;

use App\Entity\Level;
use App\Entity\Scenario;
use App\Enum\ScenarioCategory;
use App\Service\VoiceService;
use PHPUnit\Framework\Attributes\DataProvider;
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

    #[DataProvider('echoProvider')]
    public function testIsEchoOfQuestion(string $answer, string $lastAssistantMessage, bool $expectedEcho): void
    {
        self::assertSame($expectedEcho, $this->service->isEchoOfQuestion($answer, $lastAssistantMessage));
    }

    public static function echoProvider(): array
    {
        return [
            // Real examples pulled from a placement test corrupted by the
            // mic-picking-up-its-own-voice bug this check guards against.
            'opening self-introduction echoed back' => [
                "hello I'm your Lingard Examiner",
                "Hello! I'm your LinguaBot examiner. We're going to have a short conversation, ".
                "about 3 to 5 minutes - just answer naturally, there's no wrong answer. Hi! Let's ".
                "start easy: what's your name, and where are you from?",
                true,
            ],
            'question repeated near-verbatim' => [
                'what do you usually do in the morning',
                'Nice to meet you! Can you tell me about your daily routine? What do you usually do in the morning?',
                true,
            ],
            'question repeated with a contraction dropped' => [
                'describe a challenge you faced and how you dealt with it',
                "Describe a challenge you've faced and how you dealt with it. What did you learn from it?",
                true,
            ],
            'genuine short answer sharing no real words with the question' => [
                "I don't know",
                'If you could change one thing about your city, what would it be, and why?',
                false,
            ],
            'genuine reworded answer with only incidental overlap' => [
                'Last weekend I went hiking with some friends.',
                'What did you do last weekend? Tell me about something fun you did recently.',
                false,
            ],
            'too short to judge reliably' => [
                'Paris',
                "Hi! Let's start easy: what's your name, and where are you from?",
                false,
            ],
            'empty last assistant message never flags anything' => [
                'My name is Adam and I live in Paris.',
                '',
                false,
            ],
        ];
    }
}
