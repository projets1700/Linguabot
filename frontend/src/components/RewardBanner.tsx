import type { EarnedBadge, EarnedTrophy } from "../types";

const RARITY_STYLE: Record<EarnedTrophy["rarity"], string> = {
  bronze: "bg-amber-800",
  silver: "bg-slate-400",
  gold: "bg-yellow-500",
  platinum: "bg-cyan-400",
};

export function RewardBanner({
  badges,
  trophies,
}: {
  badges: EarnedBadge[];
  trophies: EarnedTrophy[];
}) {
  if (badges.length === 0 && trophies.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      {trophies.map((trophy) => (
        <div
          key={trophy.code}
          className={`${RARITY_STYLE[trophy.rarity]} text-slate-950 rounded-lg py-3 px-4 font-bold animate-pulse`}
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
