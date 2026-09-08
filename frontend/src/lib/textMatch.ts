/**
 * Whether a recognized phrase is close enough to what the learner was asked
 * to repeat to call it "recognized". This is a text-comparison gate, not a
 * pronunciation measurement - the underlying similarity number is purely an
 * internal decision threshold (see matchRecognizedText) and is never itself
 * returned or displayed: nothing here claims to know how the words actually
 * sounded, only whether the recognized text plausibly matches the target.
 */
export type RecognitionMatch = "matched" | "close" | "retry";

/**
 * Word-overlap ratio (fraction of the target phrase's words also found in
 * the recognized text) at or above which the phrase counts as recognized.
 * Deliberately loose: real speech recognition drops or mangles the
 * occasional short word (articles, "to") even on a correctly spoken
 * sentence - this is a recognition gate for feedback purposes, not a
 * grading rubric, so it tolerates that noise rather than demanding a
 * perfect transcript.
 */
const MATCHED_WORD_OVERLAP = 0.85;

/**
 * Below MATCHED_WORD_OVERLAP but at or above this: enough of the target
 * phrase came through to encourage another attempt ("close") rather than
 * suggesting the learner start over ("retry").
 */
const CLOSE_WORD_OVERLAP = 0.5;

/**
 * Lowercases, trims, collapses whitespace, normalizes typographic
 * apostrophes to a plain one, and strips common punctuation. Deliberately
 * does NOT expand contractions or otherwise rewrite words - Web Speech API
 * output is compared as spoken, not rewritten to fit an assumption about
 * what the learner "meant".
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[.,!?;:"“”()]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function wordsOf(text: string): string[] {
  const normalized = normalizeForMatch(text);
  return normalized === "" ? [] : normalized.split(" ");
}

/**
 * Fraction of `target`'s words that also appear in `recognized` (each
 * recognized word consumed at most once, so repeating a word doesn't
 * inflate the score). Order-independent on purpose: a learner repeating a
 * sentence back rarely reproduces word order errors worth flagging here,
 * and Web Speech API's own word order is already whatever was actually
 * said.
 */
function wordOverlapRatio(target: string, recognized: string): number {
  const targetWords = wordsOf(target);
  const recognizedWords = wordsOf(recognized);
  if (targetWords.length === 0 || recognizedWords.length === 0) return 0;

  const available = new Map<string, number>();
  for (const word of recognizedWords) {
    available.set(word, (available.get(word) ?? 0) + 1);
  }

  let matched = 0;
  for (const word of targetWords) {
    const count = available.get(word) ?? 0;
    if (count > 0) {
      matched++;
      available.set(word, count - 1);
    }
  }

  return matched / targetWords.length;
}

/**
 * Decides whether `recognized` (what Web Speech API heard) is close enough
 * to `target` (the phrase the learner was asked to repeat) to call it
 * recognized. Returns a business result the UI can render directly
 * ("Phrase reconnue" / "Presque, essaie encore" / "Essaie encore") - never
 * a number, never labeled as a pronunciation or accuracy score.
 */
export function matchRecognizedText(target: string, recognized: string): RecognitionMatch {
  if (normalizeForMatch(recognized) === "") return "retry";
  if (normalizeForMatch(target) === normalizeForMatch(recognized)) return "matched";

  const overlap = wordOverlapRatio(target, recognized);
  if (overlap >= MATCHED_WORD_OVERLAP) return "matched";
  if (overlap >= CLOSE_WORD_OVERLAP) return "close";
  return "retry";
}
