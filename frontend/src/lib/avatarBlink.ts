// Audit P2-02 (cautious AvatarScene extraction): pure timing/easing math for
// the automatic idle-blink animation, with no dependency on Three.js/React -
// extracted as-is (same values, same logic), never touching the camera/
// lip-sync/model code that's already caused repeated visual regressions
// this session. Entirely independent of lip-sync: it only ever drives
// eyeBlinkLeft/eyeBlinkRight, lip-sync only ever drives its own mouth/jaw
// targets - no overlap, so both can run in the same frame loop.

const BLINK_MIN_INTERVAL_MS = 3000;
const BLINK_MAX_INTERVAL_MS = 6000;
// Closing is quicker than opening - a real blink snaps shut and eases open.
const BLINK_CLOSE_MS = 70;
const BLINK_OPEN_MS = 110;
// Occasionally chain a quick second blink after the first, like a real
// person - never on the follow-up blink itself, so it's at most a pair.
const DOUBLE_BLINK_PROBABILITY = 0.15;
const DOUBLE_BLINK_MIN_GAP_MS = 100;
const DOUBLE_BLINK_MAX_GAP_MS = 250;

export type BlinkState = {
  phase: "waiting" | "closing" | "opening";
  phaseElapsedMs: number;
  waitMs: number;
  value: number;
  isFollowUpBlink: boolean;
};

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomBlinkInterval(): number {
  return randomBetween(BLINK_MIN_INTERVAL_MS, BLINK_MAX_INTERVAL_MS);
}

export function createBlinkState(): BlinkState {
  return { phase: "waiting", phaseElapsedMs: 0, waitMs: randomBlinkInterval(), value: 0, isFollowUpBlink: false };
}

// Smoothstep instead of a linear ramp - avoids the eyelid snapping open
// instantly at the end of each phase, still cheap (no trig).
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Advances one blink cycle by `deltaMs` and returns the eyelid closure for this frame (0 = open, 1 = closed). */
export function updateBlink(deltaMs: number, blink: BlinkState): number {
  if (blink.phase === "waiting") {
    blink.waitMs -= deltaMs;
    if (blink.waitMs <= 0) {
      blink.phase = "closing";
      blink.phaseElapsedMs = 0;
    }
    return blink.value;
  }

  blink.phaseElapsedMs += deltaMs;

  if (blink.phase === "closing") {
    const t = Math.min(blink.phaseElapsedMs / BLINK_CLOSE_MS, 1);
    blink.value = smoothstep(t);
    if (t >= 1) {
      blink.phase = "opening";
      blink.phaseElapsedMs = 0;
    }
    return blink.value;
  }

  // opening
  const t = Math.min(blink.phaseElapsedMs / BLINK_OPEN_MS, 1);
  blink.value = 1 - smoothstep(t);
  if (t >= 1) {
    blink.value = 0;
    blink.phase = "waiting";
    if (blink.isFollowUpBlink) {
      blink.isFollowUpBlink = false;
      blink.waitMs = randomBlinkInterval();
    } else if (Math.random() < DOUBLE_BLINK_PROBABILITY) {
      blink.isFollowUpBlink = true;
      blink.waitMs = randomBetween(DOUBLE_BLINK_MIN_GAP_MS, DOUBLE_BLINK_MAX_GAP_MS);
    } else {
      blink.waitMs = randomBlinkInterval();
    }
  }
  return blink.value;
}
