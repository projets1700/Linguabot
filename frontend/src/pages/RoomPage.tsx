import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { RoomBackdrop } from "../components/RoomBackdrop";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import { useAuthStore } from "../stores/authStore";
import type { MissionSessionDetail, WorldDetail, WorldSituation } from "../types";

export function RoomPage() {
  const { worldCode, roomCode } = useParams<{ worldCode: string; roomCode: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [world, setWorld] = useState<WorldDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [startingMissionId, setStartingMissionId] = useState<number | null>(null);
  // Passive here on purpose (point 9 of the brief): no speakAssistantLine()
  // call anywhere on this page, so the avatar just stands in the room idle -
  // the hook is only wired up so RoomBackdrop can mount AvatarScene the same
  // way MissionPage/DailyChallengePage already do.
  const { avatarState, speechText, charIndexRef, handleAvatarReady } = useConversationSession();

  useEffect(() => {
    setLoadError(null);
    api
      .get<WorldDetail>(`/worlds/${worldCode}`)
      .then((response) => setWorld(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)));
  }, [worldCode, retryCount]);

  async function handleStartMission(missionId: number) {
    setStartingMissionId(missionId);
    try {
      const response = await api.post<MissionSessionDetail>(`/missions/${missionId}/sessions`);
      navigate(`/aventure/missions/${response.data.id}`);
    } finally {
      setStartingMissionId(null);
    }
  }

  if (!world) {
    if (loadError) {
      return (
        <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
          <ErrorBanner
            message={loadError.message}
            onRetry={loadError.retryable ? () => setRetryCount((count) => count + 1) : undefined}
          />
        </main>
      );
    }
    return <LoadingScreen />;
  }

  const roomIndex = world.rooms.findIndex((r) => r.code === roomCode);
  const room = roomIndex === -1 ? undefined : world.rooms[roomIndex];
  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950">
        <LearnerNav />
        <main className="text-white p-8 max-w-3xl mx-auto">
          <ErrorBanner message="Room not found." />
        </main>
      </div>
    );
  }

  const totalSituations = room.situations.length;
  const completedSituations = room.situations.filter((s) => s.completed).length;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white px-4 sm:px-8 py-10 max-w-4xl mx-auto">
        <Link to={`/aventure/${world.code}`} className="text-sm text-slate-400 hover:text-white inline-block mb-6">
          ← {world.title}
        </Link>

        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
          Room {String(roomIndex + 1).padStart(2, "0")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide mb-3">{room.title}</h1>
        <p className="text-sm text-slate-400 mb-6">
          {completedSituations} / {totalSituations} situations completed
        </p>

        <RoomBackdrop
          backgroundImageSrc={room.backgroundImageSrc}
          roomTitle={room.title}
          avatarState={avatarState}
          avatarType={user?.avatarType ?? "male"}
          speechText={speechText}
          charIndexRef={charIndexRef}
          onReady={handleAvatarReady}
          heightClassName="h-[380px] sm:h-[520px]"
        />

        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-10 mb-4">Choose a situation</h2>

        <div className="flex flex-col gap-3">
          {room.situations.map((situation, index) => (
            <SituationRow
              key={situation.code}
              situation={situation}
              number={index + 1}
              previousTitle={index > 0 ? room.situations[index - 1].title : null}
              onStartMission={handleStartMission}
              startingMissionId={startingMissionId}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function SituationRow({
  situation,
  number,
  previousTitle,
  onStartMission,
  startingMissionId,
}: {
  situation: WorldSituation;
  number: number;
  previousTitle: string | null;
  onStartMission: (missionId: number) => void;
  startingMissionId: number | null;
}) {
  const label = String(number).padStart(2, "0");

  if (!situation.unlocked) {
    return (
      <div className="flex items-start gap-4 rounded-xl border border-white/5 bg-slate-900/40 px-5 py-4 opacity-60">
        <span className="text-slate-500 font-mono text-sm mt-0.5">{label}</span>
        <div className="flex-1">
          <p className="font-bold text-slate-300 flex items-center gap-2">
            <span aria-hidden="true">🔒</span> {situation.title}
          </p>
          {/* The real unlock rule (RoomCatalogService: previous situation must
              be completed) named with the actual previous situation's title -
              not a hardcoded generic sentence. */}
          <p className="text-xs text-slate-500 mt-1">
            {previousTitle ? `Complete "${previousTitle}" to unlock.` : "Locked."}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 shrink-0">
          Locked
        </span>
      </div>
    );
  }

  const missionCount = situation.missions.length;

  return (
    <div className="rounded-xl border border-white/5 bg-slate-800/60 hover:bg-slate-800 transition-colors px-5 py-4">
      <div className="flex items-start gap-4">
        <span className="text-slate-500 font-mono text-sm mt-0.5">{label}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <p className="font-bold text-white">{situation.title}</p>
            {situation.completed && (
              <span className="text-green-400 text-xs font-semibold flex items-center gap-1">
                <span aria-hidden="true">✓</span> Completed
              </span>
            )}
          </div>

          {situation.description && <p className="text-slate-400 text-sm mt-1 max-w-md">{situation.description}</p>}

          <div className="flex items-center flex-wrap gap-2 mt-3">
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">
              {missionCount} mission{missionCount !== 1 ? "s" : ""}
            </span>
            {situation.missions.map((mission) => (
              <Button
                key={mission.code}
                onClick={() => onStartMission(mission.id)}
                disabled={!mission.unlocked || startingMissionId === mission.id}
                variant={mission.unlocked ? "primary" : "secondary"}
                size="sm"
                className="rounded-full"
                aria-label={
                  mission.unlocked
                    ? `Start mission ${mission.title} (level ${mission.level})`
                    : `Mission ${mission.title} locked - requires level ${mission.level}`
                }
              >
                {mission.unlocked ? mission.level : `🔒 ${mission.level}`}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
