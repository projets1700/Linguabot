import { Link } from "react-router-dom";
import { quizModuleDescription, quizModuleIcon } from "../lib/quizModuleContent";
import { quizModuleState, remainingCorrectAnswers } from "../lib/quizModuleState";
import type { QuizModule } from "../types";

type Props = {
  module: QuizModule;
  /** 1-based position in the parcours, used for the "01"-style order label - not a backend field. */
  number: number;
  passThreshold: number;
};

const CTA_LABEL: Record<ReturnType<typeof quizModuleState>, string> = {
  "not-started": "Start →",
  retry: "Retry →",
  passed: "Play again",
};

export function QuizModuleCard({ module, number, passThreshold }: Props) {
  const state = quizModuleState(module);
  const orderLabel = String(number).padStart(2, "0");

  return (
    <article className="bg-slate-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-slate-400">
        <span aria-hidden="true" className="text-xl leading-none">
          {quizModuleIcon(module.code)}
        </span>
        <span className="font-mono text-xs">{orderLabel}</span>
      </div>

      <div>
        <h2 className="text-lg font-bold uppercase tracking-wide">{module.title}</h2>
        {quizModuleDescription(module.code) && (
          <p className="text-slate-400 text-sm mt-0.5">{quizModuleDescription(module.code)}</p>
        )}
      </div>

      <p className="text-xs text-slate-500">{module.questionCount} questions</p>

      <div className="text-sm">
        {state === "not-started" && (
          <p className="text-slate-400 flex items-center gap-1.5">
            <span aria-hidden="true">●</span> To start
          </p>
        )}

        {state === "retry" && module.bestScore !== null && (
          <>
            <p className="text-amber-400 font-semibold uppercase text-xs tracking-wide">To retry</p>
            <p className="text-slate-300 mt-1">
              Score: {module.bestScore}/{module.questionCount}
            </p>
            {(() => {
              const remaining = remainingCorrectAnswers(passThreshold, module.bestScore ?? 0);
              return remaining > 0 ? (
                <p className="text-slate-500 text-xs mt-0.5">
                  {remaining} more correct answer{remaining > 1 ? "s" : ""} needed to pass
                </p>
              ) : null;
            })()}
          </>
        )}

        {state === "passed" && (
          <>
            <p className="text-green-400 font-semibold flex items-center gap-1.5">
              <span aria-hidden="true">✓</span> Passed
            </p>
            {module.bestScore !== null && (
              <p className="text-slate-300 mt-1">
                Score: {module.bestScore}/{module.questionCount}
              </p>
            )}
          </>
        )}
      </div>

      <Link
        to={`/quiz/${module.id}`}
        aria-label={`${CTA_LABEL[state].replace(" →", "")} module ${module.title}`}
        className="mt-auto inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium"
      >
        {CTA_LABEL[state]}
      </Link>
    </article>
  );
}
