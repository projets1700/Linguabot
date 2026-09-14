import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { useAuthStore } from "../src/stores/authStore";
import { OnboardingPage } from "../src/pages/OnboardingPage";
import type { Me } from "../src/types";

// Same stand-ins as DashboardPage.test.tsx - AvatarScene's 3D internals and
// AvatarSpeechBubble's own reveal/linger timing are each covered by their
// own test files.
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

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

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
let apiPostSpy: ReturnType<typeof vi.spyOn>;
let fetchMeMock: ReturnType<typeof vi.fn<() => Promise<void>>>;

function axiosLikeError(status: number) {
  return { isAxiosError: true, response: { status } };
}

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

function baseUser(overrides: Partial<Me> = {}): Me {
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
    onboardingCompleted: false,
    placementTestCompleted: false,
    cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
    ...overrides,
  };
}

function renderOnboarding() {
  return render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>,
  );
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    voiceInputState.current = null;
    navigateMock.mockReset();
    fetchMeMock = vi.fn(async () => {});
    useAuthStore.setState({ user: baseUser(), fetchMe: fetchMeMock });
    apiPostSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { onboardingCompleted: true } });

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
    apiPostSpy.mockRestore();
  });

  it("asks for the learner's name in English on arrival", async () => {
    renderOnboarding();
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Hello! I'm LinguaBot, your English teacher. What's your name?");
  });

  it("re-asks the name question when the reply is empty or unintelligible", async () => {
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("um uh");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Hello! I'm LinguaBot, your English teacher. What's your name?");
  });

  it("acknowledges with the account's real first name, never the raw transcript", async () => {
    useAuthStore.setState({ user: baseUser({ prenom: "Adam" }) });
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("My name is Adam");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Nice to meet you, Adam! Are you ready to start?");
    expect(latestUtterance().text).not.toContain("My name is Adam");
  });

  it("completes onboarding and navigates to the placement test on an affirmative reply", async () => {
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("My name is Adam");
    });
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("yes");
    });

    await waitFor(() => expect(apiPostSpy).toHaveBeenCalledWith("/onboarding/complete"));
    await waitFor(() => expect(fetchMeMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/placement-test"));
  });

  it("does not call the API or navigate on a negative reply", async () => {
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("My name is Adam");
    });
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("no");
    });
    await flushMicrotasks();

    expect(apiPostSpy).not.toHaveBeenCalled();
    expect(latestUtterance().text).toBe("No problem. Come back when you're ready!");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("reformulates once on an ambiguous readiness reply, then repeats it, never defaulting to yes", async () => {
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("My name is Adam");
    });
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("maybe");
    });
    await flushMicrotasks();
    const reformulated = latestUtterance().text;
    expect(reformulated).toContain("I didn't quite catch that");
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("I don't know");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe(reformulated);
    expect(apiPostSpy).not.toHaveBeenCalled();
  });

  // Audit P0-03: a failed /onboarding/complete (or the fetchMe() right
  // after it) used to be silently swallowed - the UI moved on as if
  // onboarding had finished while the backend still had it as incomplete.
  it("shows a visible, retryable error instead of navigating when /onboarding/complete fails", async () => {
    apiPostSpy.mockRejectedValueOnce(axiosLikeError(500));
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("My name is Adam");
    });
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("yes");
    });
    await waitFor(() => expect(apiPostSpy).toHaveBeenCalledWith("/onboarding/complete"));
    await flushMicrotasks();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(fetchMeMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("retries and navigates once the retry succeeds", async () => {
    apiPostSpy.mockRejectedValueOnce(axiosLikeError(500));
    renderOnboarding();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("My name is Adam");
    });
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("yes");
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument());

    apiPostSpy.mockResolvedValueOnce({ data: { onboardingCompleted: true } });
    await act(async () => {
      screen.getByRole("button", { name: "Réessayer" }).click();
    });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/placement-test"));
  });
});
