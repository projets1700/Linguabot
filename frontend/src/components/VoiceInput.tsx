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
 * saisie texte" - full voice immersion, no typing, no button either: the mic
 * listens automatically). Speech-to-text runs entirely in the browser via
 * the Web Speech API: no OpenAI/Whisper key is needed for this part, it's
 * real transcription today, not a simulation. The transcript is sent as
 * plain text to the same backend endpoints as before, so VoiceService's
 * simulated reply logic doesn't change at all.
 *
 * Listening starts the moment this mounts (or `disabled` turns false again
 * after a reply comes back) and restarts itself automatically after every
 * silence that produced no speech - a manual "no-speech"/"aborted" error is
 * not fatal, it just means try again. Only a real permission refusal
 * ("not-allowed") stops the loop, since retrying that is pointless without
 * the user changing a browser setting.
 */
export function VoiceInput({ onResult, disabled = false }: Props) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  const supported = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    if (!SpeechRecognitionCtor || disabled) {
      setListening(false);
      return;
    }

    let cancelled = false;

    function listenOnce() {
      if (cancelled || !SpeechRecognitionCtor) return;

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
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          cancelled = true;
          setListening(false);
          setError("Le micro est bloqué. Autorise l'accès au microphone dans ton navigateur.");
        }
        // Anything else (no-speech, aborted, network...) is transient:
        // onend still fires right after and the loop below restarts it.
      };

      recognition.onend = () => {
        setInterimText("");

        const transcript = finalTranscript.trim();
        if (transcript) {
          setListening(false);
          onResultRef.current(transcript);
          // Deliberately not restarted here: the parent flips `disabled`
          // to true while it processes the turn, which tears this effect
          // down; it restarts on its own once `disabled` goes back to
          // false for the next turn.
        } else if (!cancelled) {
          listenOnce();
        }
      };

      recognition.start();
      setListening(true);
      setError(null);
    }

    listenOnce();

    return () => {
      cancelled = true;
    };
  }, [disabled, SpeechRecognitionCtor]);

  if (!supported) {
    return (
      <p className="text-sm text-amber-400 text-center py-2">
        Ton navigateur ne supporte pas la reconnaissance vocale. Essaie avec Google Chrome ou Microsoft Edge.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div
        aria-hidden
        className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-colors ${
          listening ? "bg-red-600 animate-pulse" : "bg-slate-700"
        }`}
      >
        🎤
      </div>
      <p className="text-sm text-slate-400 min-h-[1.25rem] text-center max-w-sm">
        {error ?? (listening ? interimText || "Je t'écoute..." : "...")}
      </p>
    </div>
  );
}
