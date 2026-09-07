import { useVoiceSettingsStore } from "../stores/voiceSettingsStore";

type SpeakOptions = {
  lang?: string;
  // Explicit override, used by the voice settings page to preview a voice
  // regardless of what's currently saved. Everywhere else this is left
  // unset and the learner's saved preference (if any) applies instead.
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
};

// Chrome has a long-standing bug where a SpeechSynthesisUtterance with no
// remaining JS reference can get garbage collected mid-speech, which
// silently kills the "end" event forever - since pages gate the mic
// (VoiceInput's `disabled`) on that event firing, the learner would be
// stuck unable to ever answer again. A module-level reference keeps the
// utterance alive for the browser's TTS engine.
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Belt-and-braces on top of the reference above: if "end"/"error" still
// never fire for any reason (wedged engine, no voices installed, a
// backgrounded tab), this ceiling force-releases the mic instead of
// leaving it disabled forever. Comfortably longer than any single reply
// takes to speak.
const FALLBACK_TIMEOUT_MS = 15000;

/**
 * Reads text aloud via the browser's native Web Speech API
 * (speechSynthesis) - real TTS today, no OpenAI key needed, same "browser
 * does the real work" pattern as the STT side (VoiceInput). The AI is meant
 * to be heard, not read: pages call this for every assistant message and
 * keep the text hidden until the learner explicitly asks to see it.
 */
export function speakText(text: string, options: SpeakOptions = {}): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    options.onEnd?.();

    return;
  }

  // Cancel whatever might still be queued/playing so turns never overlap.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const lang = options.lang ?? "en-US";
  utterance.lang = lang;

  // The voice picker only offers English voices (that's where nearly all
  // of the app's speech happens), so the saved preference is only applied
  // to English utterances - it must never hijack the A0 quiz's forced
  // lang="fr-FR" prompts, which need a French voice regardless.
  const preferredVoiceURI =
    options.voiceURI ?? (lang.startsWith("en") ? useVoiceSettingsStore.getState().selectedVoiceURI : null);
  if (preferredVoiceURI) {
    const match = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.voiceURI === preferredVoiceURI);
    if (match) utterance.voice = match;
  }

  let settled = false;
  const fallbackTimer = setTimeout(() => settle(), FALLBACK_TIMEOUT_MS);

  function settle() {
    if (settled) return;
    settled = true;
    clearTimeout(fallbackTimer);
    if (currentUtterance === utterance) currentUtterance = null;
    options.onEnd?.();
  }

  if (options.onStart) utterance.onstart = options.onStart;
  utterance.onend = settle;
  utterance.onerror = settle;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}
