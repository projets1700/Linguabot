<?php

namespace App\Service;

use App\Entity\DailyChallenge;
use App\Entity\Level;
use App\Repository\DailyChallengeRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Simulated GPT-4o challenge generation (TP chapitre 15.2, CDCF §3.7). A
 * fixed pool of hand-written challenges per level stands in for the real
 * prompt-to-GPT-4o call; the console command below (and the RG06 uniqueness
 * constraint) is the real, cron-ready piece of the architecture.
 */
final class DailyChallengeService
{
    private const BASE_XP_BY_LEVEL = [
        'A0' => 30,
        'A1' => 60,
        'A2' => 100,
        'B1' => 150,
        'B2' => 200,
    ];

    /**
     * [title, context, objective, keywords, characterName][] per level.
     */
    private const TEMPLATES = [
        'A0' => [
            ['The Missing Cat', "Your neighbor's cat is missing and they are worried.", 'Ask simple questions to help find the cat.', ['cat', 'help', 'where'], 'Neighbor'],
            ['New Friend at School', "A new student just arrived and doesn't know anyone.", 'Introduce yourself and welcome them.', ['hello', 'name', 'friend'], 'New student'],
        ],
        'A1' => [
            ['The Lost Wallet', 'You found a wallet on the street.', 'Explain the situation to a police officer and hand it over.', ['found', 'wallet', 'police'], 'Police officer'],
            ['Rainy Day Plans', "It's raining and your outdoor plans are cancelled.", 'Suggest an alternative indoor activity to a friend.', ['rain', 'indoor', 'plan'], 'Friend'],
        ],
        'A2' => [
            ['The Broken Elevator', 'The building elevator is broken and you live on the 5th floor with heavy bags.', 'Ask a neighbor for help carrying your bags.', ['elevator', 'help', 'bags'], 'Neighbor'],
            ['Surprise Party', 'You are organizing a surprise party for a friend.', 'Convince a mutual friend to help keep it secret.', ['surprise', 'secret', 'party'], 'Mutual friend'],
        ],
        'B1' => [
            ['The Unexpected Delay', 'Your train has been cancelled and you must get to an important meeting.', 'Explain the problem and ask for an alternative.', ['delay', 'alternative', 'refund'], 'Transport agent'],
            ['A Difficult Decision', 'You must choose between two job offers with different pros and cons.', 'Discuss the options and ask for advice.', ['offer', 'salary', 'decide'], 'Career advisor'],
        ],
        'B2' => [
            ['The Misunderstanding', 'A colleague misunderstood your email and is upset.', 'Clarify the misunderstanding calmly and professionally.', ['misunderstanding', 'clarify', 'apologize'], 'Colleague'],
            ['Negotiating a Contract', 'You are negotiating the terms of a freelance contract.', 'Discuss payment terms and deadlines professionally.', ['contract', 'deadline', 'payment'], 'Client'],
        ],
    ];

    public function __construct(
        private readonly DailyChallengeRepository $dailyChallengeRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function baseXpForLevel(string $levelCode): int
    {
        return self::BASE_XP_BY_LEVEL[$levelCode] ?? 60;
    }

    /**
     * Idempotent: returns today's challenge for the level, generating it on
     * the fly if the nightly command hasn't run yet (dev/demo convenience -
     * in production the console command below, scheduled at 00h01, is what
     * actually populates this ahead of time).
     */
    public function findOrCreateTodaysChallenge(Level $level): DailyChallenge
    {
        $today = new \DateTimeImmutable('today');
        $existing = $this->dailyChallengeRepository->findForLevelAndDate($level, $today);
        if (null !== $existing) {
            return $existing;
        }

        return $this->generateAndPersist($level, $today);
    }

    public function generateAndPersist(Level $level, \DateTimeImmutable $date): DailyChallenge
    {
        $pool = self::TEMPLATES[$level->getCode()] ?? self::TEMPLATES['A1'];
        [$title, $context, $objective, $keywords, $characterName] = $pool[array_rand($pool)];

        $challenge = (new DailyChallenge())
            ->setLevel($level)
            ->setTitle($title)
            ->setContext($context)
            ->setObjective($objective)
            ->setKeywords($keywords)
            ->setCharacterName($characterName)
            ->setChallengeDate($date);

        $this->em->persist($challenge);
        $this->em->flush();

        return $challenge;
    }
}
