import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import { LoadingText } from "../../components/ui/LoadingScreen";
import type { AdminStats } from "../../types";

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.get<AdminStats>("/admin/stats").then((response) => setStats(response.data));
  }, []);

  if (!stats) {
    return (
      <AdminLayout>
        <LoadingText />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Statistiques globales</h1>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Utilisateurs" value={stats.usersCount} />
        <StatCard label="Scénarios" value={stats.scenariosCount} />
        <StatCard label="Sessions" value={stats.sessionsCount} />
        <StatCard label="Taux de complétion" value={`${stats.completionRate}%`} />
        <StatCard label="Score moyen" value={stats.avgScoreGlobal ?? "—"} />
        <StatCard label="Participation défi (aujourd'hui)" value={`${stats.challengeParticipationRate}%`} />
        <StatCard label="XP distribués aujourd'hui" value={stats.xpDistributedToday} />
        <StatCard label="Sessions complétées" value={stats.completedSessionsCount} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 p-6 rounded-xl">
          <h2 className="text-lg font-bold mb-4">Répartition par niveau</h2>
          <div className="flex flex-col gap-2">
            {stats.levelDistribution.map((row) => (
              <div key={row.level} className="flex items-center gap-3">
                <span className="w-10 text-slate-400 text-sm">{row.level}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{
                      width: `${stats.usersCount > 0 ? (row.count / stats.usersCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm w-8 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl">
          <h2 className="text-lg font-bold mb-4">Scénarios les plus joués</h2>
          <table className="w-full text-sm">
            <tbody>
              {stats.topScenarios.slice(0, 8).map((row) => (
                <tr key={row.code} className="border-b border-slate-800">
                  <td className="py-2 text-slate-400">{row.code}</td>
                  <td className="py-2">{row.title}</td>
                  <td className="py-2 text-right font-bold">{row.playCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900 p-4 rounded-xl">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
