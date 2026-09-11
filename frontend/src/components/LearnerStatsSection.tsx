import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api } from "../api/client";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import type { LearnerStats } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { ErrorBanner } from "./ui/ErrorBanner";

const PERIODS: { days: LearnerStats["days"]; label: string }[] = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 365, label: "1 an" },
];

const CATEGORY_LABEL: Record<LearnerStats["categoryBreakdown"][number]["category"], string> = {
  quotidien: "Quotidien",
  thematique: "Thématique",
};

function formatPracticeTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0 && minutes === 0) return "0 min";
  return [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}min` : null].filter(Boolean).join(" ");
}

/**
 * V1.1 LOT 4: the learner's own statistics over a selectable period, fed by
 * GET /api/me/stats - deliberately shows none of level/XP-total/next-level
 * (already on the Dashboard's hero card above) nor sessionsCount as a
 * lifetime total (already on the "Ta progression" card) - everything here
 * is period-scoped, to complement rather than repeat those.
 */
export function LearnerStatsSection() {
  const [days, setDays] = useState<LearnerStats["days"]>(30);
  const [stats, setStats] = useState<LearnerStats | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  function load() {
    setLoadError(null);
    api
      .get<LearnerStats>("/me/stats", { params: { days } })
      .then((response) => setStats(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)));
  }

  useEffect(load, [days]);

  const totalCategoryCount = stats?.categoryBreakdown.reduce((sum, row) => sum + row.count, 0) ?? 0;

  return (
    <Card variant="stat" className="border border-blue-500/15">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <p className="text-blue-400 text-xs font-bold uppercase">📈 Statistiques détaillées</p>
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <Button
              key={period.days}
              size="sm"
              variant={days === period.days ? "primary" : "secondary"}
              onClick={() => setDays(period.days)}
            >
              {period.label}
            </Button>
          ))}
        </div>
      </div>

      {loadError && (
        <ErrorBanner message={loadError.message} onRetry={loadError.retryable ? load : undefined} />
      )}

      {!loadError && !stats && <p className="text-slate-400 text-sm">Chargement des statistiques...</p>}

      {stats && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <StatTile label="Sessions" value={stats.sessionsCount} />
            <StatTile label="Temps de pratique" value={formatPracticeTime(stats.practiceSeconds)} />
            <StatTile label="Quiz réussis" value={stats.quizzesCompleted} />
            <StatTile label="Défis réalisés" value={stats.challengesCompleted} />
            <StatTile label="XP gagnés" value={stats.xpEarned} highlight />
          </div>

          {stats.categoryBreakdown.length > 0 && (
            <div className="mb-5">
              <p className="text-slate-400 text-xs uppercase font-bold mb-2">Répartition par catégorie</p>
              <div className="flex flex-col gap-2">
                {stats.categoryBreakdown.map((row) => (
                  <div key={row.category} className="flex items-center gap-3">
                    <span className="w-24 text-slate-400 text-sm">{CATEGORY_LABEL[row.category]}</span>
                    <div className="flex-1 bg-slate-900 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full"
                        style={{ width: `${totalCategoryCount > 0 ? (row.count / totalCategoryCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm w-8 text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.history.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-2">Évolution de l'XP gagné</p>
              <div className="h-40" data-testid="stats-history-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.history}>
                    <XAxis dataKey="day" hide />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Area type="monotone" dataKey="xpEarned" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? "bg-blue-500/10" : "bg-slate-900"}`}>
      <p className="text-slate-400 text-xs">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${highlight ? "text-blue-400" : ""}`}>{value}</p>
    </div>
  );
}
