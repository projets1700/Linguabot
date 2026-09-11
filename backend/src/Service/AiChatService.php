<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
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
        #[Autowire(service: 'monolog.logger.ai')]
        private readonly LoggerInterface $logger = new NullLogger(),
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

        $startedAt = microtime(true);
        $providerMs = null;

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

            // toArray() is what actually blocks waiting for/parsing the
            // provider's response - request() itself returns immediately
            // (Symfony HttpClient is async-capable), so this is the
            // narrowest measurement of real provider round-trip time
            // (V1.1 LOT 5 §8.2 "distinguer temps total / temps fournisseur").
            $providerStartedAt = microtime(true);
            $data = $response->toArray();
            $providerMs = (int) round((microtime(true) - $providerStartedAt) * 1000);
        } catch (\Throwable) {
            // Network error, timeout, non-2xx status, malformed JSON,
            // invalid/expired/rate-limited key - all treated the same way:
            // the caller falls back to its simulated reply.
            $this->logger->info('ai_chat_call', [
                'model' => $this->model,
                'totalMs' => (int) round((microtime(true) - $startedAt) * 1000),
                'providerMs' => $providerMs,
                'success' => false,
            ]);

            return null;
        }

        $content = $data['choices'][0]['message']['content'] ?? null;
        $success = \is_string($content) && '' !== trim($content);

        $this->logger->info('ai_chat_call', [
            'model' => $this->model,
            'totalMs' => (int) round((microtime(true) - $startedAt) * 1000),
            'providerMs' => $providerMs,
            'success' => $success,
            'usage' => $data['usage'] ?? null,
        ]);

        return $success ? trim($content) : null;
    }
}
