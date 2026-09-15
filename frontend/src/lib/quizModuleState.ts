import type { QuizModule } from "../types";

export type QuizModuleState = "not-started" | "retry" | "passed";

/**
 * The 3 module states, derived strictly from what the backend already
 * reports (QuizController::modules() - passed/attempted), never inferred or
 * guessed: a module can only be "retry" if it was genuinely attempted and
 * didn't pass.
 */
export function quizModuleState(module: QuizModule): QuizModuleState {
  if (module.passed) return "passed";
  if (module.attempted) return "retry";
  return "not-started";
}

/**
 * How many more correct answers a learner needs to clear passThreshold from
 * their current best score - never negative (a module that already cleared
 * the threshold is "passed", not "retry", so this is only ever shown for a
 * bestScore genuinely below passThreshold, but the floor is kept as a safety
 * net rather than trusting that invariant blindly).
 */
export function remainingCorrectAnswers(passThreshold: number, bestScore: number): number {
  return Math.max(0, passThreshold - bestScore);
}

/**
 * Progress toward the level unlock, as a percentage of requiredForLevelUp
 * (not of the total module count) - 2 passed modules out of 4 required is
 * 50%, even though the catalogue has 6 modules total (per the task spec).
 * Capped at 100 in case passedCount ever exceeds requiredForLevelUp (all 6
 * passed, only 4 required).
 */
export function levelUpProgressPercent(passedCount: number, requiredForLevelUp: number): number {
  if (requiredForLevelUp <= 0) return 100;
  return Math.min(100, Math.round((passedCount / requiredForLevelUp) * 100));
}
