import { useState } from "react";
import { useSpeechRecognitionOnce } from "../hooks/useSpeechRecognitionOnce";
import { matchRecognizedText, type RecognitionMatch } from "../lib/textMatch";
import { speakText } from "../lib/speech";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/ErrorBanner";

/**
 * Mirrors CecrlProfile.transcriptMode ("auto" for A0/A1, "available" for A2,
 * "onDemand" for B1/B2) - reused as-is rather than adding a new CECRL field
 * just for this. It only changes how prominent the entry trigger looks
 * (same pattern as HelpPanel's translate button), never whether the
 * exercise itself is reachable.
 */
export type PronunciationPracticeProminence = "auto" | "available" | "onDemand";

type Props = {
  targetText: string;
  prominence?: PronunciationPracticeProminence;
  onClose?: () => void;
};

const MATCH_FEEDBACK: Record<RecognitionMatch, { icon: string; label: string }> = {
  matched: { icon: "✅", label: "Phrase reconnue" },
  close: { icon: "🟡", label: "Presque, essaie encore" },
  retry: { icon: "🔴", label: "Essaie encore" },
};

/**
 * A honest, free repeat-after-me exercise: NOT a phonetic analyzer. It only
 * ever reports whether the text Web Speech API recognized is close enough
 * to the target phrase to call it "recognized" - see textMatch.ts. There is
 * no accuracy/pronunciation score anywhere in this component, on purpose.
 */
export function PronunciationPractice({ targetText, prominence = "available", onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [match, setMatch] = useState<RecognitionMatch | null>(null);
  const { supported, listening, error, errorMessage, listenOnce } = useSpeechRecognitionOnce();

  function handleListenToTarget() {
    speakText(targetText, {
      lang: "en-US",
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  }

  function handleRetry() {
    setRecognizedText(null);
    setMatch(null);
    listenOnce((transcript) => {
      setRecognizedText(transcript);
      setMatch(matchRecognizedText(targetText, transcript));
    });
  }

  function handleClose() {
    setExpanded(false);
    setRecognizedText(null);
    setMatch(null);
    onClose?.();
  }

  if (!supported) return null;

  if (!expanded) {
    return (
      <Button
        onClick={() => setExpanded(true)}
        variant={prominence === "auto" ? "primary" : "secondary"}
        size="sm"
      >
        🎙️ M'entraîner à prononcer cette phrase
      </Button>
    );
  }

  const showMicError = error === "not-allowed" || error === "unsupported";

  return (
    <div className="bg-slate-900 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2">
        <p className="text-sm text-slate-300">
          Texte à répéter : <span className="italic">« {targetText} »</span>
        </p>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer l'entraînement de prononciation"
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleListenToTarget}
          disabled={speaking}
          variant="secondary"
          size="sm"
          aria-label="Écouter la phrase à répéter"
        >
          {speaking ? "🔊 Lecture..." : "🔊 Écouter"}
        </Button>
        <Button
          onClick={handleRetry}
          disabled={listening}
          variant="primary"
          size="sm"
          aria-label="Réessayer - le micro va s'activer"
        >
          {listening ? "🎙️ Écoute..." : "🎙️ Réessayer"}
        </Button>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-slate-400 min-h-[1.25rem]">
        {listening && "Je t'écoute..."}
      </p>

      {showMicError && <ErrorBanner message={errorMessage ?? ""} />}

      {!showMicError && error === "no-speech" && (
        <p className="text-sm text-slate-300">🔴 Essaie encore — je n'ai rien entendu.</p>
      )}

      {recognizedText && match && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-300">
            J'ai entendu :<br />« {recognizedText} »
          </p>
          <p className="text-sm font-semibold">
            {MATCH_FEEDBACK[match].icon} {MATCH_FEEDBACK[match].label}
          </p>
        </div>
      )}
    </div>
  );
}
