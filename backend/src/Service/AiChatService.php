<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Thin wrapper around a Chat Completions API - the one place that actually
 * talks to a real LLM. Provider-agnostic on purpose: OpenAI, Groq, and most
 * other hosted-inference providers (Together.ai, OpenRouter, a local Ollama
 * server, ...) all speak this same request/response shape, so switching is
 * just AI_API_BASE_URL/AI_MODEL, no code change. Defaults to Groq (a free
 * tier, unlike OpenAI's pay-as-you-go).
 *
 * Every caller (VoiceService, PlacementTestService) treats a null return as
 * "fall back to the simulated reply": no API key configured, the request
 * failed, timed out, or the provider returned something unusable. The
 * conversation must never break just because the AI call did.
 */
final class AiChatService
{
    private const TIMEOUT_SECONDS = 15;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly string $apiKey,
        private readonly string $baseUrl,
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
            $response = $this->httpClient->request('POST', $this->baseUrl, [
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
