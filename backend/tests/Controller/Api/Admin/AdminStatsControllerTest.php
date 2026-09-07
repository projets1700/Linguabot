<?php

namespace App\Tests\Controller\Api\Admin;

use App\Enum\UserRole;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class AdminStatsControllerTest extends ApiTestCase
{
    public function testStatsEndpointReturnsExpectedShape(): void
    {
        $client = static::createClient();
        $email = 'admin-stats-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'GET', '/api/admin/stats', $token);

        self::assertResponseIsSuccessful();
        $stats = $this->decodeResponse($client);

        foreach (['usersCount', 'scenariosCount', 'sessionsCount', 'completionRate', 'levelDistribution', 'topScenarios', 'sessionsByDay', 'challengeParticipationRate', 'xpDistributedToday'] as $key) {
            self::assertArrayHasKey($key, $stats);
        }
        self::assertSame(40, $stats['scenariosCount']);
        self::assertCount(5, $stats['levelDistribution']);
    }

    public function testBadgesAndTrophiesEndpointsListAllCatalogueEntries(): void
    {
        $client = static::createClient();
        $email = 'admin-gami-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'GET', '/api/admin/badges', $token);
        self::assertResponseIsSuccessful();
        self::assertCount(12, $this->decodeResponse($client));

        $this->jsonRequest($client, 'GET', '/api/admin/trophies', $token);
        self::assertResponseIsSuccessful();
        self::assertCount(6, $this->decodeResponse($client));
    }

    private function promoteToAdmin(string $email): void
    {
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(\App\Entity\User::class)->findOneBy(['email' => $email]);
        $user->setRole(UserRole::ADMIN);
        $em->flush();
    }
}
