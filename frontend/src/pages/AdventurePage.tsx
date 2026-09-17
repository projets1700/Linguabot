import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import type { WorldSummary } from "../types";

/**
 * The other 5 worlds from LinguaBot_V2_Conception.md §5 - no backend rows
 * exist for these yet, so they're rendered here as static "coming soon"
 * cards rather than empty/inactive API data.
 */
const UPCOMING_WORLDS = [
  "Vacances & aventure",
  "Travail & études",
  "Services & ville",
  "Santé & imprévus",
  "Relations sociales",
];

export function AdventurePage() {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    api
      .get<WorldSummary[]>("/worlds")
      .then((response) => setWorlds(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)))
      .finally(() => setLoading(false));
  }, [retryCount]);

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Adventure</h1>
        <p className="text-slate-400 mb-8">Explore worlds, rooms and missions to practice your English.</p>

        {loading ? (
          <p>Loading...</p>
        ) : loadError ? (
          <ErrorBanner
            message={loadError.message}
            onRetry={loadError.retryable ? () => setRetryCount((count) => count + 1) : undefined}
          />
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {worlds.map((world) => (
              <Link
                key={world.code}
                to={`/aventure/${world.code}`}
                className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 p-6 rounded-xl transition-all"
              >
                <p className="font-bold text-lg mb-1">{world.title}</p>
                {world.description && <p className="text-slate-400 text-sm mb-3">{world.description}</p>}
                <p className="text-xs text-slate-500">
                  {world.situationsCompleted} / {world.situationsTotal} situations completed
                </p>
              </Link>
            ))}

            {UPCOMING_WORLDS.map((title) => (
              <div
                key={title}
                className="bg-slate-900 p-6 rounded-xl opacity-50 cursor-not-allowed"
              >
                <p className="font-bold text-lg mb-1">{title}</p>
                <p className="text-slate-500 text-sm">🔒 Coming soon</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
