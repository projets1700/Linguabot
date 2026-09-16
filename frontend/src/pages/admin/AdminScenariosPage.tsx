import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { LoadingText } from "../../components/ui/LoadingScreen";
import type { AdminScenario } from "../../types";

export function AdminScenariosPage() {
  const [scenarios, setScenarios] = useState<AdminScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    api
      .get<AdminScenario[]>("/admin/scenarios")
      .then((response) => setScenarios(response.data))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(scenario: AdminScenario) {
    setActionError(false);
    try {
      const response = await api.patch<AdminScenario>(`/admin/scenarios/${scenario.id}/toggle-active`);
      setScenarios((current) => current.map((s) => (s.id === scenario.id ? response.data : s)));
    } catch {
      setActionError(true);
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Scenarios ({scenarios.length})</h1>

      {actionError && (
        <div className="mb-4">
          <ErrorBanner message="Action failed. Try again." />
        </div>
      )}

      {loading ? (
        <LoadingText />
      ) : scenarios.length === 0 ? (
        <EmptyState message="No scenarios." />
      ) : (
        <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
          <thead className="bg-slate-800 text-slate-400 text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Title</th>
              <th className="p-3">Level</th>
              <th className="p-3">Category</th>
              <th className="p-3">XP</th>
              <th className="p-3">Times played</th>
              <th className="p-3">Status</th>
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
                    {scenario.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(scenario)}
                    aria-label={`${scenario.isActive ? "Disable" : "Enable"} scenario ${scenario.title}`}
                    className="text-xs bg-slate-800 px-2 py-1 rounded"
                  >
                    {scenario.isActive ? "Disable" : "Enable"}
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
