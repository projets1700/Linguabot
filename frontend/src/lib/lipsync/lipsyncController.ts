import { textToVisemeSequence, type VisemeToken } from "./textToVisemes";
import type { VisemeType } from "./visemeTypes";

// Rough average English speaking pace (~150 words/min, ~5.7 chars/word
// including the trailing space) used only as a fallback when
// SpeechSynthesisUtterance's "boundary" event isn't firing - not meant to
// be precise, just enough to walk the real viseme sequence over roughly
// the right duration instead of a fixed/generic loop.
const FALLBACK_MS_PER_CHAR = 70;

// If a boundary event hasn't landed in this long, treat it as not
// currently reporting (some browsers/voices fire it for the first few
// words then stop) and fall back to the time-based estimate instead of
// freezing the mouth on a stale position.
const BOUNDARY_STALE_MS = 400;

// The underlying text position advances roughly one character every
// ~70ms, which is faster than a mouth shape can visually register as
// distinct - without this, the displayed viseme would change almost every
// frame, and the smoothing in AvatarScene never gets time to catch up
// before the target moves again, reading as jittery rather than fluid.
// Holding each shown viseme for at least this long (before allowing the
// next different one through) gives the interpolation room to settle.
const MIN_VISEME_HOLD_MS = 120;

/**
 * Owns the "where are we in the utterance" state for one speech turn: the
 * viseme sequence derived from the text, and whichever of two ways of
 * tracking playback position is currently available - real `boundary`
 * events when the browser fires them reliably, or a plain elapsed-time
 * estimate otherwise. AvatarScene calls `update()` once per frame and
 * only cares about the VisemeType it gets back.
 */
export class LipsyncController {
  private tokens: VisemeToken[] = [];
  private textLength = 1;
  private elapsedMs = 0;
  private estimatedDurationMs = 0;
  // The last boundary event's position, re-anchored every time one
  // arrives: instead of freezing there until the next one (which, when a
  // browser only reports boundaries per word rather than per character,
  // pins the mouth on that word's first letter - often a closed-mouth
  // consonant - for the word's whole duration), playback keeps walking
  // forward from it at the estimated pace, same as the no-boundary
  // fallback, so it still cycles through the rest of that word's letters.
  private anchorCharIndex = 0;
  private anchorElapsedMs = 0;
  private hasBoundaryAnchor = false;
  private msSinceBoundary = 0;
  private cursor = 0;
  private displayedViseme: VisemeType = "REST";
  private msSinceVisemeChange = 0;

  start(text: string, rate = 1): void {
    this.tokens = textToVisemeSequence(text);
    this.textLength = Math.max(text.length, 1);
    this.elapsedMs = 0;
    this.estimatedDurationMs = (this.textLength * FALLBACK_MS_PER_CHAR) / Math.max(rate, 0.1);
    this.anchorCharIndex = 0;
    this.anchorElapsedMs = 0;
    this.hasBoundaryAnchor = false;
    this.msSinceBoundary = 0;
    this.cursor = 0;
    this.displayedViseme = "REST";
    // Starts already "held long enough" so the very first real viseme of
    // the utterance can appear immediately instead of waiting out the
    // minimum hold - that gate is for smoothing transitions mid-speech,
    // not for delaying speech onset.
    this.msSinceVisemeChange = MIN_VISEME_HOLD_MS;
  }

  stop(): void {
    this.tokens = [];
    this.hasBoundaryAnchor = false;
    this.cursor = 0;
    this.displayedViseme = "REST";
    this.msSinceVisemeChange = MIN_VISEME_HOLD_MS;
  }

  /** Wire this to SpeechSynthesisUtterance's onboundary event, when present. */
  reportBoundary(charIndex: number): void {
    this.anchorCharIndex = charIndex;
    this.anchorElapsedMs = this.elapsedMs;
    this.hasBoundaryAnchor = true;
    this.msSinceBoundary = 0;
  }

  /** Call once per frame while state === "speaking"; returns the viseme to show right now. */
  update(deltaMs: number): VisemeType {
    if (this.tokens.length === 0) return "REST";

    this.elapsedMs += deltaMs;
    this.msSinceBoundary += deltaMs;

    const charsPerMs = this.textLength / this.estimatedDurationMs;
    const boundaryIsFresh = this.hasBoundaryAnchor && this.msSinceBoundary < BOUNDARY_STALE_MS;
    const position = boundaryIsFresh
      ? Math.min(this.anchorCharIndex + (this.elapsedMs - this.anchorElapsedMs) * charsPerMs, this.textLength)
      : Math.min(this.elapsedMs * charsPerMs, this.textLength);

    // Playback position only moves forward during normal speech, so the
    // cursor just advances - no need to re-scan the whole sequence every
    // frame. Rewound back to the start if position ever goes backwards
    // (an out-of-order boundary event, or a fresh start() mid-frame),
    // since a forward-only cursor would otherwise get stuck past it.
    if (position < this.tokens[this.cursor].charIndex) {
      this.cursor = 0;
    }
    while (
      this.cursor < this.tokens.length - 1 &&
      position >= this.tokens[this.cursor].charIndex + this.tokens[this.cursor].charLength
    ) {
      this.cursor += 1;
    }

    this.msSinceVisemeChange += deltaMs;
    const candidateViseme = this.tokens[this.cursor].viseme;
    if (candidateViseme !== this.displayedViseme && this.msSinceVisemeChange >= MIN_VISEME_HOLD_MS) {
      this.displayedViseme = candidateViseme;
      this.msSinceVisemeChange = 0;
    }

    return this.displayedViseme;
  }
}
