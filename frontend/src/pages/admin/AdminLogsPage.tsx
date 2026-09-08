import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingText } from "../../components/ui/LoadingScreen";
import type { AdminLog } from "../../types";

export function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AdminLog[]>("/admin/logs")
      .then((response) => setLogs(response.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Logs d'administration ({logs.length})</h1>

      {loading ? (
        <LoadingText />
      ) : logs.length === 0 ? (
        <EmptyState message="Aucune action enregistrée pour le moment." />
      ) : (
        <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
          <thead className="bg-slate-800 text-slate-400 text-left">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Action</th>
              <th className="p-3">Cible</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-800">
                <td className="p-3 text-slate-400">{new Date(log.createdAt).toLocaleString("fr-FR")}</td>
                <td className="p-3">{log.admin}</td>
                <td className="p-3 font-mono text-xs">{log.action}</td>
                <td className="p-3 text-slate-400">
                  {log.targetType ? `${log.targetType} #${log.targetId}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}
