import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (transcript: string) => void;
  disabled?: boolean;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;

  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/**
 * Replaces the text input across every conversation screen (CDCF §1.2 "zéro
 * saisie texte" - full voice immersion, no typing). Speech-to-text runs
 * entirely in the browser via the Web Speech API: no OpenAI/Whisper key is
 * needed for this part, it's real transcription today, not a simulation.
 * The transcript is then sent as plain text to the same backend endpoints
 * as before, so VoiceService's simulated reply logic doesn't change at all.
 */
export function VoiceInput({ onResult, disabled = false }: Props) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  const supported = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  function startListening() {
    if (!SpeechRecognitionCtor || disabled || listening) return;

    setError(null);
    setInterimText("");

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      setListening(false);
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Le micro est bloqué. Autorise l'accès au microphone dans ton navigateur."
          : "Je n'ai rien entendu, réessaie.",
      );
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");

      const transcript = finalTranscript.trim();
      if (transcript) {
        onResult(transcript);
      } else {
        setError((current) => current ?? "Je n'ai rien entendu, réessaie.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  if (!supported) {
    return (
      <p className="text-sm text-amber-400 text-center py-2">
        Ton navigateur ne supporte pas la reconnaissance vocale. Essaie avec Google Chrome ou Microsoft Edge.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        disabled={disabled}
        aria-label={listening ? "Arrêter l'enregistrement" : "Parler"}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-colors disabled:opacity-50 ${
          listening ? "bg-red-600 animate-pulse" : "bg-blue-600 hover:bg-blue-500"
        }`}
      >
        🎤
      </button>
      <p className="text-sm text-slate-400 min-h-[1.25rem] text-center max-w-sm">
        {listening ? interimText || "Je t'écoute..." : (error ?? "Appuie sur le micro pour parler")}
      </p>
    </div>
  );
}
