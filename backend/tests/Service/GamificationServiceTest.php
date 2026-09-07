<?php

namespace App\Tests\Service;

use App\Repository\BadgeRepository;
use App\Repository\ChallengeSessionRepository;
use App\Repository\QuizAttemptRepository;
use App\Repository\ScenarioRepository;
use App\Repository\SessionRepository;
use App\Repository\TrophyRepository;
use App\Repository\UserBadgeRepository;
use App\Repository\UserTrophyRepository;
use App\Service\GamificationService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class GamificationServiceTest extends TestCase
{
    private GamificationService $service;

    protected function setUp(): void
    {
        // calculateXp() is pure (no repository/DB access), so the
        // collaborators only need to satisfy the constructor's types.
        $this->service = new GamificationService(
            $this->createStub(BadgeRepository::class),
            $this->createStub(UserBadgeRepository::class),
            $this->createStub(TrophyRepository::class),
            $this->createStub(UserTrophyRepository::class),
            $this->createStub(SessionRepository::class),
            $this->createStub(ScenarioRepository::class),
            $this->createStub(QuizAttemptRepository::class),
            $this->createStub(ChallengeSessionRepository::class),
            $this->createStub(EntityManagerInterface::class),
        );
    }

    public function testXpCalculationForHighScore(): void
    {
        self::assertSame(90, $this->service->calculateXp(60, 88));
    }

    #[DataProvider('provideScoreMultipliers')]
    public function testXpMultiplierBrackets(float $score, int $expectedXp): void
    {
        self::assertSame($expectedXp, $this->service->calculateXp(100, $score));
    }

    public static function provideScoreMultipliers(): iterable
    {
        yield 'below 50: x0.5' => [49.0, 50];
        yield 'exactly 50: x1' => [50.0, 100];
        yield '50-75: x1' => [74.0, 100];
        yield 'exactly 75: x1.5' => [75.0, 150];
        yield '75-90: x1.5' => [89.0, 150];
        yield 'exactly 90: x2' => [90.0, 200];
        yield 'perfect: x2' => [100.0, 200];
    }

    public function testXpIsRoundedToNearestInteger(): void
    {
        // 33 * 1.5 = 49.5, rounds to 50
        self::assertSame(50, $this->service->calculateXp(33, 80));
    }
}
