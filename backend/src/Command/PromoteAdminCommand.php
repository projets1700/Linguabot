<?php

namespace App\Command;

use App\Enum\UserRole;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:promote-admin', description: 'Donne le rôle ROLE_ADMIN à un utilisateur existant')]
final class PromoteAdminCommand extends Command
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('email', InputArgument::REQUIRED, "Email de l'utilisateur à promouvoir");
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $email = (string) $input->getArgument('email');
        $user = $this->userRepository->findByEmail($email);

        if (null === $user) {
            $output->writeln(\sprintf('<error>Aucun utilisateur trouvé pour "%s".</error>', $email));

            return Command::FAILURE;
        }

        $user->setRole(UserRole::ADMIN);
        $this->em->flush();

        $output->writeln(\sprintf('<info>%s est maintenant ROLE_ADMIN.</info>', $email));

        return Command::SUCCESS;
    }
}
