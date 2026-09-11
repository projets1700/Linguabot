import { useState } from "react";
import type { EarnedBadge, EarnedTrophy, LevelUpResult } from "../types";

const RARITY_STYLE: Record<EarnedTrophy["rarity"], string> = {
  bronze: "bg-amber-800",
  silver: "bg-slate-400",
  gold: "bg-yellow-500",
  platinum: "bg-cyan-400",
};

/**
 * The one reward-notification mechanism for the app (V1.1 LOT 6) - every
 * page with something to celebrate (Session/Quiz/Défi finish) feeds it the
 * same badges/trophies/levelUp shapes instead of rolling its own banner.
 */
export function RewardBanner({
  badges,
  trophies,
  levelUp,
}: {
  badges: EarnedBadge[];
  trophies: EarnedTrophy[];
  levelUp?: LevelUpResult | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  const hasContent = badges.length > 0 || trophies.length > 0 || !!levelUp;

  if (!hasContent || dismissed) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="relative flex flex-col gap-2 mb-4 pr-7">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        className="absolute top-0 right-0 text-white/60 hover:text-white text-lg leading-none px-1"
      >
        ×
      </button>
      {levelUp && (
        <div className="bg-green-600 rounded-lg py-3 px-4 font-bold animate-pulse motion-reduce:animate-none">
          🎉 Niveau {levelUp.code} débloqué : {levelUp.name} !
        </div>
      )}
      {trophies.map((trophy) => (
        <div
          key={trophy.code}
          className={`${RARITY_STYLE[trophy.rarity]} text-slate-950 rounded-lg py-3 px-4 font-bold animate-pulse motion-reduce:animate-none`}
        >
          🏆 Trophée débloqué : {trophy.name} !
        </div>
      ))}
      {badges.map((badge) => (
        <div
          key={badge.code}
          className="bg-blue-600 rounded-lg py-2 px-4 font-semibold"
        >
          {badge.icon} Badge débloqué : {badge.name} !
        </div>
      ))}
    </div>
  );
}
