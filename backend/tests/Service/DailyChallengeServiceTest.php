<?php

namespace App\Tests\Service;

use App\Repository\DailyChallengeRepository;
use App\Service\DailyChallengeService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class DailyChallengeServiceTest extends TestCase
{
    private DailyChallengeService $service;

    protected function setUp(): void
    {
        $this->service = new DailyChallengeService(
            $this->createStub(DailyChallengeRepository::class),
            $this->createStub(EntityManagerInterface::class),
        );
    }

    #[DataProvider('provideLevelBaseXp')]
    public function testBaseXpForLevel(string $levelCode, int $expectedXp): void
    {
        self::assertSame($expectedXp, $this->service->baseXpForLevel($levelCode));
    }

    public static function provideLevelBaseXp(): iterable
    {
        yield 'A0' => ['A0', 30];
        yield 'A1' => ['A1', 60];
        yield 'A2' => ['A2', 100];
        yield 'B1' => ['B1', 150];
        yield 'B2' => ['B2', 200];
    }

    public function testUnknownLevelFallsBackToA1Value(): void
    {
        self::assertSame(60, $this->service->baseXpForLevel('C1'));
    }
}
