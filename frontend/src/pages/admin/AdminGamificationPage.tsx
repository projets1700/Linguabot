import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { LoadingText } from "../../components/ui/LoadingScreen";
import type { AdminBadge, AdminTrophy } from "../../types";

export function AdminGamificationPage() {
  const [badges, setBadges] = useState<AdminBadge[]>([]);
  const [trophies, setTrophies] = useState<AdminTrophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<AdminBadge[]>("/admin/badges"),
      api.get<AdminTrophy[]>("/admin/trophies"),
    ])
      .then(([badgesRes, trophiesRes]) => {
        setBadges(badgesRes.data);
        setTrophies(trophiesRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleBadge(badge: AdminBadge) {
    setActionError(false);
    try {
      const response = await api.patch<{ id: number; isActive: boolean }>(
        `/admin/badges/${badge.id}/toggle-active`,
      );
      setBadges((current) =>
        current.map((b) => (b.id === badge.id ? { ...b, isActive: response.data.isActive } : b)),
      );
    } catch {
      setActionError(true);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <LoadingText />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Gamification</h1>

      {actionError && (
        <div className="mb-4">
          <ErrorBanner message="Échec de l'action. Réessaie." />
        </div>
      )}

      <h2 className="text-lg font-bold mb-4">Badges ({badges.length})</h2>
      {badges.length === 0 ? (
        <EmptyState message="Aucun badge." />
      ) : (
      <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden mb-10">
        <thead className="bg-slate-800 text-slate-400 text-left">
          <tr>
            <th className="p-3">Code</th>
            <th className="p-3">Nom</th>
            <th className="p-3">Condition</th>
            <th className="p-3">Seuil</th>
            <th className="p-3">XP bonus</th>
            <th className="p-3">Statut</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {badges.map((badge) => (
            <tr key={badge.id} className="border-t border-slate-800">
              <td className="p-3 text-slate-400">{badge.code}</td>
              <td className="p-3">{badge.name}</td>
              <td className="p-3 text-slate-400">{badge.conditionType}</td>
              <td className="p-3">{badge.conditionValue}</td>
              <td className="p-3">{badge.xpBonus}</td>
              <td className="p-3">
                <span className={badge.isActive ? "text-green-400" : "text-red-400"}>
                  {badge.isActive ? "Actif" : "Désactivé"}
                </span>
              </td>
              <td className="p-3">
                <button
                  onClick={() => toggleBadge(badge)}
                  aria-label={`${badge.isActive ? "Désactiver" : "Activer"} le badge ${badge.name}`}
                  className="text-xs bg-slate-800 px-2 py-1 rounded"
                >
                  {badge.isActive ? "Désactiver" : "Activer"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}

      <h2 className="text-lg font-bold mb-4">Trophées ({trophies.length})</h2>
      {trophies.length === 0 ? (
        <EmptyState message="Aucun trophée." />
      ) : (
      <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
        <thead className="bg-slate-800 text-slate-400 text-left">
          <tr>
            <th className="p-3">Code</th>
            <th className="p-3">Nom</th>
            <th className="p-3">Condition</th>
            <th className="p-3">Seuil</th>
            <th className="p-3">XP récompense</th>
            <th className="p-3">Rareté</th>
          </tr>
        </thead>
        <tbody>
          {trophies.map((trophy) => (
            <tr key={trophy.id} className="border-t border-slate-800">
              <td className="p-3 text-slate-400">{trophy.code}</td>
              <td className="p-3">{trophy.name}</td>
              <td className="p-3 text-slate-400">{trophy.conditionType}</td>
              <td className="p-3">{trophy.conditionValue}</td>
              <td className="p-3">{trophy.xpReward}</td>
              <td className="p-3 capitalize">{trophy.rarity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </AdminLayout>
  );
}
