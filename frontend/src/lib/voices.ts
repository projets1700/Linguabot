export type VoiceGender = "male" | "female" | "neutral";

// The Web Speech API exposes no gender field on SpeechSynthesisVoice, only
// a free-text name that varies by OS/browser (Windows SAPI, Google's
// network voices, macOS voices, ...). These are the common name patterns
// across those engines; anything that doesn't match either list falls back
// to "neutral" rather than guessing wrong.
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
  if (FEMALE_NAME_HINTS.some((hint) => name.includes(hint))) return "female";
  if (MALE_NAME_HINTS.some((hint) => name.includes(hint))) return "male";
  return "neutral";
}

export type GroupedVoices = Record<VoiceGender, SpeechSynthesisVoice[]>;

// Caps each category at 3, per the app's voice picker (3 male, 3 female, 3
// neutral) - a machine with more English voices installed just has its
// extras left out rather than overwhelming the picker.
export function groupEnglishVoicesByGender(voices: SpeechSynthesisVoice[]): GroupedVoices {
  const grouped: GroupedVoices = { male: [], female: [], neutral: [] };
  const englishVoices = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const voice of englishVoices) {
    grouped[classifyVoiceGender(voice)].push(voice);
  }

  return {
    male: grouped.male.slice(0, 3),
    female: grouped.female.slice(0, 3),
    neutral: grouped.neutral.slice(0, 3),
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
