<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Thin wrapper around OpenAI's Chat Completions API - the one place that
 * actually talks to a real LLM. Every caller (VoiceService, PlacementTestService)
 * treats a null return as "fall back to the simulated reply": no API key
 * configured, the request failed, timed out, or OpenAI returned something
 * unusable. The conversation must never break just because the AI call did.
 */
final class OpenAiChatService
{
    private const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    private const TIMEOUT_SECONDS = 15;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly string $apiKey,
        private readonly string $model,
    ) {
    }

    /**
     * @param array<int, array{role: string, content: string}> $messages
     */
    public function chat(array $messages, float $temperature = 0.7, int $maxTokens = 250): ?string
    {
        if ('' === $this->apiKey) {
            return null;
        }

        try {
            $response = $this->httpClient->request('POST', self::ENDPOINT, [
                'headers' => [
                    'Authorization' => \sprintf('Bearer %s', $this->apiKey),
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'model' => $this->model,
                    'messages' => $messages,
                    'temperature' => $temperature,
                    'max_tokens' => $maxTokens,
                ],
                'timeout' => self::TIMEOUT_SECONDS,
            ]);

            $data = $response->toArray();
        } catch (\Throwable) {
            // Network error, timeout, non-2xx status, malformed JSON,
            // invalid/expired/rate-limited key - all treated the same way:
            // the caller falls back to its simulated reply.
            return null;
        }

        $content = $data['choices'][0]['message']['content'] ?? null;
        if (!\is_string($content) || '' === trim($content)) {
            return null;
        }

        return trim($content);
    }
}
