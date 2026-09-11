<?php

namespace App\Tests\Service;

use App\Entity\Level;
use App\Entity\Scenario;
use App\Enum\ScenarioCategory;
use App\Service\AiChatService;
use App\Service\CecrlProfileService;
use App\Service\VoiceService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class VoiceServiceTest extends TestCase
{
    private VoiceService $service;

    protected function setUp(): void
    {
        // Empty API key: AiChatService::chat() short-circuits to null
        // without any HTTP call, so generateAnswer() always exercises its
        // simulated fallback in these tests (the AI-path itself is covered
        // separately, with a mocked response).
        $this->service = new VoiceService(
            new AiChatService(new MockHttpClient(), '', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );
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

    public function testGenerateAnswerFallsBackToSimulatedRepliesCyclingByTurnNumberWithNoApiKey(): void
    {
        $first = $this->service->generateAnswer('system prompt', [], 0);
        $second = $this->service->generateAnswer('system prompt', [], 1);
        $sameAsFirst = $this->service->generateAnswer('system prompt', [], 6); // wraps around (6 replies in the pool)

        self::assertNotSame($first, $second);
        self::assertSame($first, $sameAsFirst);
    }

    public function testGenerateAnswerUsesTheGenericBlockedFallbackInsteadOfTheCyclingPoolWhenNoApiKeyAndLearnerBlocked(): void
    {
        $reply = $this->service->generateAnswer('system prompt', [], 0, null, true);

        self::assertStringNotContainsString('interesting', $reply); // not one of the ordinary SIMULATED_REPLIES
        self::assertStringContainsString('short', $reply);
    }

    public function testGenerateAnswerBlockedFallbackIsAlwaysTheSameGenericReplyRegardlessOfTurnNumber(): void
    {
        $first = $this->service->generateAnswer('system prompt', [], 0, null, true);
        $later = $this->service->generateAnswer('system prompt', [], 4, null, true);

        self::assertSame($first, $later);
    }

    public function testGenerateAnswerLearnerBlockedHasNoEffectWhenTheRealAiReplySucceeds(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'A real, contextual reply about breakfast.']]],
            ])),
        ]);
        $service = new VoiceService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );

        $reply = $service->generateAnswer('system prompt', [
            ['role' => 'user', 'content' => "I don't know."],
        ], 0, null, true);

        self::assertSame('A real, contextual reply about breakfast.', $reply);
    }

    public function testGenerateAnswerUsesTheRealAiReplyWhenTheApiCallSucceeds(): void
    {
        $mockClient = new MockHttpClient([
            new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'A real, contextual GPT-4o reply.']]],
            ])),
        ]);
        $service = new VoiceService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );

        $reply = $service->generateAnswer('You are a friendly waiter.', [
            ['role' => 'user', 'content' => "I'd like a coffee, please."],
        ], 0);

        self::assertSame('A real, contextual GPT-4o reply.', $reply);
    }

    public function testGenerateAnswerPrependsTheLevelInstructionToTheSystemPromptSentToTheAi(): void
    {
        $capturedMessages = null;
        $mockClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedMessages): MockResponse {
            $body = $options['body'] ?? null;
            $capturedMessages = json_decode(\is_string($body) ? $body : json_encode($options['json'] ?? []), true)['messages'] ?? [];

            return new MockResponse(json_encode([
                'choices' => [['message' => ['content' => 'A reply.']]],
            ]));
        });
        $service = new VoiceService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );

        $service->generateAnswer('You are a friendly waiter.', [
            ['role' => 'user', 'content' => "I'd like a coffee, please."],
        ], 0, 'Speak very simply, CEFR A0 level.');

        self::assertStringContainsString('Speak very simply, CEFR A0 level.', $capturedMessages[0]['content']);
        self::assertStringContainsString('You are a friendly waiter.', $capturedMessages[0]['content']);
    }

    public function testGenerateAnswerWorksWithoutALevelInstruction(): void
    {
        $reply = $this->service->generateAnswer('system prompt', [], 0);

        self::assertNotEmpty($reply);
    }

    public function testGenerateAnswerSendsThePerLevelTemperatureAndMaxTokens(): void
    {
        $capturedBody = null;
        $mockClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedBody): MockResponse {
            $body = $options['body'] ?? null;
            $capturedBody = json_decode(\is_string($body) ? $body : json_encode($options['json'] ?? []), true);

            return new MockResponse(json_encode(['choices' => [['message' => ['content' => 'A reply.']]]]));
        });
        $service = new VoiceService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );

        $service->generateAnswer('system prompt', [], 0, null, false, 'A0');

        // Matches CecrlProfileService::aiCallTuning('A0') exactly.
        self::assertSame(0.6, $capturedBody['temperature']);
        self::assertSame(100, $capturedBody['max_tokens']);
    }

    public function testGenerateAnswerTrimsTheHistorySentToTheAiToTheLastMessages(): void
    {
        $capturedMessages = null;
        $mockClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedMessages): MockResponse {
            $body = $options['body'] ?? null;
            $capturedMessages = json_decode(\is_string($body) ? $body : json_encode($options['json'] ?? []), true)['messages'] ?? [];

            return new MockResponse(json_encode(['choices' => [['message' => ['content' => 'A reply.']]]]));
        });
        $service = new VoiceService(
            new AiChatService($mockClient, 'fake-key', 'https://example.test/chat', 'gpt-4o-mini'),
            new CecrlProfileService(),
        );

        $history = [];
        for ($i = 0; $i < 20; ++$i) {
            $history[] = ['role' => 0 === $i % 2 ? 'user' : 'assistant', 'content' => "message {$i}"];
        }

        $service->generateAnswer('system prompt', $history, 0);

        // 1 system message + the last 12 of the 20 history messages (message 8..19).
        self::assertCount(13, $capturedMessages);
        self::assertSame('message 8', $capturedMessages[1]['content']);
        self::assertSame('message 19', $capturedMessages[12]['content']);
    }

    #[DataProvider('repeatRequestProvider')]
    public function testIsRepeatRequest(string $answer, bool $expected): void
    {
        self::assertSame($expected, $this->service->isRepeatRequest($answer));
    }

    public static function repeatRequestProvider(): array
    {
        return [
            'plain repeat' => ['Can you repeat that, please?', true],
            'again' => ['Sorry, say that again?', true],
            'pardon' => ['Pardon?', true],
            "didn't understand" => ["Sorry, I didn't understand.", true],
            'do not understand (no contraction)' => ['I do not understand the question.', true],
            'what did you say' => ['Wait, what did you say?', true],
            'come again' => ['Come again?', true],
            'one more time' => ['Could you say that one more time?', true],
            'case insensitive' => ['REPEAT PLEASE', true],
            'genuine answer, no trigger words' => ['My name is Adam and I live in Paris.', false],
            'genuine answer mentioning an unrelated topic' => ['I went to the market again yesterday.', true], // "again" is a real trigger word even mid-sentence - accepted false-positive risk, see note below
        ];
    }

    public function testRepeatMessageRestatesTheOriginalWithoutAlteringIt(): void
    {
        $repeated = $this->service->repeatMessage('What did you do last weekend?');

        self::assertStringContainsString('What did you do last weekend?', $repeated);
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
