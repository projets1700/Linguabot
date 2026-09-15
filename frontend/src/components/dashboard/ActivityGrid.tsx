import { Link } from "react-router-dom";

type Props = {
  /** The Test de vocabulaire has nothing left to offer past A1 (QuizController enforces this server-side too) - hidden entirely rather than shown locked, since there's no "unlock later" story for content the learner has already moved past. */
  hasVocabTestAccess: boolean;
};

export function ActivityGrid({ hasVocabTestAccess }: Props) {
  return (
    <>
      <h2 className="text-lg font-bold mb-2.5">Choisir une activité</h2>
      <div className={`grid gap-4 mb-5 ${hasVocabTestAccess ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <Link
          to="/catalog"
          className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
        >
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
            💬
          </span>
          <p className="font-bold mb-0.5">Scénarios</p>
          <p className="text-slate-400 text-sm mb-2">Converse avec LinguaBot dans des situations réelles.</p>
          <p className="text-blue-400 text-sm">Explorer →</p>
        </Link>
        {hasVocabTestAccess && (
          <Link
            to="/quiz"
            className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
          >
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
              🎙️
            </span>
            <p className="font-bold mb-0.5">Test de vocabulaire</p>
            <p className="text-slate-400 text-sm mb-2">Entraîne ton vocabulaire à l'oral.</p>
            <p className="text-blue-400 text-sm">Commencer →</p>
          </Link>
        )}
        <Link
          to="/trophees"
          className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
        >
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
            🏅
          </span>
          <p className="font-bold mb-0.5">Badges & trophées</p>
          <p className="text-slate-400 text-sm mb-2">Découvre tes récompenses débloquées.</p>
          <p className="text-blue-400 text-sm">Voir mes récompenses →</p>
        </Link>
      </div>
    </>
  );
}
