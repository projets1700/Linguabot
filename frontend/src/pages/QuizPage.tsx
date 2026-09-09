import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import type { QuizModule } from "../types";

export function QuizPage() {
  const [modules, setModules] = useState<QuizModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoadError(false);
    api
      .get<QuizModule[]>("/quiz/modules")
      .then((response) => setModules(response.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [retryCount]);

  const passedCount = modules.filter((m) => m.passed).length;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8">
      <h1 className="text-3xl font-bold mb-2">Quiz vocal A0</h1>
      <p className="text-slate-400 mb-8">
        Validez 4 modules sur 6 (score ≥ 7/10) pour débloquer le niveau A1.{" "}
        <span className="text-white font-semibold">{passedCount}/6</span> validé
        {passedCount > 1 ? "s" : ""}.
      </p>

      {loading ? (
        <p>Chargement...</p>
      ) : loadError ? (
        <ErrorBanner
          message="Impossible de charger les modules du quiz."
          onRetry={() => setRetryCount((count) => count + 1)}
        />
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <article key={module.id} className="bg-slate-800 p-6 rounded-xl">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold">{module.title}</h2>
                {module.passed && (
                  <span className="text-green-400 text-sm font-semibold">✓ Validé</span>
                )}
              </div>
              <p className="text-slate-400 text-sm mt-2">
                {module.questionCount} questions
              </p>
              <Link
                to={`/quiz/${module.id}`}
                className="inline-block mt-4 bg-blue-600 px-4 py-2 rounded-lg"
              >
                {module.passed ? "Rejouer" : "Commencer"}
              </Link>
            </article>
          ))}
        </div>
      )}
      </main>
    </div>
  );
}
