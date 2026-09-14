import { normalizeSpeechTranscript, stripFillerWords } from "./speechNormalization";

const FILLER_WORDS = new Set(["um", "umm", "uh", "uhh", "well", "so", "hmm"]);

function coreOf(transcript: string): string {
  return stripFillerWords(normalizeSpeechTranscript(transcript).split(" ").filter(Boolean), FILLER_WORDS).join(" ");
}

const NAME_LEAD_INS: readonly string[] = ["my name is", "im", "i am"];

export function isRecognizableNameReply(transcript: string): boolean {
  const words = stripFillerWords(normalizeSpeechTranscript(transcript).split(" ").filter(Boolean), FILLER_WORDS);
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
