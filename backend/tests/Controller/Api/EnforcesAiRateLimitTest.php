<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\EnforcesAiRateLimit;
use App\Entity\User;
use PHPUnit\Framework\TestCase;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

/**
 * Exercises EnforcesAiRateLimit's actual throttling decision directly
 * against a real Symfony RateLimiterFactory (in-memory storage, not the
 * app's configured cache) - independent of config/packages/rate_limiter.yaml,
 * whose real production limits are deliberately relaxed under when@test so
 * the rest of the HTTP-level test suite isn't itself rate-limited (see the
 * comment there).
 */
final class EnforcesAiRateLimitTest extends TestCase
{
    use EnforcesAiRateLimit;

    public function testRequestsWithinTheLimitAreAccepted(): void
    {
        $factory = new RateLimiterFactory(
            ['id' => 'ai_calls', 'policy' => 'sliding_window', 'limit' => 3, 'interval' => '1 minute'],
            new InMemoryStorage(),
        );
        $user = $this->makeUser(1);

        self::assertNull($this->rejectIfAiRateLimited($factory, $user));
        self::assertNull($this->rejectIfAiRateLimited($factory, $user));
        self::assertNull($this->rejectIfAiRateLimited($factory, $user));
    }

    public function testTheRequestThatExceedsTheLimitIsRejectedWith429(): void
    {
        $factory = new RateLimiterFactory(
            ['id' => 'ai_calls', 'policy' => 'sliding_window', 'limit' => 3, 'interval' => '1 minute'],
            new InMemoryStorage(),
        );
        $user = $this->makeUser(1);

        $this->rejectIfAiRateLimited($factory, $user);
        $this->rejectIfAiRateLimited($factory, $user);
        $this->rejectIfAiRateLimited($factory, $user);
        $rejected = $this->rejectIfAiRateLimited($factory, $user);

        self::assertNotNull($rejected);
        self::assertSame(429, $rejected->getStatusCode());
    }

    public function testTwoDifferentUsersHaveIndependentBuckets(): void
    {
        $factory = new RateLimiterFactory(
            ['id' => 'ai_calls', 'policy' => 'sliding_window', 'limit' => 1, 'interval' => '1 minute'],
            new InMemoryStorage(),
        );

        self::assertNull($this->rejectIfAiRateLimited($factory, $this->makeUser(1)));
        // A second user's first request must not be affected by user 1
        // already having used its own quota - the bucket is keyed per user.
        self::assertNull($this->rejectIfAiRateLimited($factory, $this->makeUser(2)));
    }

    private function makeUser(int $id): User
    {
        $user = new User();
        $reflection = new \ReflectionProperty(User::class, 'id');
        $reflection->setAccessible(true);
        $reflection->setValue($user, $id);

        return $user;
    }
}
