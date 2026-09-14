import { normalizeSpeechTranscript, stripFillerWords } from "./speechNormalization";

export type BlockDetection = {
  blocked: boolean;
};

// Exact phrases (already normalized: lowercase, no apostrophes/punctuation)
// this detects - deliberately explicit and short, not a heuristic judgment
// of whether an answer is "good enough". "I don't know" and "I dont know"
// collapse to the same normalized string, so only one entry is needed for
// that pair.
const BLOCK_PHRASES: readonly string[] = [
  "i dont know",
  "i do not know",
  "i dont understand",
  "i do not understand",
  "i have no idea",
  "no idea",
  "im not sure",
  "i am not sure",
  "can you help me",
  "help me",
];

// Stripped from the start/end of the transcript before matching, so "Sorry,
// I don't know" or "Um, no idea" still match - but only when they wrap the
// block phrase, not when they wrap a real (if hedged) answer.
const FILLER_WORDS = new Set([
  "um", "umm", "uh", "uhh", "well", "so", "hmm", "sorry", "actually", "like", "ok", "okay",
]);

/**
 * Detects an EXPLICIT "I'm stuck" statement from the learner - a
 * deterministic match against a short, fixed list of common ways to say "I
 * don't know" or ask for help ("can you help me", "help me"), not a
 * heuristic judgment of answer quality. Deliberately not a naive substring
 * search: "I have no idea what to eat, but I'll say pizza" contains "no
 * idea" yet is a real (if hedged) answer, not a block. Matching only after
 * stripping a few filler words from each end of the WHOLE transcript avoids
 * that false positive - the leftover "core" has to be nothing but the block
 * phrase itself.
 */
export function detectLearnerBlock(transcript: string): BlockDetection {
  const words = normalizeSpeechTranscript(transcript).split(" ").filter(Boolean);
  const core = stripFillerWords(words, FILLER_WORDS).join(" ");

  return { blocked: BLOCK_PHRASES.includes(core) };
}
