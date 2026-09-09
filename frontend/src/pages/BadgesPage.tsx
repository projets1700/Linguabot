import { useEffect, useState } from "react";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { Badge } from "../types";

export function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoadError(false);
    api
      .get<Badge[]>("/badges")
      .then((response) => setBadges(response.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [retryCount]);

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8">
      <h1 className="text-3xl font-bold mb-2">Mes badges</h1>
      <p className="text-slate-400 mb-8">
        {earnedCount}/{badges.length} débloqués
      </p>

      {loading ? (
        <p>Chargement...</p>
      ) : loadError ? (
        <ErrorBanner
          message="Impossible de charger tes badges."
          onRetry={() => setRetryCount((count) => count + 1)}
        />
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {badges.map((badge) => (
            <article
              key={badge.code}
              className={`p-6 rounded-xl ${badge.earned ? "bg-slate-800" : "bg-slate-900 opacity-50"}`}
            >
              <div className="text-4xl mb-2">{badge.icon}</div>
              <h2 className="text-lg font-bold">{badge.name}</h2>
              <p className="text-slate-400 text-sm mt-1">{badge.description}</p>
              {badge.xpBonus > 0 && (
                <p className="text-sm text-blue-400 mt-2">+{badge.xpBonus} XP</p>
              )}
              {!badge.earned && (
                <p className="text-xs text-slate-500 mt-2 uppercase">Verrouillé</p>
              )}
            </article>
          ))}
        </div>
      )}
      </main>
    </div>
  );
}
