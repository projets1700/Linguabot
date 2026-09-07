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

let lastInstance: MockSpeechRecognition | null = null;

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
    // Arrow functions can't be `new`-ed, so the mock constructor has to be a
    // plain function - returning an object from it overrides the `this`
    // `new` would otherwise produce, same as a real class instance.
    window.SpeechRecognition = vi.fn(function () {
      lastInstance = new MockSpeechRecognition();
      return lastInstance as unknown as SpeechRecognition;
    }) as unknown as SpeechRecognitionConstructor;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    lastInstance = null;
  });

  it("shows an unsupported-browser message when the Web Speech API is absent", () => {
    delete window.SpeechRecognition;

    render(<VoiceInput onResult={vi.fn()} />);

    expect(screen.getByText(/ne supporte pas la reconnaissance vocale/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("starts listening and shows interim text while speaking", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Parler" }));

    expect(lastInstance?.start).toHaveBeenCalled();

    act(() => {
      lastInstance!.onresult?.(makeResultEvent([{ text: "Hello there", isFinal: false }]));
    });

    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("calls onResult with the final transcript once recognition ends", () => {
    const onResult = vi.fn();
    render(<VoiceInput onResult={onResult} />);

    fireEvent.click(screen.getByRole("button", { name: "Parler" }));
    act(() => {
      lastInstance!.onresult?.(makeResultEvent([{ text: "I live in Paris", isFinal: true }]));
      lastInstance!.onend?.();
    });

    expect(onResult).toHaveBeenCalledWith("I live in Paris");
  });

  it("shows a permission error when the microphone is blocked", () => {
    render(<VoiceInput onResult={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Parler" }));
    act(() => {
      lastInstance!.onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent);
    });

    expect(screen.getByText(/micro est bloqué/)).toBeInTheDocument();
  });

  it("does not call onResult when nothing was heard", () => {
    const onResult = vi.fn();
    render(<VoiceInput onResult={onResult} />);

    fireEvent.click(screen.getByRole("button", { name: "Parler" }));
    act(() => {
      lastInstance!.onend?.();
    });

    expect(onResult).not.toHaveBeenCalled();
    expect(screen.getByText(/Je n'ai rien entendu/)).toBeInTheDocument();
  });
});
