import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceInput } from "./VoiceInput";

class MockSpeechRecognition implements Partial<SpeechRecognition> {
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => {
    this.onend?.();
  });
  abort = vi.fn();
}

let instances: MockSpeechRecognition[] = [];

function lastInstance(): MockSpeechRecognition {
  return instances[instances.length - 1];
}

function makeResultEvent(transcripts: { text: string; isFinal: boolean }[]): SpeechRecognitionEvent {
  const results = transcripts.map(({ text, isFinal }) => ({
    isFinal,
    length: 1,
    0: { transcript: text, confidence: 1 },
    item: () => ({ transcript: text, confidence: 1 }),
  }));

  return {
    resultIndex: 0,
    results: Object.assign(results, { item: (i: number) => results[i], length: results.length }),
  } as unknown as SpeechRecognitionEvent;
}

describe("VoiceInput", () => {
  beforeEach(() => {
    instances = [];
    // Arrow functions can't be `new`-ed, so the mock constructor has to be a
    // plain function - returning an object from it overrides the `this`
    // `new` would otherwise produce, same as a real class instance.
    window.SpeechRecognition = vi.fn(function () {
      const instance = new MockSpeechRecognition();
      instances.push(instance);
      return instance as unknown as SpeechRecognition;
    }) as unknown as SpeechRecognitionConstructor;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    instances = [];
  });

  it("shows an unsupported-browser message when the Web Speech API is absent", () => {
    delete window.SpeechRecognition;

    render(<VoiceInput onResult={vi.fn()} />);

    expect(screen.getByText(/ne supporte pas la reconnaissance vocale/)).toBeInTheDocument();
  });

  it("starts listening automatically on mount, with no press-to-talk step", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    // The only button is the mute toggle - it doesn't need to be pressed to
    // start a turn, listening already began on its own.
    expect(screen.getByRole("button", { name: "Désactiver le micro" })).toBeInTheDocument();
    expect(lastInstance().start).toHaveBeenCalled();
  });

  it("shows interim text while speaking", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    act(() => {
      lastInstance().onresult?.(makeResultEvent([{ text: "Hello there", isFinal: false }]));
    });

    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("calls onResult with the final transcript once recognition ends", () => {
    const onResult = vi.fn();
    render(<VoiceInput onResult={onResult} />);

    act(() => {
      lastInstance().onresult?.(makeResultEvent([{ text: "I live in Paris", isFinal: true }]));
      lastInstance().onend?.();
    });

    expect(onResult).toHaveBeenCalledWith("I live in Paris");
  });

  it("automatically restarts listening after a silent/empty result", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    act(() => {
      lastInstance().onend?.();
    });

    expect(instances.length).toBe(2);
    expect(instances[1].start).toHaveBeenCalled();
  });

  it("shows a permission error and stops retrying when the microphone is blocked", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    act(() => {
      lastInstance().onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent);
    });

    expect(screen.getByText(/micro est bloqué/)).toBeInTheDocument();
  });

  it("does not listen while disabled, and resumes once re-enabled", () => {
    const { rerender } = render(<VoiceInput onResult={vi.fn()} disabled />);

    expect(instances.length).toBe(0);

    rerender(<VoiceInput onResult={vi.fn()} disabled={false} />);

    expect(instances.length).toBe(1);
    expect(lastInstance().start).toHaveBeenCalled();
  });

  it("mutes on click: stops the current recognition and never restarts it", () => {
    render(<VoiceInput onResult={vi.fn()} />);
    const instanceCountBeforeMute = instances.length;

    fireEvent.click(screen.getByRole("button", { name: "Désactiver le micro" }));

    expect(screen.getByText("Micro coupé")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activer le micro" })).toBeInTheDocument();

    // Even a stray onend firing after the mute must not restart listening.
    act(() => {
      instances[instanceCountBeforeMute - 1]?.onend?.();
    });
    expect(instances.length).toBe(instanceCountBeforeMute);
  });

  it("resumes listening when unmuted", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Désactiver le micro" }));
    const instanceCountWhileMuted = instances.length;

    fireEvent.click(screen.getByRole("button", { name: "Activer le micro" }));

    expect(instances.length).toBe(instanceCountWhileMuted + 1);
    expect(lastInstance().start).toHaveBeenCalled();
  });
});
