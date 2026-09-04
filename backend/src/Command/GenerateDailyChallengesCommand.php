<?php

namespace App\Command;

use App\Repository\DailyChallengeRepository;
use App\Repository\LevelRepository;
use App\Service\DailyChallengeService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * TP chapitre 15.3. Meant to run nightly at 00h01 (Symfony Scheduler in
 * production - not wired into this dev docker-compose, which has no
 * scheduler worker process; run manually or via a host cron in the
 * meantime). RG06 (one challenge per level per day) is enforced both here
 * and at the DB level via the UNIQUE(level_id, challenge_date) constraint.
 */
#[AsCommand(name: 'app:generate-daily-challenges', description: 'Génère le défi du jour pour chaque niveau CECRL')]
final class GenerateDailyChallengesCommand extends Command
{
    public function __construct(
        private readonly LevelRepository $levelRepository,
        private readonly DailyChallengeRepository $dailyChallengeRepository,
        private readonly DailyChallengeService $dailyChallengeService,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $today = new \DateTimeImmutable('today');

        foreach ($this->levelRepository->findBy([], ['orderNum' => 'ASC']) as $level) {
            if (null !== $this->dailyChallengeRepository->findForLevelAndDate($level, $today)) {
                $output->writeln(\sprintf('Défi déjà généré pour %s le %s, ignoré.', $level->getCode(), $today->format('Y-m-d')));

                continue;
            }

            $challenge = $this->dailyChallengeService->generateAndPersist($level, $today);
            $output->writeln(\sprintf('Généré pour %s : "%s"', $level->getCode(), $challenge->getTitle()));
        }

        return Command::SUCCESS;
    }
}
