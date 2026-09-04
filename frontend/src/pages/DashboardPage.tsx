import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p>Chargement...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          Bonjour {user.prenom} 👋
        </h1>
        <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-white">
          Déconnexion
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Niveau</p>
          <p className="text-2xl font-bold">{user.level.code} — {user.level.name}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl">
          <p className="text-slate-400 text-sm">XP total</p>
          <p className="text-2xl font-bold">{user.totalXp} XP</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Sessions complétées</p>
          <p className="text-2xl font-bold">{user.sessionsCount}</p>
        </div>
      </div>

      <Link to="/catalog" className="inline-block bg-blue-600 px-6 py-3 rounded-lg">
        Voir le catalogue de scénarios
      </Link>
    </main>
  );
}
