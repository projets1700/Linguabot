import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { QuizModuleCard } from "../components/QuizModuleCard";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { levelUpProgressPercent } from "../lib/quizModuleState";
import { isQuizHiddenForLevel } from "../lib/quizSpeech";
import { useAuthStore } from "../stores/authStore";
import type { QuizModulesResponse } from "../types";

const EMPTY_RESPONSE: QuizModulesResponse = {
  modules: [],
  passThreshold: 0,
  requiredForLevelUp: 0,
  targetLevelCode: "",
};

export function QuizPage() {
  const levelCode = useAuthStore((state) => state.user?.level.code);
  const hidden = isQuizHiddenForLevel(levelCode);
  const [data, setData] = useState<QuizModulesResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // A2/B1/B2 never render past the redirect below - not worth a network
    // round-trip just to learn that, once the learner's own level already
    // says so (QuizController also enforces this server-side).
    if (hidden) {
      setLoading(false);
      return;
    }
    setLoadError(false);
    api
      .get<QuizModulesResponse>("/quiz/modules")
      .then((response) => setData(response.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [hidden, retryCount]);

  // A2/B1/B2 have nothing to gain from this page - sent straight back to the
  // Dashboard rather than shown a dead end (same rule as the nav link and
  // ActivityGrid, all driven by isQuizHiddenForLevel).
  if (hidden) {
    return <Navigate to="/dashboard" replace />;
  }

  const { modules, passThreshold, requiredForLevelUp, targetLevelCode } = data;
  const passedCount = modules.filter((m) => m.passed).length;
  // The vocabulary test only ever unlocks targetLevelCode from below it
  // (QuizService::maybeUnlockA1 only fires for A0) - a learner already at
  // that level (A1, now allowed to revisit the modules) has nothing left to
  // unlock here, so the progress framing must not claim otherwise.
  const canUnlock = targetLevelCode !== "" && levelCode !== targetLevelCode;
  const progressPercent = levelUpProgressPercent(passedCount, requiredForLevelUp);

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Test de vocabulaire</h1>
        <p className="text-slate-400 mb-5">
          Renforce ton vocabulaire{canUnlock ? ` et progresse vers le niveau ${targetLevelCode}` : ""}.
        </p>

        {!loading && !loadError && (
          <div className="bg-slate-800 rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <p className="text-sm font-semibold text-white">
                {canUnlock ? `Progression vers ${targetLevelCode}` : "Modules validés"}
              </p>
              <p className="text-sm text-slate-400 shrink-0">
                {canUnlock ? `${passedCount} / ${requiredForLevelUp} requis` : `${passedCount} / ${modules.length}`}
              </p>
            </div>
            <div
              role="progressbar"
              aria-label={canUnlock ? `Progression vers le niveau ${targetLevelCode}` : "Modules de vocabulaire validés"}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-slate-700 rounded-full h-2 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {canUnlock
                ? `Valide ${requiredForLevelUp} modules sur ${modules.length} avec au moins ${passThreshold}/10.`
                : `Niveau ${targetLevelCode} déjà débloqué — entraîne-toi librement sur ces modules.`}
            </p>
          </div>
        )}

        <h2 className="text-lg font-bold mb-4">Ton parcours</h2>

        {loading ? (
          <p>Chargement...</p>
        ) : loadError ? (
          <ErrorBanner
            message="Impossible de charger les modules du test de vocabulaire."
            onRetry={() => setRetryCount((count) => count + 1)}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((module, index) => (
              <QuizModuleCard key={module.id} module={module} number={index + 1} passThreshold={passThreshold} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
