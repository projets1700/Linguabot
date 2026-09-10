// Deterministic voice-intent detection for the Dashboard's guided intro
// (§2-3 of the chantier: avatar greets, learner answers "yes"/picks a card).
// No AI call needed - same normalize-then-exact-match discipline as
// detectLearnerBlock.ts, deliberately not a naive `.includes()` search.

// One session = one login, not one browser tab lifetime: DashboardPage
// reads this once (on mount) to decide whether to skip straight to the
// cards, and sets it once the intro is actually skipped/completed.
// authStore's logout() clears it again - so a learner who logs out and
// back in in the very same tab still gets the guided intro, even though
// sessionStorage itself would otherwise still be holding the previous
// login's flag (it's scoped to the tab, not to auth state).
const DASHBOARD_INTRO_SEEN_KEY = "linguabot:dashboardIntroSeen";

export function hasSeenDashboardIntro(): boolean {
  try {
    return typeof window !== "undefined" && sessionStorage.getItem(DASHBOARD_INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDashboardIntroSeen(): void {
  try {
    sessionStorage.setItem(DASHBOARD_INTRO_SEEN_KEY, "1");
  } catch {
    // Storage unavailable (e.g. some private-browsing modes) - worst case
    // the intro replays next time, which is the safe direction to fail in.
  }
}

export function clearDashboardIntroSeen(): void {
  try {
    sessionStorage.removeItem(DASHBOARD_INTRO_SEEN_KEY);
  } catch {
    // Nothing to clean up either way.
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    // Strips accents (é -> e, ê -> e...) so both accented and unaccented
    // transcripts match the same (unaccented) alias/phrase tables below -
    // speech recognition doesn't reliably preserve them either way.
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .replaceAll(/['’‘]/g, "")
    .replaceAll(/[.,!?;:"“”()]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

const FILLER_WORDS = new Set([
  "um", "umm", "uh", "uhh", "well", "so", "hmm", "euh", "bah", "donc", "alors", "ok", "okay",
]);

function stripFillerWords(words: string[]): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && FILLER_WORDS.has(words[start])) start++;
  while (end > start && FILLER_WORDS.has(words[end - 1])) end--;
  return words.slice(start, end);
}

function coreOf(transcript: string): string {
  const words = normalize(transcript).split(" ").filter(Boolean);
  return stripFillerWords(words).join(" ");
}

// Exact phrases only (post-normalization) - a fixed, short list of common
// ways to say "yes, let's start", not a heuristic judgment of intent.
const READY_PHRASES: readonly string[] = [
  "oui",
  "oui je suis pret",
  "pret",
  "je suis pret",
  "allons-y",
  "on commence",
  "daccord",
  "ok",
  "yes",
  "yeah",
  "yep",
  "ready",
  "im ready",
  "i am ready",
  "lets go",
  "okay",
];

/**
 * Did the learner say something equivalent to "yes, I'm ready" in response
 * to the Dashboard intro's greeting? Exact-match only (see READY_PHRASES) -
 * a transcript that merely *contains* one of these words is intentionally
 * NOT enough (e.g. a longer, unrelated sentence that happens to include
 * "ok" partway through), same discipline as detectLearnerBlock.ts.
 */
export function detectDashboardReadyIntent(transcript: string): boolean {
  return READY_PHRASES.includes(coreOf(transcript));
}

export type DashboardDestinationKey =
  | "scenarios"
  | "quiz"
  | "dailyChallenge"
  | "progress"
  | "badges"
  | "trophies"
  | "profile";

export type DashboardDestination = {
  key: DashboardDestinationKey;
  route: string;
  /** Spoken before navigating (§16) - deterministic, no AI call needed. */
  confirmSpeech: string;
};

// A negated request ("je ne veux pas faire le quiz") must not still match
// "quiz" as a destination (§15) - checked before any alias, so a negation
// anywhere in the transcript makes the whole utterance ambiguous rather
// than trying to parse which part of the sentence it negates. Deliberately
// small and specific, not a general sentiment/NLP pass.
const NEGATION_TOKENS = new Set(["pas", "jamais", "dont", "not", "non"]);

// route/confirmSpeech reuse the real routes confirmed in App.tsx (audit
// step 0). "progress" and "trophies" both land on /trophees - the app
// doesn't have a separate progress page (Progression already links there
// in the nav/dashboard cards) - kept as two destinations because the
// spoken confirmation differs by what the learner actually asked for (§16
// gives distinct example lines for "Progression" vs "Trophées").
const DESTINATIONS: { key: DashboardDestinationKey; route: string; confirmSpeech: string; aliases: string[] }[] = [
  {
    key: "scenarios",
    route: "/catalog",
    confirmSpeech: "Très bien, allons voir les scénarios.",
    aliases: ["scenario", "scenarios", "les scenarios", "conversation", "conversations"],
  },
  {
    key: "quiz",
    route: "/quiz",
    confirmSpeech: "Très bien, commençons le quiz.",
    aliases: ["quiz", "quiz vocal", "le quiz", "vocabulaire"],
  },
  {
    key: "dailyChallenge",
    route: "/defi-du-jour",
    confirmSpeech: "Parfait, commençons le défi du jour.",
    aliases: ["defi", "defi du jour", "le defi", "le defi du jour", "challenge", "daily challenge"],
  },
  {
    key: "progress",
    route: "/trophees",
    confirmSpeech: "Regardons ta progression.",
    aliases: ["progression", "ma progression", "progres", "mes progres", "progress", "my progress"],
  },
  {
    key: "badges",
    route: "/badges",
    confirmSpeech: "Allons voir tes badges.",
    aliases: ["badge", "badges", "mes badges"],
  },
  {
    key: "trophies",
    route: "/trophees",
    confirmSpeech: "Allons voir tes trophées.",
    aliases: ["trophee", "trophees", "mes trophees", "trophy", "trophies"],
  },
  {
    key: "profile",
    route: "/mon-compte",
    confirmSpeech: "Allons voir ton profil.",
    aliases: ["profil", "mon profil", "compte", "mon compte", "profile", "account"],
  },
];

/**
 * Which card the learner meant, from a spoken destination (§13-15) - a
 * fixed alias table, matched as whole tokens against the normalized
 * transcript (not substring search: aliases are multi-word phrases too,
 * e.g. "defi du jour", checked as a contiguous run of tokens). Returns null
 * for anything negated, ambiguous, or matching no known destination -
 * callers must not navigate on null.
 */
export function detectDashboardDestination(transcript: string): DashboardDestination | null {
  const words = normalize(transcript).split(" ").filter(Boolean);
  if (words.some((word) => NEGATION_TOKENS.has(word))) return null;

  const normalizedTranscript = words.join(" ");

  for (const destination of DESTINATIONS) {
    for (const alias of destination.aliases) {
      const aliasWords = alias.split(" ");
      if (containsSequence(words, aliasWords) || normalizedTranscript === alias) {
        return { key: destination.key, route: destination.route, confirmSpeech: destination.confirmSpeech };
      }
    }
  }

  return null;
}

function containsSequence(words: string[], sequence: string[]): boolean {
  if (sequence.length > words.length) return false;

  for (let start = 0; start <= words.length - sequence.length; start++) {
    let matches = true;
    for (let offset = 0; offset < sequence.length; offset++) {
      if (words[start + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}
