/**
 * Picks one real sentence out of an AI message to use as a repeat-after-me
 * target for PronunciationPractice - never a rewritten or invented one.
 *
 * Calibrated against real LinguaBot output (a live A1 session replied "Hi!
 * Nice to meet you too.\n\nWhat is your name?" - note the blank line
 * between sentences, not just a space; a live B2 session replied with three
 * paragraphs whose sentences ran 15 to over 40 words each), not just
 * inferred from the CECRL prompt instructions.
 */

type CecrlLevelCode = "A0" | "A1" | "A2" | "B1" | "B2";

type WordRange = { min: number; max: number };

/**
 * Ideal word count per level for spoken repetition. Loose ranges, not a
 * hard cutoff (see rangeDistance/selectPracticeSentence below): real AI
 * replies at B2 in particular regularly run every sentence past their
 * "ideal" ceiling, so the selection falls back to whichever real sentence
 * comes closest rather than ever fabricating a shorter one.
 */
const WORD_RANGE_BY_LEVEL: Record<CecrlLevelCode, WordRange> = {
  A0: { min: 3, max: 7 },
  A1: { min: 3, max: 9 },
  A2: { min: 4, max: 11 },
  B1: { min: 5, max: 13 },
  B2: { min: 6, max: 16 },
};

// Used when the level is unknown/unrecognized - the middle of the table
// rather than either extreme.
const DEFAULT_WORD_RANGE: WordRange = WORD_RANGE_BY_LEVEL.A2;

// Skips list items ("- ...", "1. ...", "1) ...") and anything containing
// characters that don't belong in spoken practice (markup, URLs) - soft
// exclusions from the candidate pool, not a hard failure of the whole
// message, per the "avoid where possible" requirement.
const LIST_MARKER = /^([-*•]|\d+[.)])\s/;
const TECHNICAL_CHARACTERS = /[{}<>_=`]|https?:\/\//;

function splitIntoSentences(text: string): string[] {
  // Sentence-ending punctuation followed by any run of whitespace - a real
  // AI reply used a blank line (two newlines) between sentences, not just a
  // space, so this can't assume a single ASCII space.
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function countWords(sentence: string): number {
  // Letters/digits/apostrophes only, same "strip everything else" approach
  // VoiceService::normalizeToWords() already uses server-side - keeps
  // contractions ("that's") as one word without needing a special case.
  const matches = sentence.match(/[\p{L}\p{N}']+/gu);
  return matches ? matches.length : 0;
}

function isUsableCandidate(sentence: string): boolean {
  if (LIST_MARKER.test(sentence)) return false;
  if (TECHNICAL_CHARACTERS.test(sentence)) return false;
  return countWords(sentence) > 0;
}

// How far a candidate's word count sits above the ideal ceiling - 0 when
// it's within range. Deliberately one-sided: the "tolerance" this project
// asked for is for sentences running a bit long (real AI replies, especially
// at B2, routinely do), not for accepting something too short to be worth
// repeating - that's handled separately, by filtering out anything under
// the minimum before this is even applied (see selectPracticeSentence).
function overage(wordCount: number, range: WordRange): number {
  return wordCount > range.max ? wordCount - range.max : 0;
}

/**
 * Extracts one sentence from `text`, verbatim, sized for spoken repetition
 * at `levelCode`'s CECRL level (falls back to a middling range for an
 * unknown/missing level).
 *
 * Candidates at or above the level's minimum word count are preferred over
 * shorter ones (a stray one-word "Sure." isn't worth practicing even though
 * it's short); among those, the one closest to (or under) the ideal ceiling
 * wins, first occurrence breaking ties. Only if every candidate is shorter
 * than the minimum does a short one get picked anyway - still better than
 * nothing. Returns null only when nothing usable remains at all (empty
 * text, or every sentence is a list item / contains technical characters).
 */
export function selectPracticeSentence(text: string, levelCode?: string): string | null {
  const range =
    levelCode !== undefined && levelCode in WORD_RANGE_BY_LEVEL
      ? WORD_RANGE_BY_LEVEL[levelCode as CecrlLevelCode]
      : DEFAULT_WORD_RANGE;

  const candidates = splitIntoSentences(text).filter(isUsableCandidate);
  if (candidates.length === 0) return null;

  const longEnough = candidates.filter((candidate) => countWords(candidate) >= range.min);
  const pool = longEnough.length > 0 ? longEnough : candidates;

  let best = pool[0];
  let bestOverage = overage(countWords(best), range);

  for (const candidate of pool.slice(1)) {
    const candidateOverage = overage(countWords(candidate), range);
    if (candidateOverage < bestOverage) {
      best = candidate;
      bestOverage = candidateOverage;
    }
  }

  return best;
}
