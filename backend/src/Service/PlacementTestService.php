<?php

namespace App\Service;

/**
 * Drives the 5-question oral placement test (TP "test de niveau"): a fixed
 * script of increasingly demanding prompts (present tense -> narrative past
 * -> opinion/conditional -> reflection). The questions themselves stay
 * scripted on purpose - every learner gets the same, CEFR-progression-ordered
 * test - but evaluateLevel() asks a real LLM examiner to judge the answers
 * when AI_API_KEY is configured (Groq by default, OpenAI-compatible),
 * falling back to a simulated word-count heuristic otherwise (see
 * evaluateLevelHeuristically()).
 */
final class PlacementTestService
{
    private const QUESTIONS = [
        "Hi! Let's start easy: what's your name, and where are you from?",
        'Nice to meet you! Can you tell me about your daily routine? What do you usually do in the morning?',
        'What did you do last weekend? Tell me about something fun you did recently.',
        'If you could change one thing about your city, what would it be, and why?',
        "Describe a challenge you've faced and how you dealt with it. What did you learn from it?",
    ];

    public function __construct(
        private readonly AiChatService $aiChatService,
    ) {
    }

    public function totalQuestions(): int
    {
        return \count(self::QUESTIONS);
    }

    public function openingMessage(): string
    {
        return "Hello! I'm your LinguaBot examiner. We're going to have a short conversation, ".
            "about 3 to 5 minutes - just answer naturally, there's no wrong answer. ".
            self::QUESTIONS[0];
    }

    /**
     * @param int $answeredCount how many questions the learner has already answered
     */
    public function nextQuestion(int $answeredCount): ?string
    {
        return self::QUESTIONS[$answeredCount] ?? null;
    }

    public function closingMessage(): string
    {
        return "Great, thank you! That's the end of the test - let's see your result.";
    }

    /**
     * @param string[] $userAnswers
     */
    public function evaluateLevel(array $userAnswers): string
    {
        return $this->evaluateLevelWithAi($userAnswers) ?? $this->evaluateLevelHeuristically($userAnswers);
    }

    /**
     * Sends the full Q&A transcript to a real CEFR-examiner-prompted LLM
     * call, judging grammar, vocabulary, complexity and fluency instead of
     * just answer length. Returns null (never throws) whenever this can't
     * produce a trustworthy result - no API key, the call failed, or the
     * model didn't return a recognizable level code - so the caller can
     * fall back to the heuristic below.
     *
     * @param string[] $userAnswers
     */
    private function evaluateLevelWithAi(array $userAnswers): ?string
    {
        if ([] === $userAnswers) {
            return null;
        }

        $transcript = '';
        foreach (self::QUESTIONS as $i => $question) {
            $transcript .= \sprintf("Examiner: %s\nLearner: %s\n\n", $question, $userAnswers[$i] ?? '(no answer)');
        }

        $reply = $this->aiChatService->chat([
            ['role' => 'system', 'content' =>
                'You are a CEFR (Common European Framework of Reference for Languages) English placement '.
                'examiner. Given the following short oral exam transcript, assess the learner\'s English '.
                'level based on grammar accuracy, vocabulary range, sentence complexity, and fluency. '.
                'Respond with ONLY one of these exact codes and nothing else: A0, A1, A2, B1, B2.'],
            ['role' => 'user', 'content' => $transcript],
        ], temperature: 0.3, maxTokens: 10);

        if (null === $reply || !preg_match('/\b(A0|A1|A2|B1|B2)\b/', strtoupper($reply), $matches)) {
            return null;
        }

        return $matches[1];
    }

    /**
     * Pre-AI fallback: level is estimated from a single surface signal - how
     * many words the learner uses per answer on average - which correlates
     * loosely with fluency and is enough to place a beginner differently
     * from a fluent speaker, without actually understanding what was said.
     *
     * @param string[] $userAnswers
     */
    private function evaluateLevelHeuristically(array $userAnswers): string
    {
        if ([] === $userAnswers) {
            return 'A0';
        }

        $totalWords = 0;
        foreach ($userAnswers as $answer) {
            $totalWords += \count(preg_split('/\s+/', trim($answer), -1, PREG_SPLIT_NO_EMPTY));
        }
        $avgWordsPerAnswer = $totalWords / \count($userAnswers);

        return match (true) {
            $avgWordsPerAnswer < 4 => 'A0',
            $avgWordsPerAnswer < 8 => 'A1',
            $avgWordsPerAnswer < 14 => 'A2',
            $avgWordsPerAnswer < 22 => 'B1',
            default => 'B2',
        };
    }
}
