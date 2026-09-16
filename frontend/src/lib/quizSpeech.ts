// Spoken (and shown in the bubble) when detectLearnerBlock() flags the
// learner's answer as an explicit "I don't know" - unlike the open
// conversation pages, the quiz already has a known correct answer for the
// current question (QuizController's new on-demand /answer endpoint), so
// there's no need to ask the AI to invent one.
export function buildBlockedHelpMessage(correctAnswer: string): string {
  return `You can say: ${correctAnswer}.`;
}

// Spoken when a B1/B2 learner's first block unlocks the reveal button
// without yet giving the answer away (CecrlProfileService.helpVisibleByDefault
// is false for those levels - help stays reachable, just not automatic).
export function buildHelpAvailableMessage(): string {
  return "No problem, take your time. Tap the help button whenever you're ready to see the answer.";
}

// The A0 quiz is already meaningless past A1 (QuizController enforces
// A0-only server-side) - A1 still sees the "reserved for A0" page since
// it's the level right before unlocking it, but A2/B1/B2 learners are far
// enough past it that the nav link and the page itself are just dead ends,
// so both are hidden outright for those three levels.
const LEVELS_WITHOUT_QUIZ_ACCESS = new Set(["A2", "B1", "B2"]);

export function isQuizHiddenForLevel(levelCode: string | undefined): boolean {
  return levelCode !== undefined && LEVELS_WITHOUT_QUIZ_ACCESS.has(levelCode);
}
