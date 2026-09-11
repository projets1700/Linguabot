import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { useAuthStore } from "../src/stores/authStore";
import { PlacementTestPage } from "../src/pages/PlacementTestPage";
import type { Me } from "../src/types";

// Same rationale/stand-ins as QuizModulePage.test.tsx.
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

vi.mock("../src/components/VoiceInput", () => ({
  VoiceInput: () => <div data-testid="voice-input-stub" />,
}));

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

let apiPostSpy: ReturnType<typeof vi.spyOn>;

function baseUser(): Me {
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
    placementTestCompleted: false,
    cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
  };
}

function renderPlacementTestPage() {
  return render(
    <MemoryRouter>
      <PlacementTestPage />
    </MemoryRouter>,
  );
}

function axiosLikeError(status: number) {
  return { isAxiosError: true, response: { status } };
}

describe("PlacementTestPage - network error handling (LOT 1)", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthStore.setState({ user: baseUser(), fetchMe: vi.fn() });

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
  });

  afterEach(() => {
    // @ts-expect-error test-only cleanup of a property defined above
    delete window.speechSynthesis;
    vi.unstubAllGlobals();
    apiPostSpy.mockRestore();
  });

  it("still navigates to /dashboard when the test was already completed (422)", async () => {
    apiPostSpy = vi.spyOn(api, "post").mockRejectedValue(axiosLikeError(422));
    renderPlacementTestPage();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not navigate away on a network/server error, and shows a retryable error instead", async () => {
    apiPostSpy = vi.spyOn(api, "post").mockRejectedValue(axiosLikeError(500));
    renderPlacementTestPage();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("retrying after a network error re-calls /placement-test/start", async () => {
    apiPostSpy = vi.spyOn(api, "post").mockRejectedValue(axiosLikeError(500));
    renderPlacementTestPage();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    apiPostSpy.mockClear();
    await act(async () => {
      screen.getByRole("button", { name: "Réessayer" }).click();
    });

    await waitFor(() => expect(apiPostSpy).toHaveBeenCalledWith("/placement-test/start"));
  });
});
