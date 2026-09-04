<?php

namespace App\Controller\Api\Admin;

use App\Entity\AdminLog;
use App\Repository\AdminLogRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class AdminLogController
{
    #[Route('/api/admin/logs', name: 'api_admin_logs_index', methods: ['GET'])]
    public function __invoke(AdminLogRepository $adminLogRepository): JsonResponse
    {
        return new JsonResponse(array_map(
            static fn (AdminLog $log) => [
                'id' => $log->getId(),
                'admin' => $log->getAdmin()->getEmail(),
                'action' => $log->getAction(),
                'targetType' => $log->getTargetType(),
                'targetId' => $log->getTargetId(),
                'details' => $log->getDetails(),
                'createdAt' => $log->getCreatedAt()->format(\DateTimeInterface::ATOM),
            ],
            $adminLogRepository->findRecent(100),
        ));
    }
}
