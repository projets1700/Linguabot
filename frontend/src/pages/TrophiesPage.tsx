import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Trophy } from "../types";

const RARITY_LABEL: Record<Trophy["rarity"], string> = {
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
  platinum: "Platine",
};

const RARITY_COLOR: Record<Trophy["rarity"], string> = {
  bronze: "text-amber-700",
  silver: "text-slate-300",
  gold: "text-yellow-500",
  platinum: "text-cyan-400",
};

export function TrophiesPage() {
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Trophy[]>("/trophies")
      .then((response) => setTrophies(response.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Mes trophées</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {trophies.map((trophy) => {
            const percent = Math.min(
              100,
              Math.round((trophy.progressCurrent / trophy.progressTotal) * 100),
            );

            return (
              <article
                key={trophy.code}
                className={`p-6 rounded-xl ${trophy.earned ? "bg-slate-800" : "bg-slate-900"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-lg font-bold">
                    {trophy.earned ? "🏆" : "🔒"} {trophy.name}
                  </h2>
                  <span className={`text-xs font-bold uppercase ${RARITY_COLOR[trophy.rarity]}`}>
                    {RARITY_LABEL[trophy.rarity]}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-3">{trophy.description}</p>
                <div className="w-full bg-slate-700 rounded-full h-2 mb-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {trophy.progressCurrent}/{trophy.progressTotal}
                  {trophy.xpReward > 0 && ` · +${trophy.xpReward} XP`}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
