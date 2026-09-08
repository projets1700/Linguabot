import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { findVisemeFrameIndex, speakEnglishWithAzureVisemes, type AzureVisemeFrame } from "./azureSpeech";

vi.mock("../api/client", () => ({
  api: { get: vi.fn() },
}));

// A minimal fake of the SDK's surface this module actually uses - real
// synthesis/audio playback can't run in jsdom, so this simulates a
// successful call: one visemeReceived batch (jawOpen set on frame 0), then
// the speakSsmlAsync success callback.
type FakeSpeakSsmlAsync = (ssml: string, cb: (result: unknown) => void, err: (message: string) => void) => void;

function makeFakeBlendShapeRow(jawOpenValue: number): number[] {
  const row = new Array(55).fill(0);
  row[17] = jawOpenValue; // jawOpen - see BLEND_SHAPE_ORDER in azureSpeech.ts
  return row;
}

const closeSpy = vi.fn();
let visemeReceivedHandler: ((sender: unknown, event: { animation: string }) => void) | undefined;
let speakSsmlAsyncImpl: FakeSpeakSsmlAsync = (_ssml, cb) => {
  visemeReceivedHandler?.(undefined, {
    animation: JSON.stringify({ FrameIndex: 0, BlendShapes: [makeFakeBlendShapeRow(0.8)] }),
  });
  cb({ reason: "SynthesizingAudioCompleted" });
};

vi.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: { fromAuthorizationToken: vi.fn(() => ({})) },
  AudioConfig: { fromDefaultSpeakerOutput: vi.fn(() => ({})) },
  ResultReason: { SynthesizingAudioCompleted: "SynthesizingAudioCompleted" },
  SpeechSynthesizer: vi.fn().mockImplementation(function FakeSpeechSynthesizer(this: Record<string, unknown>) {
    Object.defineProperty(this, "visemeReceived", {
      set(handler: (sender: unknown, event: { animation: string }) => void) {
        visemeReceivedHandler = handler;
      },
    });
    this.speakSsmlAsync = (...args: Parameters<FakeSpeakSsmlAsync>) => speakSsmlAsyncImpl(...args);
    this.close = closeSpy;
  }),
}));

describe("speakEnglishWithAzureVisemes", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    closeSpy.mockReset();
    visemeReceivedHandler = undefined;
    speakSsmlAsyncImpl = (_ssml, cb) => {
      visemeReceivedHandler?.(undefined, {
        animation: JSON.stringify({ FrameIndex: 0, BlendShapes: [makeFakeBlendShapeRow(0.8)] }),
      });
      cb({ reason: "SynthesizingAudioCompleted" });
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns false without touching the SDK when the token endpoint has no key configured (204)", async () => {
    vi.mocked(api.get).mockResolvedValue({ status: 204, data: "" });
    const framesRef = { current: [] as AzureVisemeFrame[] };
    const startTimeRef = { current: null as number | null };

    const handled = await speakEnglishWithAzureVisemes("Hello", "male", { framesRef, startTimeRef });

    expect(handled).toBe(false);
    expect(startTimeRef.current).toBeNull();
  });

  it("returns false when the token request itself fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network error"));
    const framesRef = { current: [] as AzureVisemeFrame[] };
    const startTimeRef = { current: null as number | null };

    const handled = await speakEnglishWithAzureVisemes("Hello", "male", { framesRef, startTimeRef });

    expect(handled).toBe(false);
  });

  it("synthesizes with real visemes, calls onStart/onEnd, and fills framesRef with the extracted mouth weights", async () => {
    vi.mocked(api.get).mockResolvedValue({ status: 200, data: { token: "fake-token", region: "westeurope" } });
    const framesRef = { current: [] as AzureVisemeFrame[] };
    const startTimeRef = { current: null as number | null };
    const onStart = vi.fn();
    const onEnd = vi.fn();

    const handled = await speakEnglishWithAzureVisemes("Hello there", "male", { framesRef, startTimeRef, onStart, onEnd });

    expect(handled).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(framesRef.current).toHaveLength(1);
    expect(framesRef.current[0].timeMs).toBe(0);
    expect(framesRef.current[0].weights.jawOpen).toBe(0.8);
    // Only lip-sync targets are extracted - never eyes/brows/tongue/etc.
    expect(Object.keys(framesRef.current[0].weights)).not.toContain("eyeBlinkLeft");
    // Cleared again once the utterance is fully done.
    expect(startTimeRef.current).toBeNull();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("still resolves true and calls onEnd if synthesis fails mid-utterance (already committed, must not fall back)", async () => {
    vi.mocked(api.get).mockResolvedValue({ status: 200, data: { token: "fake-token", region: "westeurope" } });
    speakSsmlAsyncImpl = (_ssml, _cb, err) => err("boom");
    const framesRef = { current: [] as AzureVisemeFrame[] };
    const startTimeRef = { current: null as number | null };
    const onEnd = vi.fn();

    const handled = await speakEnglishWithAzureVisemes("Hello", "male", { framesRef, startTimeRef, onEnd });

    expect(handled).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe("findVisemeFrameIndex", () => {
  const frames: AzureVisemeFrame[] = [
    { timeMs: 0, weights: {} },
    { timeMs: 100, weights: {} },
    { timeMs: 200, weights: {} },
  ];

  it("stays at fromIndex when frames is empty", () => {
    expect(findVisemeFrameIndex([], 500, 0)).toBe(0);
  });

  it("stays at the first frame before the second frame's time has passed", () => {
    expect(findVisemeFrameIndex(frames, 50, 0)).toBe(0);
  });

  it("walks forward as elapsed time passes each frame's timestamp", () => {
    expect(findVisemeFrameIndex(frames, 150, 0)).toBe(1);
    expect(findVisemeFrameIndex(frames, 250, 0)).toBe(2);
  });

  it("never walks past the last frame", () => {
    expect(findVisemeFrameIndex(frames, 10_000, 0)).toBe(2);
  });

  it("resumes the walk from fromIndex instead of rescanning from the start", () => {
    expect(findVisemeFrameIndex(frames, 250, 2)).toBe(2);
  });
});
