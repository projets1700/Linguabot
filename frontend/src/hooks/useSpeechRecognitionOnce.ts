import { useEffect, useRef, useState } from "react";

export type SpeechRecognitionOnceError = "unsupported" | "not-allowed" | "no-speech";

const ERROR_MESSAGE: Record<SpeechRecognitionOnceError, string> = {
  unsupported: "Ton navigateur ne supporte pas la reconnaissance vocale. Essaie avec Google Chrome ou Microsoft Edge.",
  "not-allowed": "Le micro est bloqué. Autorise l'accès au microphone dans ton navigateur.",
  "no-speech": "Je n'ai rien entendu. Réessaie en parlant plus près du micro.",
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;

  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/**
 * A single listen-and-stop capture, deliberately separate from
 * VoiceInput.tsx: VoiceInput is built for the always-on conversation loop
 * (auto-restart on silence, a mute toggle, gated by the parent's `disabled`)
 * and reusing it here would mean fighting that design for a one-shot
 * "press Réessayer, say the line once" exercise instead. This hook shares
 * only the same Web Speech API surface, not VoiceInput's component or its
 * restart-on-silence behaviour - a silent/failed attempt is reported back
 * as a result, not retried automatically, so the learner stays in control
 * of when the mic listens again.
 */
export function useSpeechRecognitionOnce() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechRecognitionOnceError | null>(null);
  const activeRecognitionRef = useRef<SpeechRecognition | null>(null);

  const supported = Boolean(getSpeechRecognitionConstructor());

  // Stop a still-running capture if the component using this hook unmounts
  // mid-listen (e.g. the practice panel is closed) - otherwise the mic
  // keeps capturing with no one left to hand the result to.
  useEffect(() => {
    return () => {
      activeRecognitionRef.current?.abort();
    };
  }, []);

  function listenOnce(onResult: (transcript: string) => void) {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setError("unsupported");
      return;
    }

    setError(null);
    const recognition = new SpeechRecognitionCtor();
    activeRecognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    let finalTranscript = "";
    // Local to this one attempt (not state) so onend can tell, without a
    // stale-closure risk, whether onerror already flagged something more
    // specific than plain silence.
    let hadPermissionError = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        hadPermissionError = true;
        setError("not-allowed");
      }
      // Anything else (no-speech, aborted, network...) is reported via
      // onend below, once the browser actually stops.
    };

    recognition.onend = () => {
      setListening(false);
      activeRecognitionRef.current = null;

      if (hadPermissionError) return;

      const transcript = finalTranscript.trim();
      if (transcript) {
        onResult(transcript);
      } else {
        setError("no-speech");
      }
    };

    recognition.start();
    setListening(true);
  }

  return { supported, listening, error, errorMessage: error ? ERROR_MESSAGE[error] : null, listenOnce };
}
