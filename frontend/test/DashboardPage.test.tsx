import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { useAuthStore } from "../src/stores/authStore";
import { DashboardPage } from "../src/pages/DashboardPage";
import type { Me } from "../src/types";

// DashboardPage's own voice-driven flow (readiness, destination choice) is
// what these tests exercise - AvatarScene's 3D internals and
// AvatarSpeechBubble's own reveal/linger timing are each already covered by
// their own test files, so both are replaced with light stand-ins here:
// AvatarScene fires onReady once (like a fast-loading avatar) instead of
// needing jsdom's missing ResizeObserver/WebGL, and AvatarSpeechBubble just
// renders the line it was given while active.
const avatarSceneMountCount = vi.hoisted(() => ({ current: 0 }));
vi.mock("../src/components/AvatarScene", () => ({
  AvatarScene: ({ onReady }: { onReady?: () => void }) => {
    const firedRef = useRef(false);
    useEffect(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onReady?.();
    });
    // Tracks actual mount/unmount (an empty-deps effect only re-runs across
    // a real unmount+remount, unlike the render-body itself) - the ~30MB
    // GLB/FBX this stands in for must load exactly once per browser
    // session, never reload just because the Dashboard's intro transitions.
    useEffect(() => {
      avatarSceneMountCount.current += 1;
    }, []);
    return <div data-testid="avatar-scene-stub" />;
  },
}));

vi.mock("../src/components/AvatarSpeechBubble", () => ({
  AvatarSpeechBubble: ({ text, active }: { text: string | null; active: boolean }) =>
    active && text ? <div role="status">{text}</div> : null,
}));

// VoiceInput's own graceful-degradation behavior (unsupported browser,
// permission refused) is covered by its own test file - jsdom has no
// SpeechRecognition at all, so a real VoiceInput here would only ever
// render its "not supported" message. This stand-in exposes the latest
// onResult/disabled props directly so tests can simulate a transcript
// exactly the way a real recognized utterance would arrive.
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

