import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import type { AdminScenario } from "../../types";

export function AdminScenariosPage() {
  const [scenarios, setScenarios] = useState<AdminScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AdminScenario[]>("/admin/scenarios")
      .then((response) => setScenarios(response.data))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(scenario: AdminScenario) {
    const response = await api.patch<AdminScenario>(`/admin/scenarios/${scenario.id}/toggle-active`);
    setScenarios((current) => current.map((s) => (s.id === scenario.id ? response.data : s)));
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Scénarios ({scenarios.length})</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
          <thead className="bg-slate-800 text-slate-400 text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Titre</th>
              <th className="p-3">Niveau</th>
              <th className="p-3">Catégorie</th>
              <th className="p-3">XP</th>
              <th className="p-3">Parties jouées</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id} className="border-t border-slate-800">
                <td className="p-3 text-slate-400">{scenario.code}</td>
                <td className="p-3">{scenario.title}</td>
                <td className="p-3">{scenario.level}</td>
                <td className="p-3">{scenario.category}</td>
                <td className="p-3">{scenario.baseXp}</td>
                <td className="p-3">{scenario.playCount}</td>
                <td className="p-3">
                  <span className={scenario.isActive ? "text-green-400" : "text-red-400"}>
                    {scenario.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(scenario)}
                    className="text-xs bg-slate-800 px-2 py-1 rounded"
                  >
                    {scenario.isActive ? "Désactiver" : "Activer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}
