import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import type { WorldDetail } from "../types";

/**
 * The room-selection step between the world map (AdventurePage) and a
 * specific room's situations/missions (RoomPage) - LinguaBot_V2_Conception.md
 * §14's "carte de mondes -> sélection de salle -> situations disponibles".
 */
export function WorldPage() {
  const { worldCode } = useParams<{ worldCode: string }>();
  const [world, setWorld] = useState<WorldDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoadError(null);
    api
      .get<WorldDetail>(`/worlds/${worldCode}`)
      .then((response) => setWorld(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)));
  }, [worldCode, retryCount]);

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

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8 max-w-5xl mx-auto">
        <Link to="/aventure" className="text-sm text-slate-400 hover:text-white">
          ← Adventure
        </Link>
        <h1 className="text-3xl font-bold mt-1 mb-1">{world.title}</h1>
        {world.description && <p className="text-slate-400 mb-8">{world.description}</p>}

        <div className="grid md:grid-cols-2 gap-6">
          {world.rooms.map((room) => {
            const situationsCompleted = room.situations.filter((s) => s.completed).length;
            return (
              <Link
                key={room.code}
                to={room.unlocked ? `/aventure/${world.code}/${room.code}` : "#"}
                aria-disabled={!room.unlocked}
                className={`block p-6 rounded-xl transition-all ${
                  room.unlocked
                    ? "bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5"
                    : "bg-slate-900 opacity-50 cursor-not-allowed pointer-events-none"
                }`}
              >
                <p className="font-bold text-lg mb-1">{room.title}</p>
                <p className="text-slate-400 text-sm">
                  {situationsCompleted} / {room.situations.length} situations completed
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