function fakeVoice(voiceURI: string, lang = "fr-FR"): SpeechSynthesisVoice {
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

// speakText() waits on a (normally instant) voice-list promise before
// actually calling speechSynthesis.speak() - same helper/rationale as
// speech.test.ts.
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
    level: { code: "A1", name: "Grands débuts", xpThreshold: 300 },
    avatarType: "male",
    totalXp: 50,
    sessionsCount: 1,
    avgScore: null,
    onboardingCompleted: true,
    placementTestCompleted: true,
    cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
    ...overrides,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

// Drives the component all the way from a fresh mount (starts on "intro" -
// beforeEach below clears sessionStorage before every test, so the intro
// hasn't been seen yet this "session") through to "dashboard" phase, the
// same way a learner clicking "Continuer sans parler" would - for tests
// that only care about the dashboard-phase behavior (destination voice
// commands, card clicks).
async function enterDashboardPhase(overrides: Partial<Me> = {}): Promise<ReturnType<typeof renderDashboard>> {
  useAuthStore.setState({ user: baseUser(overrides) });
  const result = renderDashboard();
  await flushMicrotasks();
  await endLatestSpeech();

  await act(async () => {
    screen.getByRole("button", { name: /Continuer sans parler/ }).click();
  });
  await waitFor(() => expect(screen.getByRole("heading", { name: /Choisir une activité/ })).toBeInTheDocument(), {
    timeout: 2000,
  });
  await waitFor(() => expect(speak.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 2000 });
  // Ends the "Par quoi commençons-nous aujourd'hui ?" question too, so the
  // mic is enabled (avatarState back to idle) before the test fires its own
  // voice result.
  await endLatestSpeech();
  return result;
}

describe("DashboardPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    voiceInputState.current = null;
    avatarSceneMountCount.current = 0;
    navigateMock.mockReset();
    useAuthStore.setState({ user: null, fetchMe: vi.fn(), fetchMeError: false });
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

    // jsdom has no Web Speech API at all - minimal fake so `new
    // SpeechSynthesisUtterance(...)` doesn't throw.
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

  it("shows only the immersive intro (no cards, no dashboard content) on first arrival", async () => {
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();

    expect(screen.queryByText(/Choisir une activité/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Défi du jour/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuer sans parler/ })).toBeInTheDocument();
  });

  it("greets the learner by their real first name, not a hardcoded one", async () => {
    useAuthStore.setState({ user: baseUser({ prenom: "Chloé" }) });
    renderDashboard();
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Bonjour Chloé. Prêt pour ton cours d'anglais aujourd'hui ?");
    expect(screen.getByRole("status")).toHaveTextContent("Bonjour Chloé");
  });

  it("falls back to a generic greeting when no first name is available", async () => {
    useAuthStore.setState({ user: baseUser({ prenom: "" }) });
    renderDashboard();
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Bonjour. Prêt pour ton cours d'anglais aujourd'hui ?");
  });

  it("keeps the mic disabled while the avatar is greeting, then enables it once it finishes", async () => {
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();

    expect(voiceInputState.current?.disabled).toBe(true);

    await endLatestSpeech();

    expect(voiceInputState.current?.disabled).toBe(false);
  });

  it("transitions to the dashboard after a recognized ready reply, and asks what to start with", async () => {
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("oui");
    });

    // RevealSection mounts its content immediately (only ever CSS-fades it -
    // see the accessibility note in DashboardPage.tsx), so the heading
    // itself appears right when `phase` flips; the "what next" question is
    // only spoken once the CSS transition's own timer has actually elapsed.
    await waitFor(() => expect(screen.getByRole("heading", { name: /Choisir une activité/ })).toBeInTheDocument(), {
      timeout: 2000,
    });
    await waitFor(() => expect(speak.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 2000 });

    expect(latestUtterance().text).toBe("Par quoi commençons-nous aujourd'hui ?");
  });

  it("never remounts the avatar across the intro -> dashboard transition", async () => {
    // The avatar's ~30MB of GLB/FBX assets must load exactly once per
    // browser session - a remount here would mean the Dashboard silently
    // reloads them right as the learner reaches it, which is exactly what
    // the single-persistent-instance requirement exists to prevent.
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();
    expect(avatarSceneMountCount.current).toBe(1);
    await endLatestSpeech();

    await act(async () => {
      screen.getByRole("button", { name: /Continuer sans parler/ }).click();
    });
    await waitFor(() => expect(screen.getByRole("heading", { name: /Choisir une activité/ })).toBeInTheDocument(), {
      timeout: 2000,
    });

    expect(avatarSceneMountCount.current).toBe(1);
  });

  it("does not transition on an unrelated reply, and asks the learner to retry", async () => {
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();
    await endLatestSpeech();

    await act(async () => {
      voiceInputState.current?.onResult("je ne sais pas trop");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Je n'ai pas bien compris. Tu peux dire oui, ou continuer avec le bouton.");
    expect(screen.queryByText(/Choisir une activité/)).not.toBeInTheDocument();
  });

  it("lets the learner skip straight to the dashboard without speaking at all", async () => {
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();

    await act(async () => {
      screen.getByRole("button", { name: /Continuer sans parler/ }).click();
    });

    await waitFor(() => expect(screen.getByRole("heading", { name: /Choisir une activité/ })).toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it("does not replay the guided intro on a later arrival within the same session", async () => {
    // One session = one login: once the intro has been skipped/completed
    // once, navigating away and back to /dashboard (which remounts this
    // component) lands straight on the cards instead of replaying the
    // classroom greeting again.
    const first = await enterDashboardPhase();
    first.unmount();

    const speakCallsBeforeSecondMount = speak.mock.calls.length;
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();

    expect(screen.getByRole("heading", { name: /Choisir une activité/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuer sans parler/ })).not.toBeInTheDocument();
    // No greeting, no "what next" question - a silent return to the cards.
    expect(speak.mock.calls.length).toBe(speakCallsBeforeSecondMount);
  });

  it("plays the guided intro again after logging out and back in, even in the same tab", async () => {
    const first = await enterDashboardPhase();
    first.unmount();

    // logout() itself clears the intro-seen flag (see authStore.ts) - a
    // fresh login is a fresh session even though sessionStorage is
    // otherwise still scoped to this same tab.
    useAuthStore.getState().logout();

    const speakCallsBeforeSecondMount = speak.mock.calls.length;
    useAuthStore.setState({ user: baseUser() });
    renderDashboard();
    await flushMicrotasks();

    expect(screen.getByRole("button", { name: /Continuer sans parler/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Choisir une activité/ })).not.toBeInTheDocument();
    expect(speak.mock.calls.length).toBeGreaterThan(speakCallsBeforeSecondMount);
  });

  it("recognizes a spoken destination, confirms it aloud, then navigates only once the confirmation finishes", async () => {
    await enterDashboardPhase();

    await act(async () => {
      voiceInputState.current?.onResult("le quiz");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Très bien, commençons le quiz.");
    expect(navigateMock).not.toHaveBeenCalled();

    await endLatestSpeech();

    expect(navigateMock).toHaveBeenCalledWith("/quiz");
  });

  it("gives distinct confirmations for progression and trophies despite sharing a route", async () => {
    await enterDashboardPhase();

    await act(async () => {
      voiceInputState.current?.onResult("mes trophées");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe("Allons voir tes trophées.");
    await endLatestSpeech();
    expect(navigateMock).toHaveBeenCalledWith("/trophees");
  });

  it("does not navigate on an unrecognized destination, and asks the learner to retry", async () => {
    await enterDashboardPhase();

    await act(async () => {
      voiceInputState.current?.onResult("je veux travailler un peu");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).toBe(
      "Je n'ai pas compris ton choix. Tu peux dire par exemple : Scénarios, Quiz, Défi du jour ou Progression.",
    );

    await endLatestSpeech();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("still lets a negated request fall through to the retry prompt instead of matching the negated word", async () => {
    await enterDashboardPhase();

    await act(async () => {
      voiceInputState.current?.onResult("je ne veux pas faire le quiz");
    });
    await flushMicrotasks();

    expect(latestUtterance().text).not.toBe("Très bien, commençons le quiz.");
    await endLatestSpeech();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("keeps every dashboard card clickable on its own, with no vocal confirmation required", async () => {
    await enterDashboardPhase();

    expect(screen.getByRole("link", { name: /Quiz vocal/ })).toHaveAttribute("href", "/quiz");
    expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("link", { name: /Badges & trophées/ })).toHaveAttribute("href", "/trophees");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows a retry option instead of an infinite spinner when the profile fails to load", async () => {
    useAuthStore.setState({ user: null, fetchMeError: true });
    renderDashboard();

    expect(screen.getByText("Impossible de charger ton profil.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  describe("first-time onboarding (LOT 2, folded into the existing intro)", () => {
    it("asks for the learner's name in English before the usual French greeting", async () => {
      useAuthStore.setState({ user: baseUser({ onboardingCompleted: false }) });
      renderDashboard();
      await flushMicrotasks();

      expect(latestUtterance().text).toBe("Hello! I'm LinguaBot, your English teacher. What's your name?");
    });

    it("re-asks the name question when the reply is empty or unintelligible", async () => {
      useAuthStore.setState({ user: baseUser({ onboardingCompleted: false }) });
      renderDashboard();
      await flushMicrotasks();
      await endLatestSpeech();

      await act(async () => {
        voiceInputState.current?.onResult("um uh");
      });
      await flushMicrotasks();

      expect(latestUtterance().text).toBe("Hello! I'm LinguaBot, your English teacher. What's your name?");
    });

    it("acknowledges with the account's real first name, never the raw transcript", async () => {
      useAuthStore.setState({ user: baseUser({ onboardingCompleted: false, prenom: "Adam" }) });
      renderDashboard();
      await flushMicrotasks();
      await endLatestSpeech();

      await act(async () => {
        voiceInputState.current?.onResult("My name is Adam");
      });
      await flushMicrotasks();

      expect(latestUtterance().text).toBe("Nice to meet you, Adam! Are you ready to start?");
      expect(latestUtterance().text).not.toContain("My name is Adam");
    });

    it("completes onboarding and transitions to the dashboard cards on an affirmative reply", async () => {
      useAuthStore.setState({ user: baseUser({ onboardingCompleted: false }) });
      renderDashboard();
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
      await waitFor(() => expect(screen.getByRole("heading", { name: /Choisir une activité/ })).toBeInTheDocument(), {
        timeout: 2000,
      });
    });

    it("does not call the API or transition on a negative reply", async () => {
      useAuthStore.setState({ user: baseUser({ onboardingCompleted: false }) });
      renderDashboard();
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
      expect(screen.queryByRole("heading", { name: /Choisir une activité/ })).not.toBeInTheDocument();
    });

    it("reformulates once on an ambiguous readiness reply, then repeats it, never defaulting to yes", async () => {
      useAuthStore.setState({ user: baseUser({ onboardingCompleted: false }) });
      renderDashboard();
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
  });
});
