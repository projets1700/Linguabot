<?php

namespace App\Service;

use App\Entity\Room;
use App\Entity\Situation;
use App\Entity\User;
use App\Entity\World;
use App\Repository\MissionRepository;
use App\Repository\MissionSessionRepository;
use App\Repository\RoomRepository;
use App\Repository\SituationRepository;
use App\Repository\WorldRepository;

/**
 * Builds the World -> Room -> Situation -> Mission hierarchy with
 * unlock/progression computed for the current user - the V2 pilot
 * equivalent of ScenarioRepository::findCatalog()'s "locked" flag, one
 * level of nesting deeper (LinguaBot_V2_Conception.md §7/§12).
 *
 * Unlock rules (deliberately simple for the pilot - see the plan's "Backend
 * - nouvelles entités" section for the full rationale):
 * - A World is unlocked if it's the first one (orderNum 0).
 * - A Room is unlocked iff its World is (no extra per-room condition yet).
 * - A Situation is unlocked if it's the first in its Room, or the previous
 *   Situation (by orderNum) has at least one completed Mission for this user.
 * - A Mission is unlocked if its level is at or below the user's own level
 *   (identical rule to Scenario's today).
 */
final class RoomCatalogService
{
    public function __construct(
        private readonly WorldRepository $worldRepository,
        private readonly RoomRepository $roomRepository,
        private readonly SituationRepository $situationRepository,
        private readonly MissionRepository $missionRepository,
        private readonly MissionSessionRepository $missionSessionRepository,
    ) {
    }

    /**
     * @return array<int, array{code: string, title: string, description: ?string, orderNum: int, unlocked: bool, roomsCount: int, situationsCompleted: int, situationsTotal: int}>
     */
    public function worldsOverview(User $user): array
    {
        return array_map(
            fn (World $world) => $this->worldSummary($world, $user),
            $this->worldRepository->findAllOrdered(),
        );
    }

    public function findWorldByCode(string $code): ?World
    {
        return $this->worldRepository->findOneActiveByCode($code);
    }

    /**
     * @return array{code: string, title: string, description: ?string, unlocked: bool, rooms: array<int, array{code: string, title: string, backgroundImageSrc: ?string, unlocked: bool, situations: array<int, array{code: string, title: string, description: ?string, unlocked: bool, completed: bool, missions: array<int, array{id: int, code: string, title: string, objective: string, level: string, baseXp: int, unlocked: bool}>}>}>}
     */
    public function worldDetail(World $world, User $user): array
    {
        $worldUnlocked = $this->isWorldUnlocked($world);
        $userLevelOrderNum = $user->getLevel()->getOrderNum();

        $rooms = array_map(function (Room $room) use ($worldUnlocked, $userLevelOrderNum, $user) {
            $situations = $this->situationRepository->findByRoomOrdered($room);
            $completedSituationIds = $this->missionSessionRepository->completedSituationIdsForUserInRoom($user, $room);

            $situationPayloads = [];
            foreach ($situations as $index => $situation) {
                $completed = \in_array($situation->getId(), $completedSituationIds, true);
                $unlocked = $worldUnlocked && (0 === $index || $this->previousSituationCompleted($situations, $index, $completedSituationIds));

                $situationPayloads[] = [
                    'code' => $situation->getCode(),
                    'title' => $situation->getTitle(),
                    'description' => $situation->getDescription(),
                    'unlocked' => $unlocked,
                    'completed' => $completed,
                    'missions' => array_map(
                        fn ($mission) => [
                            'id' => $mission->getId(),
                            'code' => $mission->getCode(),
                            'title' => $mission->getTitle(),
                            'objective' => $mission->getObjective(),
                            'level' => $mission->getLevel()->getCode(),
                            'baseXp' => $mission->getBaseXp(),
                            'unlocked' => $unlocked && $mission->getLevel()->getOrderNum() <= $userLevelOrderNum,
                        ],
                        $this->missionRepository->findBySituationOrdered($situation),
                    ),
                ];
            }

            return [
                'code' => $room->getCode(),
                'title' => $room->getTitle(),
                'backgroundImageSrc' => $room->getBackgroundImageSrc(),
                'unlocked' => $worldUnlocked,
                'situations' => $situationPayloads,
            ];
        }, $this->roomRepository->findByWorldOrdered($world));

        return [
            'code' => $world->getCode(),
            'title' => $world->getTitle(),
            'description' => $world->getDescription(),
            'unlocked' => $worldUnlocked,
            'rooms' => $rooms,
        ];
    }

    /**
     * @return array{code: string, title: string, description: ?string, orderNum: int, unlocked: bool, roomsCount: int, situationsCompleted: int, situationsTotal: int}
     */
    private function worldSummary(World $world, User $user): array
    {
        $unlocked = $this->isWorldUnlocked($world);
        $rooms = $this->roomRepository->findByWorldOrdered($world);

        $situationsTotal = 0;
        $situationsCompleted = 0;
        foreach ($rooms as $room) {
            $situations = $this->situationRepository->findByRoomOrdered($room);
            $situationsTotal += \count($situations);
            $situationsCompleted += \count($this->missionSessionRepository->completedSituationIdsForUserInRoom($user, $room));
        }

        return [
            'code' => $world->getCode(),
            'title' => $world->getTitle(),
            'description' => $world->getDescription(),
            'orderNum' => $world->getOrderNum(),
            'unlocked' => $unlocked,
            'roomsCount' => \count($rooms),
            'situationsCompleted' => $situationsCompleted,
            'situationsTotal' => $situationsTotal,
        ];
    }

    private function isWorldUnlocked(World $world): bool
    {
        return 0 === $world->getOrderNum();
    }

    /**
     * @param Situation[] $situations ordered by orderNum, same array passed to the caller's loop
     * @param int[] $completedSituationIds
     */
    private function previousSituationCompleted(array $situations, int $index, array $completedSituationIds): bool
    {
        $previous = $situations[$index - 1];

        return \in_array($previous->getId(), $completedSituationIds, true);
    }
}
