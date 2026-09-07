export type VoiceGender = "male" | "female";

// The Web Speech API exposes no gender field on SpeechSynthesisVoice, only
// a free-text name that varies by OS/browser (Windows SAPI, Google's
// network voices, macOS voices, ...). These are the common name patterns
// across those engines; anything that doesn't match the male list is
// bucketed as female rather than adding a third "unsure" category.
const FEMALE_NAME_HINTS = [
  "female", "zira", "aria", "jenny", "ana", "michelle", "samantha", "karen",
  "moira", "tessa", "fiona", "victoria", "susan", "kate", "hazel",
  "catherine", "emma", "amy", "joanna", "salli", "kimberly", "zoe", "libby",
  "olivia", "elizabeth", "sonia",
];
const MALE_NAME_HINTS = [
  "male", "david", "mark", "guy", "christopher", "eric", "roger", "steffan",
  "alex", "daniel", "fred", "george", "james", "oliver", "ryan", "tom",
  "brian", "justin", "matthew", "arthur", "gordon", "thomas",
];

export function classifyVoiceGender(voice: SpeechSynthesisVoice): VoiceGender {
  const name = voice.name.toLowerCase();
  // Order matters: "female" contains "male" as a substring, so a name like
  // "Google UK English Female" would wrongly match the male hint if that
  // list were checked first.
  if (FEMALE_NAME_HINTS.some((hint) => name.includes(hint))) return "female";
  if (MALE_NAME_HINTS.some((hint) => name.includes(hint))) return "male";
  return "female";
}

export type GroupedVoices = Record<VoiceGender, SpeechSynthesisVoice[]>;

// Caps male at 3, per the app's voice picker (3 male, 3 female). Female
// also absorbs whatever doesn't match a male name hint, so it's capped at
// 6 instead of 3 - otherwise those extra voices would just disappear
// instead of becoming pickable female options.
export function groupEnglishVoicesByGender(voices: SpeechSynthesisVoice[]): GroupedVoices {
  const grouped: GroupedVoices = { male: [], female: [] };
  const englishVoices = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const voice of englishVoices) {
    grouped[classifyVoiceGender(voice)].push(voice);
  }

  return {
    male: grouped.male.slice(0, 3),
    female: grouped.female.slice(0, 6),
  };
}

// Chrome/Edge load the voice list asynchronously - getVoices() can return
// an empty array on the very first call, filling in only once
// "voiceschanged" fires.
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }

  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const handleVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", handleVoicesChanged);
  });
}
