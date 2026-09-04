import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminLayout } from "../../components/AdminLayout";
import type { AdminUser } from "../../types";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<AdminUser[]>("/admin/users")
      .then((response) => setUsers(response.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(user: AdminUser) {
    const response = await api.patch<AdminUser>(`/admin/users/${user.id}/toggle-active`);
    setUsers((current) => current.map((u) => (u.id === user.id ? response.data : u)));
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Supprimer le compte de ${user.email} (RGPD) ?`)) return;
    await api.delete(`/admin/users/${user.id}`);
    load();
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">Utilisateurs ({users.length})</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="w-full text-sm bg-slate-900 rounded-xl overflow-hidden">
          <thead className="bg-slate-800 text-slate-400 text-left">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Email</th>
              <th className="p-3">Rôle</th>
              <th className="p-3">Niveau</th>
              <th className="p-3">XP</th>
              <th className="p-3">Sessions</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="p-3">{user.prenom} {user.nom}</td>
                <td className="p-3 text-slate-400">{user.email}</td>
                <td className="p-3">{user.role === "ROLE_ADMIN" ? "Admin" : "Apprenant"}</td>
                <td className="p-3">{user.level}</td>
                <td className="p-3">{user.totalXp}</td>
                <td className="p-3">{user.sessionsCount}</td>
                <td className="p-3">
                  <span className={user.isActive ? "text-green-400" : "text-red-400"}>
                    {user.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => toggleActive(user)}
                    className="text-xs bg-slate-800 px-2 py-1 rounded"
                  >
                    {user.isActive ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    className="text-xs bg-red-900 px-2 py-1 rounded"
                  >
                    Supprimer
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
