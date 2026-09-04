import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Scenario } from "../types";

const LEVELS = ["A1", "A2", "B1", "B2"] as const;
const CATEGORIES = [
  { value: "quotidien", label: "Quotidien" },
  { value: "thematique", label: "Thématique" },
] as const;

export function CatalogPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [level, setLevel] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Scenario[]>("/scenarios", { params: { level, category } })
      .then((response) => setScenarios(response.data))
      .finally(() => setLoading(false));
  }, [level, category]);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Catalogue</h1>

      <div className="flex gap-4 mb-8">
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="bg-slate-800 rounded-lg px-4 py-2"
        >
          <option value="">Tous les niveaux</option>
          {LEVELS.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="bg-slate-800 rounded-lg px-4 py-2"
        >
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <article key={scenario.id} className="bg-slate-800 p-6 rounded-xl">
              <span className="text-xs uppercase text-blue-400">{scenario.level} · {scenario.category}</span>
              <h2 className="text-xl font-bold mt-1">{scenario.title}</h2>
              <p className="text-slate-300 mt-2">{scenario.context}</p>
              <p className="mt-4 text-sm text-slate-400">Avec {scenario.characterName}</p>
              <p className="text-sm text-slate-400">
                ~{scenario.durationEstimate} min · {scenario.baseXp} XP
              </p>
              <Link
                to={`/sessions/${scenario.id}`}
                className="inline-block mt-4 bg-blue-600 px-4 py-2 rounded-lg"
              >
                Démarrer
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
