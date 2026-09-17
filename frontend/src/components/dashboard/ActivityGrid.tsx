import { Link } from "react-router-dom";

type Props = {
  /** The Test de vocabulaire has nothing left to offer past A1 (QuizController enforces this server-side too) - hidden entirely rather than shown locked, since there's no "unlock later" story for content the learner has already moved past. */
  hasVocabTestAccess: boolean;
};

export function ActivityGrid({ hasVocabTestAccess }: Props) {
  return (
    <>
      <h2 className="text-lg font-bold mb-2.5">Choose an activity</h2>
      <div className={`grid gap-4 mb-5 ${hasVocabTestAccess ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <Link
          to="/aventure"
          className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
        >
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
            🗺️
          </span>
          <p className="font-bold mb-0.5">Adventure</p>
          <p className="text-slate-400 text-sm mb-2">Chat with LinguaBot in real-life situations.</p>
          <p className="text-blue-400 text-sm">Explore →</p>
        </Link>
        {hasVocabTestAccess && (
          <Link
            to="/quiz"
            className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
          >
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
              🎙️
            </span>
            <p className="font-bold mb-0.5">Vocabulary Test</p>
            <p className="text-slate-400 text-sm mb-2">Practice your vocabulary out loud.</p>
            <p className="text-blue-400 text-sm">Start →</p>
          </Link>
        )}
        <Link
          to="/trophees"
          className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
        >
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
            🏅
          </span>
          <p className="font-bold mb-0.5">Badges & Trophies</p>
          <p className="text-slate-400 text-sm mb-2">Discover the rewards you've unlocked.</p>
          <p className="text-blue-400 text-sm">See my rewards →</p>
        </Link>
      </div>
    </>
  );
}
