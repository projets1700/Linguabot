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
