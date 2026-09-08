export type VisemeType = "REST" | "MBP" | "FV" | "TH" | "AA" | "EE" | "IH" | "OH" | "OU" | "CH_SH_J" | "L" | "R";

// The ARKit mouth/jaw morph targets this lip-sync system drives - confirmed
// present and identical (same names, same indices) on both the Male and
// Female GLB models (see the facial morph target audit). Lip-sync never
// touches anything outside this set: no eyes, brows, or emotional smile.
export type VisemeMorphTarget =
  | "jawOpen"
  | "mouthClose"
  | "mouthPressLeft"
  | "mouthPressRight"
  | "mouthLowerDownLeft"
  | "mouthLowerDownRight"
  | "mouthRollLower"
  | "mouthUpperUpLeft"
  | "mouthUpperUpRight"
  | "mouthFunnel"
  | "mouthSmileLeft"
  | "mouthSmileRight"
  | "mouthStretchLeft"
  | "mouthStretchRight"
  | "mouthPucker";

type VisemeWeights = Partial<Record<VisemeMorphTarget, number>>;

// Approximate English viseme groups -> ARKit morph target weights. Not
// phonetically precise (see textToVisemes.ts for the grapheme rules that
// pick a group per character, and the facial morph target audit for why:
// no tongue morph target on either model, so true phonetic precision
// wouldn't even be visible). REST has no weights - every morph target
// implicitly relaxes to 0, same as any group that doesn't mention it.
export const VISEME_WEIGHTS: Record<VisemeType, VisemeWeights> = {
  REST: {},
  MBP: { mouthClose: 0.7, mouthPressLeft: 0.3, mouthPressRight: 0.3, jawOpen: 0 },
  FV: { mouthLowerDownLeft: 0.4, mouthLowerDownRight: 0.4, mouthRollLower: 0.2, jawOpen: 0.1 },
  TH: { jawOpen: 0.15, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1 },
  AA: { jawOpen: 0.65, mouthFunnel: 0.1 },
  EE: { mouthSmileLeft: 0.4, mouthSmileRight: 0.4, mouthStretchLeft: 0.2, mouthStretchRight: 0.2, jawOpen: 0.15 },
  IH: { mouthSmileLeft: 0.15, mouthSmileRight: 0.15, jawOpen: 0.25 },
  OH: { mouthFunnel: 0.5, mouthPucker: 0.2, jawOpen: 0.3 },
  OU: { mouthPucker: 0.6, mouthFunnel: 0.2, jawOpen: 0.1 },
  CH_SH_J: { mouthFunnel: 0.3, mouthPucker: 0.2, jawOpen: 0.1 },
  L: { jawOpen: 0.25, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1 },
  R: { mouthFunnel: 0.25, mouthPucker: 0.15, jawOpen: 0.2 },
};

// Every morph target any viseme actually uses, precomputed once here rather
// than re-derived at runtime - AvatarScene searches the loaded model for
// exactly these names when it mounts, not the other way around.
export const ALL_VISEME_MORPH_TARGETS: VisemeMorphTarget[] = Array.from(
  new Set(Object.values(VISEME_WEIGHTS).flatMap((weights) => Object.keys(weights) as VisemeMorphTarget[])),
);
