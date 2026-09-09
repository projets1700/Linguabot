import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (transcript: string) => void;
  disabled?: boolean;
  // Defaults to English (every existing caller's conversation is in
  // English). The Dashboard's guided intro talks to the learner in French,
  // so it passes "fr-FR" here for better recognition of its own replies.
  lang?: string;
  // "default" (red mic, unchanged) matches every existing caller. "brand"
  // swaps the listening color to LinguaBot's own blue accent instead of a
  // red that reads as "error/recording" - for the Dashboard intro, which
  // sits on a warm classroom photo rather than a plain dark panel.
  variant?: "default" | "brand";
  // "default" (64px, unchanged) matches every existing caller. "compact"
  // (44px, tighter status text) is for the Dashboard intro, where the mic
  // sits attached to the avatar itself rather than in its own full-width row.
  size?: "default" | "compact";
  // Optional: lets a caller mirror the mic's own listening state into its
  // own UI (e.g. the Dashboard's "Disponible pour parler" line swapping to
  // "Je t'écoute…") without duplicating the recognition logic itself.
  // Every existing caller omits this and is unaffected.
  onListeningChange?: (listening: boolean) => void;
  // When the caller already shows an equivalent status elsewhere (see
  // onListeningChange above), this suppresses VoiceInput's own status line
  // so the same state isn't announced twice in two different phrasings.
  // Defaults to false (unchanged) for every existing caller.
  hideStatusText?: boolean;
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
 *
 * The one button this renders is a mute toggle: it does not start a turn
 * (there is nothing to "press to talk"), it only lets the learner switch
 * the always-on mic off - e.g. to think out loud, cough, or take a call -
 * without the app picking that up as an answer.
 */
export function VoiceInput({
  onResult,
  disabled = false,
  lang = "en-US",
  variant = "default",
  size = "default",
  onListeningChange,
  hideStatusText = false,
}: Props) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;

  // Own effect (not folded into the recognition effect above) purely so a
  // caller-provided callback can never itself influence when recognition
  // restarts - it only ever observes `listening` after the fact.
  useEffect(() => {
    onListeningChangeRef.current?.(listening);
  }, [listening]);

  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  const supported = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    if (!SpeechRecognitionCtor || disabled || !micEnabled) {
      setListening(false);
      return;
    }

    let cancelled = false;
    let activeRecognition: SpeechRecognition | null = null;

    function listenOnce() {
      if (cancelled || !SpeechRecognitionCtor) return;

      const recognition = new SpeechRecognitionCtor();
      activeRecognition = recognition;
      recognition.lang = lang;
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

        // Must be checked first, before anything else: once torn down (the
        // AI started talking, the turn is being sent, or the mic was
        // muted), NOTHING this recognition still reports counts - not even
        // a transcript already in flight when abort() was called below.
        // Without this guard, a straggling result could still be
        // submitted as if the learner said it, even though the mic had
        // already been told to stop - which is exactly how the app ended
        // up "answering its own question" despite being muted while
        // speaking: stopping new restarts never stopped the recognition
        // that was already running.
        if (cancelled) return;

        const transcript = finalTranscript.trim();
        if (transcript) {
          setListening(false);
          onResultRef.current(transcript);
          // Deliberately not restarted here: the parent flips `disabled`
          // to true while it processes the turn, which tears this effect
          // down; it restarts on its own once `disabled` goes back to
          // false for the next turn.
        } else {
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
      // Actually stop the microphone, not just the app-level restart loop -
      // an abandoned-but-still-running recognition keeps capturing audio
      // (including the AI's own voice through the speakers) with nothing
      // left to stop it from eventually firing onend with a transcript.
      activeRecognition?.abort();
    };
  }, [disabled, micEnabled, SpeechRecognitionCtor, lang]);

  if (!supported) {
    return (
      <p className="text-sm text-amber-400 text-center py-2">
        Ton navigateur ne supporte pas la reconnaissance vocale. Essaie avec Google Chrome ou Microsoft Edge.
      </p>
    );
  }

  const compact = size === "compact";

  return (
    <div className={compact ? "flex flex-col items-center gap-1" : "flex flex-col items-center gap-2 py-2"}>
      <button
        type="button"
        onClick={() => setMicEnabled((current) => !current)}
        aria-label={micEnabled ? "Désactiver le micro" : "Activer le micro"}
        aria-pressed={micEnabled}
        className={`${compact ? "w-11 h-11 text-lg" : "w-16 h-16 text-2xl"} rounded-full flex items-center justify-center transition-colors ${
          !micEnabled
            ? variant === "brand"
              ? "bg-slate-900/60 hover:bg-slate-800/70 backdrop-blur-sm"
              : "bg-slate-800 hover:bg-slate-700"
            : listening
              ? variant === "brand"
                ? "bg-blue-600 shadow-[0_0_0_6px_rgba(37,99,235,0.25)] animate-pulse"
                : "bg-red-600 animate-pulse"
              : variant === "brand"
                ? "bg-blue-950/60 backdrop-blur-sm"
                : "bg-slate-700"
        }`}
      >
        {micEnabled ? "🎤" : "🔇"}
      </button>
      {(() => {
        const statusText = !micEnabled ? "Micro coupé" : (error ?? (listening ? interimText || "Je t'écoute..." : "..."));
        // hideStatusText only suppresses the generic idle/listening chatter
        // (the caller is showing that state itself, right next to this
        // control - see the Dashboard's own status line) - a real problem
        // (blocked mic, muted) still surfaces here, since nothing else
        // would otherwise tell the learner about it.
        if (hideStatusText && micEnabled && !error) return null;
        return (
          <p
            className={
              compact
                ? "text-xs text-slate-300 min-h-[1rem] text-center max-w-[10rem] leading-tight"
                : "text-sm text-slate-400 min-h-[1.25rem] text-center max-w-sm"
            }
          >
            {statusText}
          </p>
        );
      })()}
    </div>
  );
}
