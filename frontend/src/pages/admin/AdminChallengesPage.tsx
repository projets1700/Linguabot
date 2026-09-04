import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import type { AdminDailyChallenge } from "../../types";

const LEVELS = ["A0", "A1", "A2", "B1", "B2"];

export function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<AdminDailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<AdminDailyChallenge[]>("/admin/daily-challenges")
      .then((response) => setChallenges(response.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function regenerate(level: string) {
    setRegenerating(level);
    try {
      await api.post("/admin/daily-challenges/regenerate", { level });
      load();
    } finally {
      setRegenerating(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayChallenges = challenges.filter((c) => c.challengeDate === today);
  const history = challenges.filter((c) => c.challengeDate !== today);

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Défis du jour</h1>

      <h2 className="text-lg font-bold mb-4">Aujourd'hui ({today})</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {LEVELS.map((level) => {
          const challenge = todayChallenges.find((c) => c.level === level);
          return (
            <div key={level} className="bg-slate-900 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-400 uppercase">{level}</span>
                <button
                  onClick={() => regenerate(level)}
                  disabled={regenerating === level}
                  className="text-xs bg-slate-800 px-2 py-1 rounded disabled:opacity-50"
                >
                  {regenerating === level ? "..." : "Régénérer"}
                </button>
              </div>
              {challenge ? (
                <>
                  <p className="font-bold">{challenge.title}</p>
                  <p className="text-slate-400 text-sm mt-1">{challenge.objective}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Mots-clés : {challenge.keywords.join(", ")}
                  </p>
                </>
              ) : (
                <p className="text-slate-500 text-sm">Pas encore généré</p>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-bold mb-4">Historique</h2>
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
          <thead className="bg-slate-800 text-slate-400 text-left">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Niveau</th>
              <th className="p-3">Titre</th>
              <th className="p-3">Personnage</th>
            </tr>
          </thead>
          <tbody>
            {history.map((challenge) => (
              <tr key={challenge.id} className="border-t border-slate-800">
                <td className="p-3 text-slate-400">{challenge.challengeDate}</td>
                <td className="p-3">{challenge.level}</td>
                <td className="p-3">{challenge.title}</td>
                <td className="p-3">{challenge.characterName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}
