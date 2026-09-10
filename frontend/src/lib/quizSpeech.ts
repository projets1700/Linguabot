// Every A0 quiz question follows the exact `Comment dit-on "X" ?` template
// (see backend/src/DataFixtures/QuizFixtures.php) - reading that literally
// with an English voice produced hard-to-understand "franglish" (an English
// voice pronouncing a full French sentence). Spoken aloud, the question is
// translated to its English wrapper instead ("How do you say X?"), keeping
// only the quoted French vocabulary word itself - the very thing being
// tested - unchanged. The on-screen text (revealed on request) still shows
// the original French sentence untouched; only what gets spoken changes.
const QUOTED_WORD_PATTERN = /"([^"]+)"/;

export function buildSpokenQuizQuestion(questionText: string): string {
  const match = questionText.match(QUOTED_WORD_PATTERN);
  return match ? `How do you say "${match[1]}"?` : questionText;
}

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
