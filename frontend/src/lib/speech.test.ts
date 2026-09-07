import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakText } from "./speech";
import { useAuthStore } from "../stores/authStore";
import { useVoiceSettingsStore } from "../stores/voiceSettingsStore";
import type { Me } from "../types";

function fakeVoice(voiceURI: string, lang = "en-US"): SpeechSynthesisVoice {
  return { name: voiceURI, lang, voiceURI, default: false, localService: true } as SpeechSynthesisVoice;
}

describe("speakText", () => {
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;
  let getVoices: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speak = vi.fn();
    cancel = vi.fn();
    getVoices = vi.fn().mockReturnValue([]);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak, cancel, getVoices },
    });
    localStorage.clear();
    useVoiceSettingsStore.setState({ selectedVoiceURI: null });
    useAuthStore.setState({ user: null });

    // jsdom doesn't implement the Web Speech API at all (no stub, not even
    // an "unimplemented" warning) - SpeechSynthesisUtterance simply doesn't
    // exist as a global, so it needs a minimal fake for these tests to run.
    class FakeSpeechSynthesisUtterance {
      text: string;
      lang = "";
      voice: SpeechSynthesisVoice | null = null;
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

  it("applies the learner's saved voice preference to English speech", () => {
    const preferred = fakeVoice("Microsoft Zira Desktop");
    getVoices.mockReturnValue([fakeVoice("Microsoft David Desktop"), preferred]);
    useVoiceSettingsStore.getState().setSelectedVoiceURI("Microsoft Zira Desktop");

    speakText("Hello there");

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(preferred);
  });

  it("never applies the saved English voice preference to French speech (A0 quiz)", () => {
    getVoices.mockReturnValue([fakeVoice("Microsoft Zira Desktop")]);
    useVoiceSettingsStore.getState().setSelectedVoiceURI("Microsoft Zira Desktop");

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBeNull();
  });

  it("auto-picks a French voice matching the avatar's gender for the A0 quiz", () => {
    // Regression: a male avatar was still getting a female voice on the A0
    // quiz, because French speech never applied any gender preference at
    // all - it just fell through to the browser's own French default.
    const frenchMale = fakeVoice("Microsoft Henri Online (Natural)", "fr-FR");
    const frenchFemale = fakeVoice("Microsoft Denise Online (Natural)", "fr-FR");
    getVoices.mockReturnValue([frenchFemale, frenchMale]);
    useAuthStore.setState({ user: { avatarType: "male" } as Me });

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(frenchMale);
  });

  it("defaults to a male French voice when no user is loaded", () => {
    const frenchMale = fakeVoice("Microsoft Henri Online (Natural)", "fr-FR");
    getVoices.mockReturnValue([frenchMale]);

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(frenchMale);
  });

  it("lets an explicit voiceURI override the saved preference, for previewing", () => {
    const previewed = fakeVoice("Microsoft David Desktop");
    getVoices.mockReturnValue([previewed, fakeVoice("Microsoft Zira Desktop")]);
    useVoiceSettingsStore.getState().setSelectedVoiceURI("Microsoft Zira Desktop");

    speakText("Hello there", { voiceURI: "Microsoft David Desktop" });

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(previewed);
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

  it("force-releases onEnd via a fallback timeout if the browser never fires end/error", () => {
    // Regression: a real Chrome bug can garbage-collect the utterance and
    // silently drop the "end" event, which used to leave the mic (gated on
    // this callback) disabled forever - see VoiceInput's `disabled` wiring.
    vi.useFakeTimers();
    const onEnd = vi.fn();

    speakText("Hello there", { onEnd });
    expect(onEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15000);

    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not call onEnd twice if the real event fires just before the fallback timeout", () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();

    speakText("Hello there", { onEnd });
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onend?.(new Event("end") as never);

    vi.advanceTimersByTime(15000);

    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
