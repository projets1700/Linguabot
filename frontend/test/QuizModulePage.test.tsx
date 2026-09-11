import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { useAuthStore } from "../src/stores/authStore";
import { QuizModulePage } from "../src/pages/QuizModulePage";
import type { CecrlProfile, Me } from "../src/types";

// Same rationale/stand-ins as DashboardPage.test.tsx: AvatarScene's 3D
// internals and VoiceInput's real SpeechRecognition are each covered by
// their own test files, not relevant to this page's help-policy branching.
vi.mock("../src/components/AvatarScene", () => ({
  AvatarScene: ({ onReady }: { onReady?: () => void }) => {
    const firedRef = useRef(false);
    useEffect(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onReady?.();
    });
    return <div data-testid="avatar-scene-stub" />;
  },
}));

vi.mock("../src/components/AvatarSpeechBubble", () => ({
  AvatarSpeechBubble: ({ text, active }: { text: string | null; active: boolean }) =>
    active && text ? <div role="status">{text}</div> : null,
}));

const voiceInputState = vi.hoisted(() => ({
  current: null as null | { onResult: (transcript: string) => void; disabled?: boolean },
}));
vi.mock("../src/components/VoiceInput", () => ({
  VoiceInput: (props: { onResult: (transcript: string) => void; disabled?: boolean }) => {
    voiceInputState.current = props;
    return <div data-testid="voice-input-stub" />;
  },
}));

function fakeVoice(voiceURI: string, lang = "en-US"): SpeechSynthesisVoice {
  return { name: voiceURI, lang, voiceURI, default: false, localService: true } as SpeechSynthesisVoice;
}

type FakeUtterance = {
  text: string;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

let speak: ReturnType<typeof vi.fn>;
let apiGetSpy: ReturnType<typeof vi.spyOn>;
let apiPostSpy: ReturnType<typeof vi.spyOn>;

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function latestUtterance(): FakeUtterance {
  const calls = speak.mock.calls;
  if (calls.length === 0) throw new Error("speechSynthesis.speak() was never called");
  return calls[calls.length - 1][0] as FakeUtterance;
}

async function endLatestSpeech(): Promise<void> {
  const utterance = latestUtterance();
  await act(async () => {
    utterance.onend?.();
  });
}

function baseUser(cecrlProfile: CecrlProfile): Me {
  return {
    id: 1,
    prenom: "Adam",
    nom: "Amrane",
    email: "adam@test.fr",
    role: "ROLE_USER",
    level: { code: "A0", name: "Débutant absolu", xpThreshold: 0 },
    avatarType: "male",
    totalXp: 0,
    sessionsCount: 0,
    avgScore: null,
    onboardingCompleted: true,
    placementTestCompleted: true,
    cecrlProfile,
  };
}

const QUESTIONS = [
  { id: 101, questionText: 'Comment dit-on "bonjour" ?' },
  { id: 102, questionText: 'Comment dit-on "merci" ?' },
];

function mockQuizApi() {
  apiGetSpy = vi.spyOn(api, "get").mockImplementation((url: string) => {
    if (url === "/quiz/modules/1/questions") {
      return Promise.resolve({ data: QUESTIONS });
    }
    if (url === "/quiz/questions/101/answer") {
      return Promise.resolve({ data: { answer: "hello" } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  apiPostSpy = vi.spyOn(api, "post").mockResolvedValue({
    data: { score: 2, passed: true, xpEarned: 20, levelUp: null, userLevel: "A0", userTotalXp: 20, newBadges: [], newTrophies: [] },
  });
}

function renderQuizModulePage() {
  return render(
    <MemoryRouter initialEntries={["/quiz/1"]}>
      <Routes>
        <Route path="/quiz/:moduleId" element={<QuizModulePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuizModulePage - CECRL help policy (LOT 3)", () => {
  beforeEach(() => {
    voiceInputState.current = null;
    mockQuizApi();

    speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak,
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([fakeVoice("Test Voice")]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    class FakeSpeechSynthesisUtterance implements FakeUtterance {
      text: string;
      lang = "";
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);
  });

  afterEach(() => {
    // @ts-expect-error test-only cleanup of a property defined above
    delete window.speechSynthesis;
    vi.unstubAllGlobals();
    apiGetSpy.mockRestore();
    apiPostSpy.mockRestore();
  });

  it("reveals the answer immediately on a blocked transcript for an A0-A2 profile (unchanged behavior)", async () => {
    useAuthStore.setState({
      user: baseUser({ transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true }),
    });
    renderQuizModulePage();
    await waitFor(() => expect(speak).toHaveBeenCalled());
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("I don't know");
    });

    await waitFor(() => expect(apiGetSpy).toHaveBeenCalledWith("/quiz/questions/101/answer"));
    await waitFor(() => expect(latestUtterance().text).toBe("You can say: hello."));
    expect(screen.queryByRole("button", { name: /Afficher la réponse/ })).not.toBeInTheDocument();
  });

  it("does not reveal the answer on the first block for a B1/B2 profile, and shows a reveal button instead", async () => {
    useAuthStore.setState({
      user: baseUser({ transcriptMode: "onDemand", translationMode: "onDemand", hintMode: "keywords", helpVisibleByDefault: false }),
    });
    renderQuizModulePage();
    await waitFor(() => expect(speak).toHaveBeenCalled());
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("I don't know");
    });

    expect(apiGetSpy).not.toHaveBeenCalledWith("/quiz/questions/101/answer");
    expect(screen.getByRole("button", { name: /Afficher la réponse/ })).toBeInTheDocument();
  });

  it("reveals the answer once the B1/B2 reveal button is clicked, and adds the question to helpedQuestionIds", async () => {
    useAuthStore.setState({
      user: baseUser({ transcriptMode: "onDemand", translationMode: "onDemand", hintMode: "keywords", helpVisibleByDefault: false }),
    });
    renderQuizModulePage();
    await waitFor(() => expect(speak).toHaveBeenCalled());
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("I don't know");
    });
    await endLatestSpeech();

    await act(async () => {
      screen.getByRole("button", { name: /Afficher la réponse/ }).click();
    });

    await waitFor(() => expect(apiGetSpy).toHaveBeenCalledWith("/quiz/questions/101/answer"));
    await waitFor(() => expect(latestUtterance().text).toBe("You can say: hello."));

    await endLatestSpeech();
    await act(async () => {
      await voiceInputState.current?.onResult("hello");
    });
    await endLatestSpeech();
    await act(async () => {
      await voiceInputState.current?.onResult("thank you");
    });

    await waitFor(() =>
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/quiz/attempts",
        expect.objectContaining({ helpedQuestionIds: [101] }),
      ),
    );
  });

  it("resets the reveal-button unlock when moving to a new question", async () => {
    useAuthStore.setState({
      user: baseUser({ transcriptMode: "onDemand", translationMode: "onDemand", hintMode: "keywords", helpVisibleByDefault: false }),
    });
    renderQuizModulePage();
    await waitFor(() => expect(speak).toHaveBeenCalled());
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("I don't know");
    });
    expect(screen.getByRole("button", { name: /Afficher la réponse/ })).toBeInTheDocument();

    await endLatestSpeech();
    await act(async () => {
      await voiceInputState.current?.onResult("hello");
    });
    await flushMicrotasks();

    expect(screen.queryByRole("button", { name: /Afficher la réponse/ })).not.toBeInTheDocument();
  });
});
