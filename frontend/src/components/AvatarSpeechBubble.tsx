import { useEffect, useRef, useState, type MutableRefObject } from "react";

type Props = {
  /** The avatar's current line - never the learner's own transcript (see SessionPage: this only ever receives useConversationSession's `speechText`). */
  text: string | null;
  /** True while the avatar is actually speaking this line (AvatarState === "speaking"). */
  active: boolean;
  /**
   * The same ref AvatarScene's lip-sync already reads, updated by
   * SpeechSynthesisUtterance's `boundary` event (see speech.ts). Optional:
   * omitting it (or a browser/voice that never fires `boundary` for this
   * utterance - see the reliability note below) just shows the full line
   * immediately, same as before this existed.
   */
  charIndexRef?: MutableRefObject<number | null>;
};

// How long the last line stays visible after speech ends before fading out -
// long enough to re-read a line that just finished playing, short enough to
// never look like it's still "being said" once the learner starts their own
// turn. Not a per-character sync timer (see the module doc below) - just a
// single show/hide transition.
const LINGER_MS = 2500;

// If no `boundary` event has updated charIndexRef within this long after
// speech starts, this browser/voice isn't reporting them for this utterance
// at all (see lipsyncController.ts's own BOUNDARY_STALE_MS for the same
// underlying reliability issue) - stop waiting and reveal the whole line,
// rather than leaving the bubble blank for the entire utterance. Short
// enough that a supported browser's very first word (which fires near-
// instantly after onstart) is never mistaken for "unsupported".
const NO_BOUNDARY_FALLBACK_MS = 500;

// How often the reveal loop checks charIndexRef - frequent enough to look
// smooth for text (unlike lip-sync, this doesn't need to be tied to the
// render frame rate), and a plain interval keeps this independently
// testable with fake timers instead of depending on requestAnimationFrame.
const REVEAL_POLL_MS = 50;

/**
 * Overlaid on top of AvatarScene's canvas (positioned by the parent, not
 * rendered inside the Three.js scene - see the header comment in
 * SessionPage.tsx) to make the avatar's spoken line read as speech coming
 * from it, the way a comic/chat speech bubble does.
 *
 * Reveals the line progressively as it's actually spoken, via the same
 * `charIndexRef` AvatarScene's lip-sync already reads (SpeechSynthesisUtterance's
 * `boundary` event, see speech.ts) - not a separate/fake timer. That event
 * is already documented elsewhere in this codebase (speech.ts,
 * lipsyncController.ts) as unreliable on some browsers/voices (may fire per
 * word instead of per character, or never fire at all for a given
 * utterance); if it hasn't reported anything within NO_BOUNDARY_FALLBACK_MS
 * of speech starting, the line is revealed in full instead of staying
 * blank for the rest of the utterance.
 */
export function AvatarSpeechBubble({ text, active, charIndexRef }: Props) {
  const [visible, setVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState<string | null>(null);
  const [revealedLength, setRevealedLength] = useState(0);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearPendingHide() {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    if (active && text) {
      clearPendingHide();
      // A prop change is exactly the "event that caused the change" here -
      // this effect exists specifically to synchronize with the timer
      // below (an external system, per the rule's own guidance), and the
      // immediate-show branch has to update the same state for the same
      // reason the delayed-hide branch does.
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplayedText(text);
      setVisible(true);
      setRevealedLength(0);
    } else {
      // Speaking just stopped (or never started) - snap straight to the
      // full line (a lingering bubble frozen mid-word would look broken),
      // then linger briefly before hiding. `text` itself is normally null
      // by now (useConversationSession clears it in the same onEnd that
      // flips `active` false), so this can't reveal-to "the new text's
      // length" - Infinity is a safe stand-in for "all of it", since
      // String.slice clamps an out-of-range end index rather than erroring.
      // A fresh line arriving during the linger window is handled by the
      // branch above, which cancels this timer before it fires.
      clearPendingHide();
      setRevealedLength(Number.POSITIVE_INFINITY);
      hideTimerRef.current = window.setTimeout(() => setVisible(false), LINGER_MS);
    }

    return clearPendingHide;
  }, [active, text]);

  // Progressive reveal loop: polls the shared charIndexRef while actively
  // speaking. If no boundary ever arrives within NO_BOUNDARY_FALLBACK_MS,
  // gives up waiting and reveals everything instead of staying blank.
  useEffect(() => {
    if (!active || !charIndexRef || !text) return;

    const startedAt = Date.now();
    let sawBoundary = false;

    const intervalId = window.setInterval(() => {
      const charIndex = charIndexRef?.current;
      if (charIndex != null) {
        sawBoundary = true;
        setRevealedLength((current) => (charIndex > current ? charIndex : current));
      } else if (!sawBoundary && Date.now() - startedAt > NO_BOUNDARY_FALLBACK_MS) {
        setRevealedLength(text?.length ?? 0);
      }
    }, REVEAL_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [active, charIndexRef, text]);

  if (!visible || !displayedText) return null;

  const shownText = charIndexRef ? displayedText.slice(0, revealedLength) : displayedText;

  return (
    <div
      role="status"
      aria-live="polite"
      // Floats entirely above the avatar box (bottom-full = its own bottom
      // edge sits at the container's top edge) rather than overlapping the
      // top of it - the earlier top-3 placement sat right over the
      // avatar's head/face.
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 max-w-[85%] sm:max-w-[75%]"
    >
      <div className="bg-slate-800/95 backdrop-blur rounded-2xl px-4 py-3 shadow-lg max-h-32 overflow-y-auto">
        <p className="text-white text-sm leading-snug">{shownText}</p>
      </div>
      <div className="w-4 h-4 bg-slate-800/95 rotate-45 mx-auto -mt-2" aria-hidden="true" />
    </div>
  );
}
