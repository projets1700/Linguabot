import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakText } from "./speech";

describe("speakText", () => {
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speak = vi.fn();
    cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak, cancel },
    });

    // jsdom doesn't implement the Web Speech API at all (no stub, not even
    // an "unimplemented" warning) - SpeechSynthesisUtterance simply doesn't
    // exist as a global, so it needs a minimal fake for these tests to run.
    class FakeSpeechSynthesisUtterance {
      text: string;
      lang = "";
      onstart: ((ev: Event) => void) | null = null;
      onend: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);
  });

  afterEach(() => {
    // @ts-expect-error test-only cleanup of a property we defined above
    delete window.speechSynthesis;
    vi.unstubAllGlobals();
  });

  it("cancels any in-flight utterance before speaking a new one", () => {
    speakText("Hello there");

    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("defaults the utterance language to en-US", () => {
    speakText("Hello there");

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe("Hello there");
    expect(utterance.lang).toBe("en-US");
  });

  it("honours an explicit lang override", () => {
    speakText("Bonjour", { lang: "fr-FR" });

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.lang).toBe("fr-FR");
  });

  it("calls onStart/onEnd through the utterance's own event handlers", () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    speakText("Hello there", { onStart, onEnd });

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onstart?.(new Event("start") as never);
    utterance.onend?.(new Event("end") as never);

    expect(onStart).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });

  it("calls onEnd immediately when speechSynthesis is unavailable", () => {
    // @ts-expect-error simulating an unsupported browser
    delete window.speechSynthesis;
    const onEnd = vi.fn();

    speakText("Hello there", { onEnd });

    expect(onEnd).toHaveBeenCalled();
  });
});
