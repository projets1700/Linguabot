<?php

namespace App\Tests\Service;

use App\Entity\Level;
use App\Entity\User;
use App\Repository\BadgeRepository;
use App\Repository\ChallengeSessionRepository;
use App\Repository\LevelRepository;
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
    private LevelRepository&\PHPUnit\Framework\MockObject\Stub $levelRepository;

    protected function setUp(): void
    {
        // calculateXp() is pure (no repository/DB access), so the
        // collaborators only need to satisfy the constructor's types.
        // A plain stub (not a mock): most tests only need canned findNext()
        // return values, not a call-count expectation - the one test that
        // does assert on calls (testCheckAndApplyLevelUpNeverAdvancesA0...)
        // creates its own local mock instead of reusing this one.
        $this->levelRepository = $this->createStub(LevelRepository::class);
        $this->service = new GamificationService(
            $this->createStub(BadgeRepository::class),
            $this->createStub(UserBadgeRepository::class),
            $this->createStub(TrophyRepository::class),
            $this->createStub(UserTrophyRepository::class),
            $this->createStub(SessionRepository::class),
            $this->createStub(ScenarioRepository::class),
            $this->createStub(QuizAttemptRepository::class),
            $this->createStub(ChallengeSessionRepository::class),
            $this->levelRepository,
            $this->createStub(EntityManagerInterface::class),
        );
    }

    private static function level(string $code, int $xpThreshold, int $orderNum): Level
    {
        return (new Level())->setCode($code)->setName($code)->setXpThreshold($xpThreshold)->setOrderNum($orderNum);
    }

    private static function userAt(Level $level, int $totalXp): User
    {
        $user = (new User())->setPrenom('Test')->setNom('User')->setEmail('test@linguabot.fr')->setLevel($level);
        $user->setTotalXp($totalXp);

        return $user;
    }

    public function testCheckAndApplyLevelUpAdvancesWhenXpThresholdIsReached(): void
    {
        $a1 = self::level('A1', 300, 1);
        $a2 = self::level('A2', 1000, 2);
        $user = self::userAt($a1, 1000);

        $this->levelRepository->method('findNext')->willReturnMap([[$a1, $a2], [$a2, null]]);

        $result = $this->service->checkAndApplyLevelUp($user);

        self::assertSame($a2, $result);
        self::assertSame($a2, $user->getLevel());
    }

    public function testCheckAndApplyLevelUpDoesNothingBelowTheNextThreshold(): void
    {
        $a1 = self::level('A1', 300, 1);
        $a2 = self::level('A2', 1000, 2);
        $user = self::userAt($a1, 999);

        $this->levelRepository->method('findNext')->willReturnMap([[$a1, $a2]]);

        self::assertNull($this->service->checkAndApplyLevelUp($user));
        self::assertSame($a1, $user->getLevel());
    }

    public function testCheckAndApplyLevelUpCanJumpSeveralLevelsAtOnce(): void
    {
        $a1 = self::level('A1', 300, 1);
        $a2 = self::level('A2', 1000, 2);
        $b1 = self::level('B1', 2500, 3);
        $b2 = self::level('B2', 5000, 4);
        // Enough XP to clear A2 and B1's thresholds in one jump, but not B2's.
        $user = self::userAt($a1, 3000);

        $this->levelRepository->method('findNext')->willReturnMap([[$a1, $a2], [$a2, $b1], [$b1, $b2]]);

        $result = $this->service->checkAndApplyLevelUp($user);

        self::assertSame($b1, $result);
        self::assertSame($b1, $user->getLevel());
    }

    public function testCheckAndApplyLevelUpNeverAdvancesA0RegardlessOfXp(): void
    {
        // RG10: A0 -> A1 is gated by passing 4/6 quiz modules
        // (QuizService::maybeUnlockA1()), never by XP alone - otherwise a
        // learner could level up purely from daily challenge XP without
        // ever passing the quiz.
        $a0 = self::level('A0', 0, 0);
        $user = self::userAt($a0, 10000);

        $levelRepository = $this->createMock(LevelRepository::class);
        $levelRepository->expects(self::never())->method('findNext');
        $service = new GamificationService(
            $this->createStub(BadgeRepository::class),
            $this->createStub(UserBadgeRepository::class),
            $this->createStub(TrophyRepository::class),
            $this->createStub(UserTrophyRepository::class),
            $this->createStub(SessionRepository::class),
            $this->createStub(ScenarioRepository::class),
            $this->createStub(QuizAttemptRepository::class),
            $this->createStub(ChallengeSessionRepository::class),
            $levelRepository,
            $this->createStub(EntityManagerInterface::class),
        );

        self::assertNull($service->checkAndApplyLevelUp($user));
        self::assertSame($a0, $user->getLevel());
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
