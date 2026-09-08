import type { MutableRefObject } from "react";
import { loadVoices, pickVoiceForGender } from "./voices";
import { useAuthStore } from "../stores/authStore";
import { useVoiceSettingsStore } from "../stores/voiceSettingsStore";
import { speakEnglishWithAzureVisemes, type AzureVisemeFrame } from "./azureSpeech";
import type { AvatarType } from "../types";

// Chrome/Edge reliably return an empty voice list from getVoices() until
// they've finished asynchronously enumerating voices - normally invisible
// because something has always already called getVoices() by the time a
// learner triggers speech, but the very first speakText() of a page (e.g.
// the A0 quiz's opening question, fired from a useEffect on mount) can
// race that and silently fall back to the browser's default voice. If
// voices genuinely never load in some environment, don't wait forever.
const VOICES_READY_TIMEOUT_MS = 500;

function waitForVoicesReady(): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis || window.speechSynthesis.getVoices().length > 0) {
    return Promise.resolve();
  }

  return Promise.race([
    loadVoices().then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, VOICES_READY_TIMEOUT_MS)),
  ]);
}

type SpeakOptions = {
  lang?: string;
  // Explicit override, used by the voice settings page to preview a voice
  // regardless of what's currently saved. Everywhere else this is left
  // unset and the learner's saved preference (if any) applies instead.
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  // Optional: reports the browser's own progress through the utterance
  // (charIndex, sometimes charLength) as it speaks, for lip-sync. Support
  // is inconsistent across browsers - some fire it per word, some per
  // character, some not at all - so callers must treat it as a bonus
  // signal, never the only way playback position is tracked. Omitting it
  // changes nothing for existing callers.
  onBoundary?: (event: SpeechSynthesisEvent) => void;
};

// Chrome has a long-standing bug where a SpeechSynthesisUtterance with no
// remaining JS reference can get garbage collected mid-speech, which
// silently kills the "end" event forever - since pages gate the mic
// (VoiceInput's `disabled`) on that event firing, the learner would be
// stuck unable to ever answer again. A module-level reference keeps the
// utterance alive for the browser's TTS engine.
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Every call gets a ticket; only the most recent one is allowed to actually
// call speak(). Needed because speakText() now waits on
// waitForVoicesReady() before it can speak - if a second call arrives
// while an earlier one is still waiting (e.g. React StrictMode invoking
// the same effect twice), that earlier call's cancel() at the top fires
// before the first call ever reached speak(), so it has nothing to
// interrupt - without this ticket check, both would go on to speak,
// reading as the same line said twice back to back instead of once.
let latestRequestId = 0;

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

  // Cancel whatever might still be queued/playing so turns never overlap -
  // done up front (not after the voices-ready wait below) so a rapid
  // second call still interrupts the first immediately.
  window.speechSynthesis.cancel();

  const requestId = ++latestRequestId;
  void waitForVoicesReady().then(() => {
    // A newer speakText() call has since arrived - this one was already
    // superseded before it ever got to speak, so it's discarded silently
    // (its onStart/onEnd never fire, same as if it had never been called).
    if (requestId !== latestRequestId) return;
    speakNow(text, options);
  });
}

function speakNow(text: string, options: SpeakOptions): void {
  if (!window.speechSynthesis) {
    options.onEnd?.();

    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const lang = options.lang ?? "en-US";
  utterance.lang = lang;

  // The voice picker only offers English voices (that's where nearly all
  // of the app's speech happens), so the saved preference is only applied
  // to English utterances - it must never hijack the A0 quiz's forced
  // lang="fr-FR" prompts, which need a French voice regardless.
  const preferredVoiceURI =
    options.voiceURI ?? (lang.startsWith("en") ? useVoiceSettingsStore.getState().selectedVoiceURI : null);
  let matchedVoice = preferredVoiceURI
    ? window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === preferredVoiceURI)
    : undefined;

  if (!matchedVoice) {
    // No explicit pick yet (the learner hasn't visited /voix, or it's
    // French where that page doesn't apply) - always resolve a voice
    // matching the learner's avatar gender ourselves instead of leaving
    // the utterance's voice unset, which is what let the browser's own
    // generic default voice slip through.
    const avatarType = useAuthStore.getState().user?.avatarType ?? "male";
    matchedVoice = pickVoiceForGender(window.speechSynthesis.getVoices(), lang.split("-")[0].toLowerCase(), avatarType) ?? undefined;
  }

  if (matchedVoice) utterance.voice = matchedVoice;

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
  if (options.onBoundary) utterance.onboundary = options.onBoundary;
  utterance.onend = settle;
  utterance.onerror = settle;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

type SpeakEnglishWithAvatarOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (event: SpeechSynthesisEvent) => void;
};

/**
 * English-only entry point used by the pages that render an AvatarScene
 * (Session, Placement test, Daily challenge) - tries Azure Speech first for
 * real audio and natively-synchronized visemes, and falls back to the
 * existing speechSynthesis path unchanged when Azure isn't configured or
 * the token request fails. The A0 quiz (French) never calls this - it
 * keeps calling speakText directly, since Azure has no French viseme
 * support (see azureSpeech.ts).
 */
export async function speakEnglishWithAvatar(
  text: string,
  avatarType: AvatarType,
  azureRefs: { framesRef: MutableRefObject<AzureVisemeFrame[]>; startTimeRef: MutableRefObject<number | null> },
  options: SpeakEnglishWithAvatarOptions = {},
): Promise<void> {
  const usedAzure = await speakEnglishWithAzureVisemes(text, avatarType, {
    onStart: options.onStart,
    onEnd: options.onEnd,
    framesRef: azureRefs.framesRef,
    startTimeRef: azureRefs.startTimeRef,
  });
  if (usedAzure) return;

  speakText(text, { lang: "en-US", onStart: options.onStart, onEnd: options.onEnd, onBoundary: options.onBoundary });
}
