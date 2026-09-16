import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { LoadingText } from "../../components/ui/LoadingScreen";
import type { AdminUser } from "../../types";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<AdminUser[]>("/admin/users")
      .then((response) => setUsers(response.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(user: AdminUser) {
    setActionError(false);
    try {
      const response = await api.patch<AdminUser>(`/admin/users/${user.id}/toggle-active`);
      setUsers((current) => current.map((u) => (u.id === user.id ? response.data : u)));
    } catch {
      setActionError(true);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Delete ${user.email}'s account (GDPR)?`)) return;
    setActionError(false);
    try {
      await api.delete(`/admin/users/${user.id}`);
      load();
    } catch {
      setActionError(true);
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Users ({users.length})</h1>

      {actionError && (
        <div className="mb-4">
          <ErrorBanner message="Action failed. Try again." />
        </div>
      )}

      {loading ? (
        <LoadingText />
      ) : users.length === 0 ? (
        <EmptyState message="No users." />
      ) : (
        <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
          <thead className="bg-slate-800 text-slate-400 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Level</th>
              <th className="p-3">XP</th>
              <th className="p-3">Sessions</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="p-3">{user.prenom} {user.nom}</td>
                <td className="p-3 text-slate-400">{user.email}</td>
                <td className="p-3">{user.role === "ROLE_ADMIN" ? "Admin" : "Learner"}</td>
                <td className="p-3">{user.level}</td>
                <td className="p-3">{user.totalXp}</td>
                <td className="p-3">{user.sessionsCount}</td>
                <td className="p-3">
                  <span className={user.isActive ? "text-green-400" : "text-red-400"}>
                    {user.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => toggleActive(user)}
                    aria-label={`${user.isActive ? "Disable" : "Enable"} ${user.email}`}
                    className="text-xs bg-slate-800 px-2 py-1 rounded"
                  >
                    {user.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    aria-label={`Delete ${user.email}`}
                    className="text-xs bg-red-900 px-2 py-1 rounded"
                  >
                    Delete
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
