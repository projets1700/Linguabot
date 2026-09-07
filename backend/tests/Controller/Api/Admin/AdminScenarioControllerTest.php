<?php

namespace App\Tests\Controller\Api\Admin;

use App\Enum\UserRole;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

final class AdminScenarioControllerTest extends ApiTestCase
{
    public function testAdminCanCreateUpdateAndToggleAScenario(): void
    {
        $client = static::createClient();
        $email = 'admin-scenario-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'POST', '/api/admin/scenarios', $token, [
            'code' => 'TEST-'.uniqid(),
            'title' => 'Scénario de test',
            'context' => 'Contexte',
            'level' => 'A1',
            'category' => 'quotidien',
            'promptTemplate' => 'Prompt',
            'characterName' => 'Testeur',
            'durationEstimate' => 10,
            'baseXp' => 60,
        ]);
        self::assertResponseStatusCodeSame(201);
        $scenario = $this->decodeResponse($client);
        self::assertTrue($scenario['isActive']);

        $this->jsonRequest($client, 'PATCH', "/api/admin/scenarios/{$scenario['id']}", $token, ['title' => 'Titre modifié']);
        self::assertResponseIsSuccessful();
        self::assertSame('Titre modifié', $this->decodeResponse($client)['title']);

        $this->jsonRequest($client, 'PATCH', "/api/admin/scenarios/{$scenario['id']}/toggle-active", $token);
        self::assertResponseIsSuccessful();
        self::assertFalse($this->decodeResponse($client)['isActive']);
    }

    public function testCreatingAScenarioWithAnInvalidCategoryIsRejected(): void
    {
        $client = static::createClient();
        $email = 'admin-badcat-'.uniqid().'@linguabot.fr';
        $token = $this->registerAndGetToken($client, $email);
        $this->promoteToAdmin($email);

        $this->jsonRequest($client, 'POST', '/api/admin/scenarios', $token, [
            'code' => 'TEST-'.uniqid(),
            'title' => 'Scénario de test',
            'context' => 'Contexte',
            'level' => 'A1',
            'category' => 'not-a-real-category',
            'promptTemplate' => 'Prompt',
            'characterName' => 'Testeur',
        ]);

        self::assertResponseStatusCodeSame(422);
    }

    private function promoteToAdmin(string $email): void
    {
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(\App\Entity\User::class)->findOneBy(['email' => $email]);
        $user->setRole(UserRole::ADMIN);
        $em->flush();
    }
}
