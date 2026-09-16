import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { DailyChallengePage } from "../src/pages/DailyChallengePage";
import { useAuthStore } from "../src/stores/authStore";
import type { CecrlProfile, DailyChallenge, Me } from "../src/types";

// Same rationale as QuizModulePage.test.tsx: AvatarScene's 3D internals and
// VoiceInput's real SpeechRecognition are each covered by their own test
// files. This stub also exposes the props this task actually cares about
// (framing, showStateLabel) as data-attributes so tests can assert on them
// without reaching into AvatarScene's implementation.
vi.mock("../src/components/AvatarScene", () => ({
  AvatarScene: ({
    onReady,
    framing,
    showStateLabel,
    transparentBackground,
  }: {
    onReady?: () => void;
    framing?: string;
    showStateLabel?: boolean;
    transparentBackground?: boolean;
  }) => {
    const firedRef = useRef(false);
    useEffect(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onReady?.();
    });
    return (
      <div
        data-testid="avatar-scene-stub"
        data-framing={framing}
        data-show-state-label={String(showStateLabel)}
        data-transparent-background={String(transparentBackground)}
      />
    );
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
  VoiceInput: (props: {
    onResult: (transcript: string) => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => {
    voiceInputState.current = props;
    return (
      <div
        data-testid="voice-input-stub"
        data-variant={props.variant}
        data-size={props.size}
        data-disabled={String(props.disabled)}
      />
    );
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

async function endLatestSpeech(): Promise<void> {
  const calls = speak.mock.calls;
  if (calls.length === 0) throw new Error("speechSynthesis.speak() was never called");
  const utterance = calls[calls.length - 1][0] as FakeUtterance;
  await act(async () => {
    utterance.onend?.();
  });
}

function latestUtteranceText(): string {
  const calls = speak.mock.calls;
  if (calls.length === 0) throw new Error("speechSynthesis.speak() was never called");
  return (calls[calls.length - 1][0] as FakeUtterance).text;
}

function baseUser(): Me {
  return {
    id: 1,
    prenom: "Adam",
    nom: "Amrane",
    email: "adam@test.fr",
    role: "ROLE_USER",
    level: { code: "A1", name: "Grands débuts", xpThreshold: 300 },
    avatarType: "male",
    totalXp: 0,
    sessionsCount: 0,
    onboardingCompleted: true,
    placementTestCompleted: true,
    cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
  };
}

function baseChallenge(overrides: Partial<DailyChallenge> = {}, cecrlProfile?: Partial<CecrlProfile>): DailyChallenge {
  return {
    id: 7,
    title: "Rainy Day Plans",
    context: "It's raining and your outdoor plans are cancelled.",
    objective: "Suggest an alternative indoor activity to a friend.",
    keywords: ["rain", "indoor", "plan"],
    characterName: "Friend",
    challengeDate: "2026-09-15",
    xpReward: 120,
    started: false,
    completed: false,
    cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true, ...cecrlProfile },
    ...overrides,
  };
}

function mockApi({
  challenge,
  openingMessage = "Hello! I'm Friend. Ready?",
  assistantMessage = "Great idea! What would you suggest?",
}: {
  challenge: DailyChallenge;
  openingMessage?: string;
  assistantMessage?: string;
}) {
  apiGetSpy = vi.spyOn(api, "get").mockImplementation((url: string) => {
    if (url === "/daily-challenge") return Promise.resolve({ data: challenge });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  apiPostSpy = vi.spyOn(api, "post").mockImplementation((url: string) => {
    if (url === "/daily-challenge/start") return Promise.resolve({ data: { openingMessage } });
    if (url === "/daily-challenge/message") return Promise.resolve({ data: { assistantMessage } });
    if (url === "/daily-challenge/finish") {
      return Promise.resolve({
        data: { xpEarned: challenge.xpReward, userTotalXp: 500, levelUp: null, newBadges: [], newTrophies: [] },
      });
    }
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
}

function stubSpeechSynthesis() {
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
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DailyChallengePage />
    </MemoryRouter>,
  );
}

/**
 * Gets past the mandatory pre-launch briefing ("Today's mission... Are you
 * ready?") and clicks the manual button to launch the challenge - the
 * button path, as opposed to the voice "yes" path covered by its own tests
 * below. Leaves the opening line's speech still in flight (avatarState
 * "speaking"), matching where the old (pre-briefing) tests used to start
 * their own assertions right after clicking.
 */
async function startViaButtonAfterBriefing(): Promise<void> {
  await waitFor(() => expect(screen.getByRole("button", { name: /Relever le défi/ })).toBeInTheDocument());
  await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
  await endLatestSpeech();

  await act(async () => {
    screen.getByRole("button", { name: /Relever le défi/ }).click();
  });

  await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
}

describe("DailyChallengePage", () => {
  beforeEach(() => {
    voiceInputState.current = null;
    useAuthStore.setState({ user: baseUser() });
    stubSpeechSynthesis();
  });

  afterEach(() => {
    // @ts-expect-error test-only cleanup of a property defined above
    delete window.speechSynthesis;
    vi.unstubAllGlobals();
    apiGetSpy?.mockRestore();
    apiPostSpy?.mockRestore();
  });

  it("loads and shows the real title and XP reward before starting, with the avatar already visible", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();

    await waitFor(() => expect(screen.getByText("Rainy Day Plans")).toBeInTheDocument());
    expect(screen.getByText(/\+120 XP/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Relever le défi/ })).toBeInTheDocument();
    // The "Ta mission" card (context/objective/keywords) was removed - it
    // duplicated what LinguaBot now says out loud in the briefing.
    expect(screen.queryByText("🎯 Ta mission")).not.toBeInTheDocument();
    expect(screen.queryByText("rain")).not.toBeInTheDocument();

    // LinguaBot is visible from the very first render, before the mission
    // is even started - not just once the conversation begins.
    const avatar = screen.getByTestId("avatar-scene-stub");
    expect(avatar).toHaveAttribute("data-framing", "portrait");
    expect(avatar).toHaveAttribute("data-transparent-background", "true");
    expect(avatar).toHaveAttribute("data-show-state-label", "false");
  });

  it("has LinguaBot brief the real mission by voice as soon as it loads, driving the same lip-sync pipeline (speechText/charIndexRef) as every other page", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    // Built from the real challenge fields, never a fabricated line.
    expect(latestUtteranceText()).toBe(
      "Today's mission: Rainy Day Plans. It's raining and your outdoor plans are cancelled. " +
        "Suggest an alternative indoor activity to a friend. Are you ready?",
    );
    // avatarState "speaking" drives AvatarScene's speechText/charIndexRef
    // (the lip-sync pipeline) - not re-tested here (own test files), but the
    // status line and speech bubble reacting to it confirm the same
    // useConversationSession wiring used everywhere else is active here too.
    expect(screen.getByText("LinguaBot parle...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Today's mission");

    const mic = screen.getByTestId("voice-input-stub");
    expect(mic).toHaveAttribute("data-variant", "brand");
    expect(mic).toHaveAttribute("data-disabled", "true");
  });

  it("does not brief an already-completed challenge out loud (no avatar shown on the result screen)", async () => {
    mockApi({ challenge: baseChallenge({ completed: true, started: true }) });
    renderPage();

    await waitFor(() => expect(screen.getByText("Défi relevé ! 🎉")).toBeInTheDocument());
    expect(speak).not.toHaveBeenCalled();
  });

  it("launches the challenge when the learner says 'yes' to the briefing, without needing the button", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    await endLatestSpeech();

    expect(screen.getByText('Dis "yes" quand tu es prêt')).toBeInTheDocument();
    expect(screen.getByTestId("voice-input-stub")).toHaveAttribute("data-disabled", "false");

    await act(async () => {
      await voiceInputState.current?.onResult("yes");
    });

    expect(apiPostSpy).toHaveBeenCalledWith("/daily-challenge/start");
    await waitFor(() => expect(screen.getByText("En cours")).toBeInTheDocument());
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
  });

  it("acknowledges a decline without launching the challenge, and keeps the presentation on screen", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("no");
    });

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
    expect(latestUtteranceText()).toBe("No problem. Tap the button below whenever you're ready.");
    expect(apiPostSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Relever le défi/ })).toBeInTheDocument();
  });

  it("reformulates the ready question on an ambiguous reply, without launching the challenge", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("what time is it");
    });

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
    expect(latestUtteranceText()).toBe("I didn't quite catch that. Say yes when you're ready, or use the button below.");
    expect(apiPostSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Relever le défi/ })).toBeInTheDocument();
  });

  it("collapses the detailed presentation into a compact reminder once the challenge starts, and keeps the same avatar framing", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await startViaButtonAfterBriefing();

    await waitFor(() => expect(screen.getByText("En cours")).toBeInTheDocument());
    // The full mission card, its keywords and the XP badge are gone - only
    // the compact reminder (title + "En cours") remains.
    expect(screen.queryByText("🎯 Ta mission")).not.toBeInTheDocument();
    expect(screen.queryByText("It's raining and your outdoor plans are cancelled.")).not.toBeInTheDocument();
    expect(screen.queryByText("rain")).not.toBeInTheDocument();
    expect(screen.queryByText(/\+120 XP/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Relever le défi/ })).not.toBeInTheDocument();

    // Same avatar, same framing - grown, not swapped or remounted.
    const avatar = screen.getByTestId("avatar-scene-stub");
    expect(avatar).toHaveAttribute("data-framing", "portrait");
    expect(avatar).toHaveAttribute("data-transparent-background", "true");
  });

  it("starts the challenge via the button, frames the avatar as 'portrait' without the debug state label, and speaks the real opening line", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await startViaButtonAfterBriefing();

    const avatar = screen.getByTestId("avatar-scene-stub");
    expect(avatar).toHaveAttribute("data-framing", "portrait");
    expect(avatar).toHaveAttribute("data-show-state-label", "false");
    expect(latestUtteranceText()).toBe("Hello! I'm Friend. Ready?");
    expect(screen.getByText("LinguaBot parle...")).toBeInTheDocument();

    const mic = screen.getByTestId("voice-input-stub");
    expect(mic).toHaveAttribute("data-variant", "brand");
    expect(mic).toHaveAttribute("data-size", "compact");
  });

  it("shows 'À toi de parler' once the opening line finishes, then 'Analyse de ta réponse...' while a reply is in flight", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await startViaButtonAfterBriefing();
    await endLatestSpeech();

    expect(screen.getByText("À toi de parler")).toBeInTheDocument();
    expect(screen.getByTestId("voice-input-stub")).toHaveAttribute("data-disabled", "false");

    // Not awaited: in real usage VoiceInput's onend calls onResult without
    // awaiting it either, so sendMessage() only runs synchronously up to its
    // first `await` here - exactly the window "Analyse de ta réponse..."
    // needs to be observed in.
    act(() => {
      void voiceInputState.current?.onResult("Let's watch a movie together!");
    });

    expect(screen.getByText("Analyse de ta réponse...")).toBeInTheDocument();

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(3));
    expect(screen.getByText("LinguaBot parle...")).toBeInTheDocument();
  });

  it("submits the learner's spoken answer and displays the AI's real reply", async () => {
    mockApi({ challenge: baseChallenge(), assistantMessage: "Great idea! What would you suggest?" });
    renderPage();
    await startViaButtonAfterBriefing();
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("Let's watch a movie together!");
    });

    expect(apiPostSpy).toHaveBeenCalledWith("/daily-challenge/message", {
      message: "Let's watch a movie together!",
      learnerBlocked: false,
    });
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(3));
    // Speech bubble dismissed once the reply finishes speaking, so the
    // transcript (shown by default for transcriptMode "auto") is the only
    // remaining match.
    await endLatestSpeech();
    expect(screen.getByText("Great idea! What would you suggest?")).toBeInTheDocument();
  });

  it("shows the help panel directly for a profile with helpVisibleByDefault, and a toggle button otherwise", async () => {
    mockApi({ challenge: baseChallenge({}, { helpVisibleByDefault: false, hintMode: "keywords" }) });
    renderPage();
    await startViaButtonAfterBriefing();

    expect(screen.getByRole("button", { name: "Besoin d'aide ?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Je suis bloqué/ })).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "Besoin d'aide ?" }).click();
    });

    expect(screen.getByRole("button", { name: /Je suis bloqué/ })).toBeInTheDocument();
  });

  it("shows a retryable error banner when sending a reply fails, and does not fabricate an assistant reply", async () => {
    const challenge = baseChallenge();
    apiGetSpy = vi.spyOn(api, "get").mockResolvedValue({ data: challenge });
    apiPostSpy = vi.spyOn(api, "post").mockImplementation((url: string) => {
      if (url === "/daily-challenge/start") return Promise.resolve({ data: { openingMessage: "Hello!" } });
      if (url === "/daily-challenge/message") {
        return Promise.reject({ isAxiosError: true, response: { status: 500 } });
      }
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });
    renderPage();
    await startViaButtonAfterBriefing();
    await endLatestSpeech();

    await act(async () => {
      await voiceInputState.current?.onResult("Let's watch a movie together!");
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("À toi de parler")).toBeInTheDocument();
  });

  it("keeps 'Terminer le défi' disabled until the learner has actually answered", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await startViaButtonAfterBriefing();

    expect(screen.getByRole("button", { name: "Terminer le défi" })).toBeDisabled();

    await endLatestSpeech();
    await act(async () => {
      await voiceInputState.current?.onResult("Let's watch a movie together!");
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Terminer le défi" })).toBeEnabled());
  });

  it("shows the real XP earned on the result screen after finishing", async () => {
    mockApi({ challenge: baseChallenge() });
    renderPage();
    await startViaButtonAfterBriefing();
    await endLatestSpeech();
    await act(async () => {
      await voiceInputState.current?.onResult("Let's watch a movie together!");
    });
    await endLatestSpeech();

    await act(async () => {
      screen.getByRole("button", { name: "Terminer le défi" }).click();
    });

    await waitFor(() => expect(screen.getByText("Défi relevé ! 🎉")).toBeInTheDocument());
    expect(screen.getByText(/\+120 XP/)).toBeInTheDocument();
  });

  it("shows the result screen directly when the challenge was already completed", async () => {
    mockApi({ challenge: baseChallenge({ completed: true, started: true }) });
    renderPage();

    await waitFor(() => expect(screen.getByText("Défi relevé ! 🎉")).toBeInTheDocument());
    expect(screen.getByText(/\+120 XP/)).toBeInTheDocument();
  });
});
