import { useState } from "react";
import { api } from "../api/client";
import type { CecrlProfile } from "../types";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/ErrorBanner";

type HintTier = { tier: number; content: string };

type Props = {
  profile: CecrlProfile;
  translateEndpoint: string;
  hintEndpoint: string;
  /** The AI's last question, or null before there is anything to translate/get unstuck on. */
  textToTranslate: string | null;
  /** Extra fields merged into the hint request body - the daily challenge is stateless server-side, so it needs the conversation `history` sent along; a scenario session doesn't (SessionController already has it). */
  hintBody?: Record<string, unknown>;
};

const MAX_HINT_TIER = 3;

const HINT_TIER_LABEL: Record<number, string> = {
  1: "💡 Mots-clés",
  2: "✏️ Amorce de phrase",
  3: "📝 Exemple complet",
};

/**
 * Groups the CECRL-driven learning aids (translation, progressive hints) in
 * one place instead of several panels open at once, per the V1 spec's UX
 * rule (§23): avoid showing transcription/translation/keywords/example
 * simultaneously. Every aid stays reachable regardless of level (RF-03) - a
 * learner's CecrlProfile only changes how prominent a button looks by
 * default, never whether it's there.
 */
export function HelpPanel({ profile, translateEndpoint, hintEndpoint, textToTranslate, hintBody }: Props) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);

  const [hints, setHints] = useState<HintTier[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState(false);

  async function handleTranslate() {
    if (!textToTranslate) return;
    setTranslating(true);
    setTranslateError(false);
    try {
      const response = await api.post<{ translation: string }>(translateEndpoint, { text: textToTranslate });
      setTranslation(response.data.translation);
    } catch {
      setTranslateError(true);
    } finally {
      setTranslating(false);
    }
  }

  async function handleNextHint() {
    const nextTier = hints.length + 1;
    if (nextTier > MAX_HINT_TIER) return;
    setHintLoading(true);
    setHintError(false);
    try {
      const response = await api.post<{ tier: number; content: string }>(hintEndpoint, {
        tier: nextTier,
        ...hintBody,
      });
      setHints((current) => [...current, { tier: response.data.tier, content: response.data.content }]);
    } catch {
      setHintError(true);
    } finally {
      setHintLoading(false);
    }
  }

  const hintButtonLabel = hintLoading
    ? "Aide..."
    : hints.length === 0
      ? "Je suis bloqué ?"
      : hints.length < MAX_HINT_TIER
        ? "Encore un peu d'aide"
        : "Aide maximale atteinte";

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex gap-3 flex-wrap">
        {textToTranslate && (
          <Button
            onClick={handleTranslate}
            disabled={translating}
            variant={profile.translationMode === "visible" ? "primary" : "secondary"}
            size="sm"
          >
            {translating ? "Traduction..." : "Traduire"}
          </Button>
        )}
        <Button
          onClick={handleNextHint}
          disabled={hintLoading || hints.length >= MAX_HINT_TIER}
          variant={profile.keywordHelpEnabled ? "primary" : "secondary"}
          size="sm"
        >
          {hintButtonLabel}
        </Button>
      </div>

      {translation && (
        <p className="text-sm text-slate-300 bg-slate-900 rounded-lg px-4 py-2">🇫🇷 {translation}</p>
      )}
      {translateError && <ErrorBanner message="Traduction indisponible. Réessaie." onRetry={handleTranslate} />}

      {hints.length > 0 && (
        <div className="flex flex-col gap-2">
          {hints.map((hint) => (
            <p key={hint.tier} className="text-sm text-slate-300 bg-slate-900 rounded-lg px-4 py-2">
              <span className="text-slate-500">{HINT_TIER_LABEL[hint.tier] ?? "Aide"} : </span>
              {hint.content}
            </p>
          ))}
        </div>
      )}
      {hintError && <ErrorBanner message="Aide indisponible. Réessaie." onRetry={handleNextHint} />}
    </div>
  );
}
