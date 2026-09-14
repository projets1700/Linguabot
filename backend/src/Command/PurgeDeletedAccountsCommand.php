<?php

namespace App\Command;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Audit A7: AccountController::delete()/AdminUserController::delete() only
 * ever soft-delete (RG12) - their own comments said the physical hard
 * delete after the 24h grace period "would be a scheduled Messenger task in
 * production", but no such task actually existed, so a soft-deleted
 * account's data never actually got erased. Meant to be run on a schedule
 * (cron) once a real deployment exists (no such deployment target yet -
 * see the audit's own P3-08 decision to leave the production Docker stack
 * for later).
 */
#[AsCommand(name: 'app:purge-deleted-accounts', description: 'Supprime définitivement les comptes soft-supprimés depuis plus de 24h (RGPD RG12)')]
final class PurgeDeletedAccountsCommand extends Command
{
    private const GRACE_PERIOD_HOURS = 24;

    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $cutoff = (new \DateTimeImmutable())->modify(\sprintf('-%d hours', self::GRACE_PERIOD_HOURS));
        $users = $this->userRepository->findDueForPurge($cutoff);

        foreach ($users as $user) {
            $this->em->remove($user);
        }
        $this->em->flush();

        $output->writeln(\sprintf('<info>%d compte(s) purgé(s) définitivement.</info>', \count($users)));

        return Command::SUCCESS;
    }
}
