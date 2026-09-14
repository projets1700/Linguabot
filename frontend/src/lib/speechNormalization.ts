// Shared by dashboardIntro.ts, onboardingIntro.ts and detectLearnerBlock.ts -
// each used to carry a near-identical copy of these two functions (audit
// P2-04). Domain-specific word lists (filler words, block/ready/name
// phrases) stay in their own files; only the normalize/strip mechanics are
// shared here.

/**
 * Lowercases, strips accents (é -> e, ê -> e...) and punctuation, and
 * collapses whitespace - speech recognition doesn't reliably preserve
 * accents or punctuation either way, so every caller needs the same
 * accent-insensitive comparison.
 */
export function normalizeSpeechTranscript(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .replaceAll(/['’‘]/g, "")
    .replaceAll(/[.,!?;:"“”()]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Strips filler words from the START/END of a word list only (never from
 * the middle) - so "Sorry, I don't know" or "Um, no idea" still match their
 * intended phrase, but a filler word that happens to appear mid-sentence in
 * a real (if hedged) answer isn't silently dropped.
 */
export function stripFillerWords(words: string[], fillerWords: ReadonlySet<string>): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && fillerWords.has(words[start])) start++;
  while (end > start && fillerWords.has(words[end - 1])) end--;
  return words.slice(start, end);
}
