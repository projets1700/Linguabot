import type { SessionSummary } from "../types";

type Props = {
  summary: SessionSummary;
};

/**
 * The end-of-session bilan (V1 spec §16): a short qualitative recap next to
 * the objective facts (exchange count, XP). Deliberately compact - this is
 * not a dashboard, and every section is optional/hidden when empty so the
 * deterministic AI-unavailable fallback (empty strengths/reviewPoints/
 * usefulExpressions) still reads as a complete, honest card rather than a
 * half-empty one.
 */
export function SessionSummaryCard({ summary }: Props) {
  return (
    <div className="text-left flex flex-col gap-4 mb-6">
      <p className="text-slate-400 text-sm text-center">
        {summary.exchangeCount} échange{summary.exchangeCount !== 1 ? "s" : ""} · +{summary.xpEarned} XP
      </p>

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase mb-1">Résumé</h2>
        <p className="text-slate-200">{summary.summary}</p>
      </div>

      {summary.strengths.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-1">✅ Points positifs</h2>
          <ul className="list-disc list-inside text-slate-200">
            {summary.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.reviewPoints.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-1">📚 À revoir</h2>
          <ul className="list-disc list-inside text-slate-200">
            {summary.reviewPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.usefulExpressions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-1">💬 Expressions utiles</h2>
          <div className="flex flex-wrap gap-2">
            {summary.usefulExpressions.map((expression) => (
              <span key={expression} className="bg-slate-800 text-sm px-3 py-1 rounded-full">
                {expression}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.nextStep && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-1">➡️ Pour la prochaine fois</h2>
          <p className="text-slate-200">{summary.nextStep}</p>
        </div>
      )}
    </div>
  );
}
