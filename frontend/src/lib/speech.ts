type SpeakOptions = {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
};

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
  utterance.lang = options.lang ?? "en-US";
  if (options.onStart) utterance.onstart = options.onStart;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }

  window.speechSynthesis.speak(utterance);
}
