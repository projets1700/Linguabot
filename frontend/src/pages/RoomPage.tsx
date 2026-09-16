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
import type { MissionSessionDetail, WorldDetail } from "../types";

export function RoomPage() {
  const { worldCode, roomCode } = useParams<{ worldCode: string; roomCode: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [world, setWorld] = useState<WorldDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [startingMissionId, setStartingMissionId] = useState<number | null>(null);
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

  const room = world.rooms.find((r) => r.code === roomCode);
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

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8 max-w-3xl mx-auto">
        <Link to={`/aventure/${world.code}`} className="text-sm text-slate-400 hover:text-white">
          ← {world.title}
        </Link>
        <h1 className="text-3xl font-bold mt-1 mb-4">{room.title}</h1>

        <RoomBackdrop
          backgroundImageSrc={room.backgroundImageSrc}
          roomTitle={room.title}
          avatarState={avatarState}
          avatarType={user?.avatarType ?? "male"}
          speechText={speechText}
          charIndexRef={charIndexRef}
          onReady={handleAvatarReady}
        />

        <div className="flex flex-col gap-4 mt-6">
          {room.situations.map((situation) => (
            <div
              key={situation.code}
              className={`bg-slate-800 rounded-xl p-5 ${situation.unlocked ? "" : "opacity-50"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-bold">{situation.title}</h2>
                {situation.completed && (
                  <span className="text-green-400 text-xs font-semibold flex items-center gap-1">
                    <span aria-hidden="true">✓</span> Completed
                  </span>
                )}
              </div>
              {situation.description && <p className="text-slate-400 text-sm mb-3">{situation.description}</p>}

              {!situation.unlocked ? (
                <p className="text-xs text-slate-500 uppercase">🔒 Complete the previous situation to unlock</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {situation.missions.map((mission) => (
                    <Button
                      key={mission.code}
                      onClick={() => handleStartMission(mission.id)}
                      disabled={!mission.unlocked || startingMissionId === mission.id}
                      variant={mission.unlocked ? "primary" : "secondary"}
                      size="sm"
                      aria-label={
                        mission.unlocked
                          ? `Start mission ${mission.title} (level ${mission.level})`
                          : `Mission ${mission.title} locked - requires level ${mission.level}`
                      }
                    >
                      {mission.unlocked
                        ? `${mission.level} · ${mission.title} →`
                        : `🔒 ${mission.level} · ${mission.title}`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
