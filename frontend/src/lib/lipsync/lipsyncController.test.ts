import { describe, expect, it } from "vitest";
import { LipsyncController } from "./lipsyncController";

describe("LipsyncController", () => {
  it("returns REST before start() has ever been called", () => {
    const controller = new LipsyncController();
    expect(controller.update(16)).toBe("REST");
  });

  it("walks the real viseme sequence forward over time when no boundary event arrives", () => {
    // "th a" -> TH(0-2), REST(2-3), AA(3-4); at 70ms/char fallback pace
    // that's roughly 140ms, 70ms, 70ms per token.
    const controller = new LipsyncController();
    controller.start("th a");

    expect(controller.update(0)).toBe("TH");
    // Still within the "th" token's estimated window.
    expect(controller.update(100)).toBe("TH");
    // Past "th" (140ms) and past the space (210ms) - now on "a".
    expect(controller.update(150)).toBe("AA");
  });

  it("uses a fresh boundary event instead of the time-based estimate", () => {
    const controller = new LipsyncController();
    controller.start("th a"); // TH(0-2), REST(2-3), AA(3-4)

    controller.reportBoundary(3); // browser says "we're at the 'a'"
    expect(controller.update(16)).toBe("AA");
  });

  it("keeps walking forward from a boundary anchor instead of freezing on it", () => {
    // Regression: a browser that only reports boundary once per WORD (not
    // per character) used to pin the mouth on that word's first letter -
    // often a closed-mouth consonant - for the word's whole duration,
    // looking stuck instead of cycling through the rest of the word.
    const controller = new LipsyncController();
    controller.start("hello world"); // h(REST) e(IH) l(L) l(L) o(OH) ' '(REST) w(REST) o(OH) r(R) l(L) d(REST)
    controller.reportBoundary(0); // browser says "we're at the start of 'hello'"

    // 300ms later, still well inside "hello" and before any second
    // boundary event - should have progressed well past the first letter.
    expect(controller.update(300)).toBe("OH");
  });

  it("falls back to the time-based estimate once a boundary goes stale", () => {
    const controller = new LipsyncController();
    controller.start("th a");

    controller.reportBoundary(0); // pins it on "TH"
    expect(controller.update(16)).toBe("TH");

    // No further boundary events for a while - after 400ms it should stop
    // trusting the stale position and resume the time-based walk, which by
    // then (well past 210ms total) has reached "a".
    expect(controller.update(500)).toBe("AA");
  });

  it("returns REST again after stop()", () => {
    const controller = new LipsyncController();
    controller.start("th a");
    controller.update(16);

    controller.stop();

    expect(controller.update(16)).toBe("REST");
  });

  it("holds each viseme for at least the minimum duration before switching to a different one", () => {
    // Regression: the underlying text position moves roughly one character
    // every ~70ms, faster than a mouth shape reads as distinct - without a
    // minimum hold, the displayed viseme flickered through several shapes
    // in quick succession instead of looking like fluid speech.
    const controller = new LipsyncController();
    controller.start("a b"); // AA(0-1) REST(1-2) MBP(2-3)

    expect(controller.update(0)).toBe("AA");
    expect(controller.update(50)).toBe("AA");
    // The underlying position has now moved into the space (REST) at
    // ~80ms since AA first appeared - under the 120ms minimum hold, so AA
    // must stay displayed a little longer instead of flickering to REST.
    expect(controller.update(30)).toBe("AA");
    // Now past the hold - the switch to REST is allowed through.
    expect(controller.update(45)).toBe("REST");
  });

  it("never returns a stale token past the end of a short utterance", () => {
    const controller = new LipsyncController();
    controller.start("a");

    // Fast-forward well past the estimated duration of a 1-character word.
    const result = controller.update(10_000);
    expect(["AA"]).toContain(result);
  });
});
