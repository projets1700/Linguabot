function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .replaceAll(/['’‘]/g, "")
    .replaceAll(/[.,!?;:"“”()]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

const FILLER_WORDS = new Set(["um", "umm", "uh", "uhh", "well", "so", "hmm"]);

function stripFillerWords(words: string[]): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && FILLER_WORDS.has(words[start])) start++;
  while (end > start && FILLER_WORDS.has(words[end - 1])) end--;
  return words.slice(start, end);
}

function coreOf(transcript: string): string {
  return stripFillerWords(normalize(transcript).split(" ").filter(Boolean)).join(" ");
}

const NAME_LEAD_INS: readonly string[] = ["my name is", "im", "i am"];

export function isRecognizableNameReply(transcript: string): boolean {
  const words = stripFillerWords(normalize(transcript).split(" ").filter(Boolean));
  if (words.length === 0) return false;

  const joined = words.join(" ");
  for (const leadIn of NAME_LEAD_INS) {
    const leadInWords = leadIn.split(" ");
    if (leadInWords.every((word, i) => words[i] === word)) {
      return words.length > leadInWords.length;
    }
  }

  return joined.length > 0;
}

export type OnboardingReadinessIntent = "affirmative" | "negative" | "ambiguous";

const AFFIRMATIVE_PHRASES: readonly string[] = [
  "yes", "yeah", "yep", "yup", "ready", "im ready", "i am ready", "lets go", "ok", "okay", "sure",
];

const NEGATIVE_PHRASES: readonly string[] = [
  "no", "nope", "not now", "not yet", "im not ready", "i am not ready", "no thanks", "later",
];

export function classifyOnboardingReadiness(transcript: string): OnboardingReadinessIntent {
  const core = coreOf(transcript);
  if (AFFIRMATIVE_PHRASES.includes(core)) return "affirmative";
  if (NEGATIVE_PHRASES.includes(core)) return "negative";
  return "ambiguous";
}
