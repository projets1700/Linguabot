<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Exchanges the long-lived Azure Speech subscription key for a short-lived
 * (10 min) bearer token - the frontend only ever sees this token, never the
 * raw key, same pattern as every other provider key in this project.
 *
 * Mirrors AiChatService's fallback contract: no key/region configured, a
 * network error, or a non-2xx response all resolve to null rather than an
 * exception, so speech.ts can silently fall back to speechSynthesis.
 */
final class AzureSpeechTokenService
{
    private const TIMEOUT_SECONDS = 10;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly string $subscriptionKey,
        private readonly string $region,
    ) {
    }

    /**
     * @return array{token: string, region: string}|null
     */
    public function issueToken(): ?array
    {
        if ('' === $this->subscriptionKey || '' === $this->region) {
            return null;
        }

        try {
            $response = $this->httpClient->request(
                'POST',
                \sprintf('https://%s.api.cognitive.microsoft.com/sts/v1.0/issueToken', $this->region),
                [
                    'headers' => [
                        'Ocp-Apim-Subscription-Key' => $this->subscriptionKey,
                        'Content-Type' => 'application/x-www-form-urlencoded',
                        'Content-Length' => '0',
                    ],
                    'timeout' => self::TIMEOUT_SECONDS,
                ],
            );

            // Plain-text token, not JSON - getContent() throws on a non-2xx
            // status the same way toArray() does elsewhere in this project.
            $token = $response->getContent();
        } catch (\Throwable) {
            return null;
        }

        if ('' === trim($token)) {
            return null;
        }

        return ['token' => trim($token), 'region' => $this->region];
    }
}
