import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingScreen } from "../components/ui/LoadingScreen";
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
    return <LoadingScreen />;
  }

  // No activity recorded yet at all - the level/XP/session cards below would
  // just be three zeroes in a row, which tells a first-time learner nothing
  // useful. Point them at a concrete first step instead.
  const isNewLearner = user.totalXp === 0 && user.sessionsCount === 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          Bonjour {user.prenom} 👋
        </h1>
        <div className="flex items-center gap-4">
          {user.role === "ROLE_ADMIN" && (
            <Link to="/admin" className="text-sm text-amber-400 hover:text-amber-300">
              Administration
            </Link>
          )}
          <Link to="/voix" className="text-sm text-slate-400 hover:text-white">
            🔊 Voix de l'IA
          </Link>
          <Link to="/mon-compte" className="text-sm text-slate-400 hover:text-white">
            👤 Mon compte
          </Link>
          <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-white">
            Déconnexion
          </button>
        </div>
      </div>

      {isNewLearner && (
        <Card className="mb-8">
          <h2 className="text-xl font-bold mb-2">Bienvenue, {user.prenom} !</h2>
          <p className="text-slate-300 mb-4">
            Tu démarres au niveau {user.level.code}. La façon la plus simple de commencer : le quiz
            vocal A0, pour apprendre du vocabulaire de base en répondant à voix haute.
          </p>
          <Button to="/quiz" size="lg">Commencer le quiz A0</Button>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card variant="stat">
          <p className="text-slate-400 text-sm">Niveau</p>
          <p className="text-2xl font-bold">{user.level.code} — {user.level.name}</p>
        </Card>
        <Card variant="stat">
          <p className="text-slate-400 text-sm">XP total</p>
          <p className="text-2xl font-bold">{user.totalXp} XP</p>
        </Card>
        <Card variant="stat">
          <p className="text-slate-400 text-sm">Sessions complétées</p>
          <p className="text-2xl font-bold">{user.sessionsCount}</p>
        </Card>
      </div>

      <div className="flex gap-4 flex-wrap">
        {/* Kept as a plain Link (not the shared Button): amber is a
            one-off highlight color for this single CTA, not one of
            Button's standard variants. */}
        <Link to="/defi-du-jour" className="inline-block bg-amber-600 px-6 py-3 rounded-lg font-semibold">
          🔥 Défi du jour
        </Link>
        <Button to="/quiz" size="lg">Quiz vocal A0</Button>
        <Button to="/catalog" variant="secondary" size="lg">Voir le catalogue de scénarios</Button>
        <Button to="/badges" variant="secondary" size="lg">🌟 Mes badges</Button>
        <Button to="/trophees" variant="secondary" size="lg">🏆 Mes trophées</Button>
      </div>
    </main>
  );
}
