import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakText } from "../src/lib/speech";
import { useAuthStore } from "../src/stores/authStore";
import { useVoiceSettingsStore } from "../src/stores/voiceSettingsStore";
import type { Me } from "../src/types";

function fakeVoice(voiceURI: string, lang = "en-US"): SpeechSynthesisVoice {
  return { name: voiceURI, lang, voiceURI, default: false, localService: true } as SpeechSynthesisVoice;
}

// speakText() now waits for the browser's voice list before actually
// speaking (see waitForVoicesReady in speech.ts) - even when that wait
// resolves "instantly" (voices already loaded), it's still a Promise
// microtask, so every test needs to let that settle before asserting.
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("speakText", () => {
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;
  let getVoices: ReturnType<typeof vi.fn>;
  let addEventListener: ReturnType<typeof vi.fn>;
  let removeEventListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speak = vi.fn();
    cancel = vi.fn();
    // Non-empty by default: most tests aren't exercising the "voices
    // haven't loaded yet" path, so this keeps them on the fast, synchronous
    // branch of waitForVoicesReady() instead of the addEventListener one.
    getVoices = vi.fn().mockReturnValue([fakeVoice("Default Test Voice")]);
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak, cancel, getVoices, addEventListener, removeEventListener },
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

  it("cancels any in-flight utterance before speaking a new one", async () => {
    speakText("Hello there");
    await flushMicrotasks();

    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("only speaks the most recent call when two arrive before either has actually spoken", async () => {
    // Regression: React StrictMode invokes an effect (e.g. the A0 quiz's
    // "speak the current question" effect) twice in a row. Both calls'
    // cancel() fire before either had reached the (now async, since it
    // waits on the voice list) point of actually calling speak() - so the
    // first call had nothing yet to interrupt, and without this guard both
    // went on to speak, reading as the same line said twice back to back.
    speakText("first");
    speakText("second");
    await flushMicrotasks();

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe("second");
  });

  it("defaults the utterance language to en-US", async () => {
    speakText("Hello there");
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe("Hello there");
    expect(utterance.lang).toBe("en-US");
  });

  it("honours an explicit lang override", async () => {
    speakText("Bonjour", { lang: "fr-FR" });
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.lang).toBe("fr-FR");
  });

  it("applies the learner's saved voice preference to English speech", async () => {
    const preferred = fakeVoice("Microsoft Zira Desktop");
    getVoices.mockReturnValue([fakeVoice("Microsoft David Desktop"), preferred]);
    useVoiceSettingsStore.getState().setSelectedVoiceURI("Microsoft Zira Desktop");

    speakText("Hello there");
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(preferred);
  });

  it("auto-picks an English voice matching the avatar's gender when no preference is saved yet", async () => {
    // Regression: before a learner ever visits the voice settings page (or
    // after the mismatch-cleanup there resets the pick), the utterance's
    // voice was left completely unset for English speech - silently
    // falling through to the browser's own generic default voice instead
    // of one matching the chosen avatar.
    const englishMale = fakeVoice("Microsoft David Desktop", "en-US");
    const englishFemale = fakeVoice("Microsoft Zira Desktop", "en-US");
    getVoices.mockReturnValue([englishFemale, englishMale]);
    useAuthStore.setState({ user: { avatarType: "male" } as Me });

    speakText("Hello there");
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(englishMale);
  });

  it("never applies the saved English voice preference to French speech (A0 quiz)", async () => {
    getVoices.mockReturnValue([fakeVoice("Microsoft Zira Desktop")]);
    useVoiceSettingsStore.getState().setSelectedVoiceURI("Microsoft Zira Desktop");

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBeNull();
  });

  it("auto-picks a French voice matching the avatar's gender for the A0 quiz", async () => {
    // Regression: a male avatar was still getting a female voice on the A0
    // quiz, because French speech never applied any gender preference at
    // all - it just fell through to the browser's own French default.
    const frenchMale = fakeVoice("Microsoft Henri Online (Natural)", "fr-FR");
    const frenchFemale = fakeVoice("Microsoft Denise Online (Natural)", "fr-FR");
    getVoices.mockReturnValue([frenchFemale, frenchMale]);
    useAuthStore.setState({ user: { avatarType: "male" } as Me });

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(frenchMale);
  });

  it("defaults to a male French voice when no user is loaded", async () => {
    const frenchMale = fakeVoice("Microsoft Henri Online (Natural)", "fr-FR");
    getVoices.mockReturnValue([frenchMale]);

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(frenchMale);
  });

  it("lets an explicit voiceURI override the saved preference, for previewing", async () => {
    const previewed = fakeVoice("Microsoft David Desktop");
    getVoices.mockReturnValue([previewed, fakeVoice("Microsoft Zira Desktop")]);
    useVoiceSettingsStore.getState().setSelectedVoiceURI("Microsoft Zira Desktop");

    speakText("Hello there", { voiceURI: "Microsoft David Desktop" });
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(previewed);
  });

  it("waits for the voice list to finish loading before picking one, on the very first call", async () => {
    // Regression: Chrome/Edge reliably return an empty array from
    // getVoices() until they've finished asynchronously enumerating
    // voices - the A0 quiz's opening question (spoken from a useEffect on
    // mount) could race that and silently speak with the browser's
    // default voice instead of one matching the avatar.
    const frenchMale = fakeVoice("Microsoft Henri Online (Natural)", "fr-FR");
    getVoices.mockReturnValueOnce([]).mockReturnValueOnce([]).mockReturnValue([frenchMale]);
    useAuthStore.setState({ user: { avatarType: "male" } as Me });

    speakText("Comment dit-on bonjour ?", { lang: "fr-FR" });
    await flushMicrotasks();

    // Voices weren't ready yet - must not have spoken with whatever
    // (nothing) was available at that instant.
    expect(speak).not.toHaveBeenCalled();
    const voiceschangedCall = addEventListener.mock.calls.find(([event]) => event === "voiceschanged");
    expect(voiceschangedCall).toBeDefined();

    // Simulate the browser finishing its async voice enumeration.
    const [, listener] = voiceschangedCall as [string, () => void];
    listener();
    await flushMicrotasks();

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(frenchMale);
  });

  it("calls onStart/onEnd through the utterance's own event handlers", async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    speakText("Hello there", { onStart, onEnd });
    await flushMicrotasks();

    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onstart?.(new Event("start") as never);
    utterance.onend?.(new Event("end") as never);

    expect(onStart).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });

  it("calls onEnd immediately when speechSynthesis is unavailable", async () => {
    // @ts-expect-error simulating an unsupported browser
    delete window.speechSynthesis;
    const onEnd = vi.fn();

    speakText("Hello there", { onEnd });
    await flushMicrotasks();

    expect(onEnd).toHaveBeenCalled();
  });

  it("force-releases onEnd via a fallback timeout if the browser never fires end/error", async () => {
    // Regression: a real Chrome bug can garbage-collect the utterance and
    // silently drop the "end" event, which used to leave the mic (gated on
    // this callback) disabled forever - see VoiceInput's `disabled` wiring.
    vi.useFakeTimers();
    const onEnd = vi.fn();

    speakText("Hello there", { onEnd });
    await flushMicrotasks();
    expect(onEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15000);

    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not call onEnd twice if the real event fires just before the fallback timeout", async () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();

    speakText("Hello there", { onEnd });
    await flushMicrotasks();
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onend?.(new Event("end") as never);

    vi.advanceTimersByTime(15000);

    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
