<?php

namespace App\Tests\Command;

use App\Entity\User;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

final class PurgeDeletedAccountsCommandTest extends ApiTestCase
{
    public function testPurgesAccountsSoftDeletedMoreThan24HoursAgo(): void
    {
        $client = static::createClient();
        $overdueEmail = 'purge-overdue-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $overdueEmail);
        $this->softDeleteAt($overdueEmail, (new \DateTimeImmutable())->modify('-25 hours'));

        $recentEmail = 'purge-recent-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $recentEmail);
        $this->softDeleteAt($recentEmail, (new \DateTimeImmutable())->modify('-1 hour'));

        $stillActiveEmail = 'purge-active-'.uniqid().'@linguabot.fr';
        $this->registerAndGetToken($client, $stillActiveEmail);

        $this->runCommand();

        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        self::assertNull($em->getRepository(User::class)->findOneBy(['email' => $overdueEmail]), 'A soft-delete older than 24h must be purged.');
        self::assertNotNull($em->getRepository(User::class)->findOneBy(['email' => $recentEmail]), 'A soft-delete within the 24h grace period must not be purged yet.');
        self::assertNotNull($em->getRepository(User::class)->findOneBy(['email' => $stillActiveEmail]), 'An account never soft-deleted must never be purged.');
    }

    private function softDeleteAt(string $email, \DateTimeImmutable $deletedAt): void
    {
        /** @var EntityManagerInterface $em */
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull($user);
        $user->setIsActive(false);
        $user->setDeletedAt($deletedAt);
        $em->flush();
    }

    private function runCommand(): void
    {
        $application = new Application(self::$kernel);
        $command = $application->find('app:purge-deleted-accounts');
        (new CommandTester($command))->execute([]);
    }
}
