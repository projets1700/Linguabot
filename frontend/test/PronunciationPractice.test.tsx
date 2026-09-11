import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakText } from "../src/lib/speech";
import { PronunciationPractice } from "../src/components/PronunciationPractice";

vi.mock("../src/lib/speech", () => ({
  speakText: vi.fn(),
}));

class MockSpeechRecognition implements Partial<SpeechRecognition> {
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

let instances: MockSpeechRecognition[] = [];

function lastInstance(): MockSpeechRecognition {
  return instances[instances.length - 1];
}

function makeResultEvent(text: string): SpeechRecognitionEvent {
  const result = {
    isFinal: true,
    length: 1,
    0: { transcript: text, confidence: 1 },
    item: () => ({ transcript: text, confidence: 1 }),
  };
  const results = Object.assign([result], { item: (i: number) => [result][i], length: 1 });

  return { resultIndex: 0, results } as unknown as SpeechRecognitionEvent;
}

const TARGET = "I would like to book a table.";

describe("PronunciationPractice", () => {
  beforeEach(() => {
    instances = [];
    // Arrow functions can't be `new`-ed - same pattern as VoiceInput.test.tsx.
    window.SpeechRecognition = vi.fn(function () {
      const instance = new MockSpeechRecognition();
      instances.push(instance);
      return instance as unknown as SpeechRecognition;
    }) as unknown as SpeechRecognitionConstructor;
    vi.mocked(speakText).mockReset();
  });

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    instances = [];
  });

  function expandPanel() {
    fireEvent.click(screen.getByRole("button", { name: /M'entraîner/ }));
  }

  it("renders collapsed behind a trigger button by default", () => {
    render(<PronunciationPractice targetText={TARGET} />);

    expect(screen.getByRole("button", { name: /M'entraîner/ })).toBeInTheDocument();
    expect(screen.queryByText(/Texte à répéter/)).not.toBeInTheDocument();
  });

  it("expands to show the target text and never shows a numeric score anywhere", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();

    expect(screen.getByText(TARGET, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Écouter la phrase à répéter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" })).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
  });

  it("calls speakText with the target text when Écouter is clicked", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();

    fireEvent.click(screen.getByRole("button", { name: "Écouter la phrase à répéter" }));

    expect(speakText).toHaveBeenCalledWith(TARGET, expect.objectContaining({ lang: "en-US" }));
  });

  it("starts a speech recognition attempt when Réessayer is clicked", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));

    expect(lastInstance().start).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Écoute/ })).toBeInTheDocument();
  });

  it("shows the recognized transcript and a matched result for an exact repeat", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));

    act(() => {
      lastInstance().onresult?.(makeResultEvent(TARGET));
      lastInstance().onend?.();
    });

    expect(screen.getByText(/J'ai entendu/)).toBeInTheDocument();
    expect(screen.getByText(/Phrase reconnue/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows a close result when most, but not all, key words are recognized", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));

    act(() => {
      lastInstance().onresult?.(makeResultEvent("I would like to a"));
      lastInstance().onend?.();
    });

    expect(screen.getByText(/Presque, essaie encore/)).toBeInTheDocument();
  });

  it("shows a retry result for an unrelated sentence", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));

    act(() => {
      lastInstance().onresult?.(makeResultEvent("The weather is nice today"));
      lastInstance().onend?.();
    });

    expect(screen.getByText("🔴 Essaie encore")).toBeInTheDocument();
  });

  it("shows a distinct message (not the retry feedback) when nothing was heard", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));

    act(() => {
      lastInstance().onend?.();
    });

    expect(screen.getByText(/je n'ai rien entendu/)).toBeInTheDocument();
  });

  it("shows a clear error when the microphone is blocked", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));

    act(() => {
      lastInstance().onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent);
      lastInstance().onend?.();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/micro est bloqué/);
  });

  it("clears the previous result and lets the learner try again", () => {
    render(<PronunciationPractice targetText={TARGET} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));
    act(() => {
      lastInstance().onresult?.(makeResultEvent("The weather is nice today"));
      lastInstance().onend?.();
    });
    expect(screen.getByText("🔴 Essaie encore")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer - le micro va s'activer" }));
    expect(instances.length).toBe(2);

    act(() => {
      lastInstance().onresult?.(makeResultEvent(TARGET));
      lastInstance().onend?.();
    });

    expect(screen.getByText(/Phrase reconnue/)).toBeInTheDocument();
    expect(screen.queryByText("🔴 Essaie encore")).not.toBeInTheDocument();
  });
});
