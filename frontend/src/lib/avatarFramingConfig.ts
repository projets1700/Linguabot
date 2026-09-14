import type { AvatarType } from "../types";

// Audit P2-02 (cautious AvatarScene extraction): the per-framing NUMBERS
// only, moved as-is out of AvatarScene.tsx into one typed lookup - the
// camera/lip-sync/positioning LOGIC that reads them (CameraSync,
// AvatarModel) is deliberately left untouched in AvatarScene.tsx, since
// that's the part that's already caused repeated visual regressions this
// session (see the DASHBOARD_PORTRAIT_TARGET_Y comment below for the
// specific bug this file's values were hard-won from).

// "bust": tight headshot, unchanged default used by every existing caller.
// "portrait": head-to-mid-thigh crop for the Dashboard intro's "professeur
// face à l'élève" composition - deliberately not "full" (feet visible),
// which left a lot of empty space above/below the model in frame.
// "dashboardPortrait": head-to-upper-torso only (no hips/legs at all) for
// the Dashboard's own small square-ish avatar card - "bust" alone left a
// sliver of hip/pants visible at the card's bottom edge, which reads as
// "mostly legs" in a card this short; kept as its own preset rather than
// tightening "bust" itself, since "bust" is shared with Session/Quiz/
// DailyChallenge/Placement and must stay exactly as it is for them.
export type AvatarFraming = "bust" | "portrait" | "dashboardPortrait" | "placementTestPortrait";

export type FramingCameraConfig = { position: readonly [number, number, number]; fov: number };

// "portrait": pulled back just enough that the chest-centered window
// (height*0.71, see FRAMING_MODEL_OFFSET_RATIO below) - head+shoulders+
// torso to roughly mid-thigh - fills most of the frame's vertical extent,
// computed from the pinhole-camera relation distance = halfFrameHeight /
// tan(fov/2) for a ~1.75m model. Same fov as "bust" on purpose, so only
// distance/vertical-centering changes between the two presets. z=2.4 (down
// from an earlier 2.8) is a ~15-17% closer framing per a finishing pass on
// the Dashboard intro.
// "dashboardPortrait": pulled in much closer (z=1.15) than "bust" (z=1.5).
// Its camera position/lookAt Y are NOT [0,0,z] like the other two -
// AvatarScene's CameraSync overrides both to the model's own computed
// face/chest height (DASHBOARD_PORTRAIT_TARGET_Y below), since this preset
// leaves the model itself unshifted. Only this object's distance (z) is
// actually used for it.
export const FRAMING_CAMERA: Record<AvatarFraming, FramingCameraConfig> = {
  bust: { position: [0, 0, 1.5], fov: 32 },
  portrait: { position: [0, 0, 2.4], fov: 32 },
  dashboardPortrait: { position: [0, 0, 1.15], fov: 32 },
  placementTestPortrait: { position: [0, 0, 1.7], fov: 20 },
};

// How much of the model's own height (from its bind-pose Box3) to shift it
// down by, so the intended body part lands at the world-origin the camera
// looks at - "bust" centers the jaw/neck, "portrait"/"placementTestPortrait"
// center further down the torso. "dashboardPortrait" is deliberately absent
// here: it doesn't shift the model at all (see DASHBOARD_PORTRAIT_TARGET_Y).
export const FRAMING_MODEL_OFFSET_RATIO: Partial<Record<AvatarFraming, number>> = {
  bust: 0.8,
  portrait: 0.71,
  placementTestPortrait: 0.89,
};

// dashboardPortrait's target Y, per avatar - measured directly from each
// model's own Box3 on a real, working session (male: box.max.y=1.8249,
// female: box.max.y=1.7557, both box.min.y≈0, target = height×0.885), NOT
// a guess. This used to be recomputed live via Box3().setFromObject() on
// every frame, which turned out to be unreliable: on at least one real
// device, that same computation deterministically returned a ~5× smaller
// height (target≈0.32 instead of ≈1.6) for the identical GLB/code/server,
// stable across a full browser restart AND a fresh private window (so not
// caching, not a loading race - a genuine cross-environment difference in
// how that browser/GPU's Three.js build resolves a SkinnedMesh's bounding
// box). A fixed, pre-measured value per avatar sidesteps that inconsistency
// entirely. "bust"/"portrait"/"placementTestPortrait" don't use this - they
// keep FRAMING_MODEL_OFFSET_RATIO's model-shift mechanism instead.
export const DASHBOARD_PORTRAIT_TARGET_Y: Record<AvatarType, number> = {
  male: 1.615,
  female: 1.554,
};
