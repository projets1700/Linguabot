import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { DailyChallenge } from "../../types";

type Props = {
  /** Arrives (if at all) well after this card first renders - see DashboardPage's deferred fetch effect. */
  preview: DailyChallenge | null;
  /** Flips true one frame after `preview` first arrives - purely cosmetic (drives the fade-in below), never gates anything else. */
  fadedIn: boolean;
};

/**
 * Audit P2-01 (cautious DashboardPage extraction): purely presentational -
 * the fetch/fallback/fade-in logic stays in DashboardPage, which owns the
 * state this reads.
 */
export function DailyChallengePreviewCard({ preview, fadedIn }: Props) {
  return (
    <Card variant="stat" className="border border-amber-500/25 flex flex-col justify-center">
      <p className="text-amber-400 text-xs font-bold uppercase mb-2">🔥 Défi du jour</p>
      {/* Until/unless `preview` arrives, the generic fallback text keeps the
          card from ever looking broken or empty - never a blocking spinner.
          The opacity transition only ever plays once, when real content
          first replaces the fallback. */}
      <div className={`transition-opacity duration-300 ${preview && fadedIn ? "opacity-100" : preview ? "opacity-0" : ""}`}>
        {preview ? (
          <>
            <p className="text-lg font-bold text-white mb-1">{preview.title}</p>
            <p className="text-slate-400 text-sm mb-4">+{preview.xpReward} XP à gagner</p>
          </>
        ) : (
          <p className="text-slate-400 text-sm mb-4">Un nouveau défi t'attend chaque jour.</p>
        )}
      </div>
      <Button to="/defi-du-jour" variant="secondary" className="self-start">
        {preview?.completed ? "Revoir le défi du jour →" : preview?.started ? "Continuer le défi →" : "Commencer →"}
      </Button>
    </Card>
  );
}
