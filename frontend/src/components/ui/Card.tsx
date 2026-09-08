import type { ReactNode } from "react";

export type CardVariant = "panel" | "stat";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  // The centered result/reward panel look (session/quiz/challenge end screens).
  panel: "bg-slate-900 p-8 rounded-xl",
  // The compact dashboard stat-tile look.
  stat: "bg-slate-800 p-6 rounded-xl",
};

export function Card({
  variant = "panel",
  className = "",
  children,
}: {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}) {
  return <div className={[VARIANT_CLASSES[variant], className].filter(Boolean).join(" ")}>{children}</div>;
}
