import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { QuizPage } from "../src/pages/QuizPage";
import { useAuthStore } from "../src/stores/authStore";
import type { Me, QuizModule, QuizModulesResponse } from "../src/types";

function baseUser(levelCode: string): Me {
  return {
    id: 1,
    prenom: "Adam",
    nom: "Amrane",
    email: "adam@test.fr",
    role: "ROLE_USER",
    level: { code: levelCode, name: levelCode, xpThreshold: 0 },
    avatarType: "male",
    totalXp: 0,
    sessionsCount: 0,
    onboardingCompleted: true,
    placementTestCompleted: true,
    cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
  };
}

function makeModule(overrides: Partial<QuizModule> = {}): QuizModule {
  return {
    id: 1,
    code: "M0-1",
    title: "Salutations",
    questionCount: 10,
    passed: false,
    attempted: false,
    bestScore: null,
    ...overrides,
  };
}

function mockModules(response: Partial<QuizModulesResponse> & { modules: QuizModule[] }) {
  return vi.spyOn(api, "get").mockResolvedValue({
    data: {
      passThreshold: 7,
      requiredForLevelUp: 4,
      targetLevelCode: "A1",
      ...response,
    },
  });
}

function renderQuizPage() {
  return render(
    <MemoryRouter initialEntries={["/quiz"]}>
      <Routes>
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/quiz/:moduleId" element={<p>Quiz module page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuizPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a never-attempted module as 'À commencer', with no score shown", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({ modules: [makeModule()] });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("Salutations")).toBeInTheDocument());
    expect(screen.getByText("À commencer")).toBeInTheDocument();
    expect(screen.queryByText(/Score/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Commencer/ })).toHaveAttribute("href", "/quiz/1");
  });

  it("shows an attempted-but-failed module as 'À retenter' with its best score and remaining answers needed", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({ modules: [makeModule({ attempted: true, passed: false, bestScore: 4 })] });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("À retenter")).toBeInTheDocument());
    expect(screen.getByText("Score : 4/10")).toBeInTheDocument();
    // passThreshold (7) - bestScore (4) = 3 remaining correct answers.
    expect(screen.getByText("Encore 3 bonnes réponses pour valider")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Réessayer/ })).toHaveAttribute("href", "/quiz/1");
  });

  it("never shows a negative remaining-answers count even at the threshold boundary", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    // score 6, threshold 7 -> exactly 1 remaining, singular wording.
    mockModules({ modules: [makeModule({ attempted: true, passed: false, bestScore: 6 })] });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("À retenter")).toBeInTheDocument());
    expect(screen.getByText("Encore 1 bonne réponse pour valider")).toBeInTheDocument();
  });

  it("shows a passed module as 'Validé' with its best score and a Rejouer CTA", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({ modules: [makeModule({ attempted: true, passed: true, bestScore: 9 })] });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("Validé")).toBeInTheDocument());
    expect(screen.getByText("Score : 9/10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Rejouer/ })).toHaveAttribute("href", "/quiz/1");
  });

  it("computes progression against requiredForLevelUp, not the total module count", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({
      modules: [
        makeModule({ id: 1, code: "M0-1", title: "Salutations", passed: true, attempted: true, bestScore: 10 }),
        makeModule({ id: 2, code: "M0-2", title: "Chiffres", passed: true, attempted: true, bestScore: 8 }),
        makeModule({ id: 3, code: "M0-3", title: "Couleurs" }),
        makeModule({ id: 4, code: "M0-4", title: "Famille" }),
        makeModule({ id: 5, code: "M0-5", title: "Nourriture" }),
        makeModule({ id: 6, code: "M0-6", title: "Objets" }),
      ],
      requiredForLevelUp: 4,
    });

    renderQuizPage();

    // 2 passed / 4 required = 50%, not 2 passed / 6 total = 33%.
    await waitFor(() => expect(screen.getByText("2 / 4 requis")).toBeInTheDocument());
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("shows 0/4 progression for a learner with nothing passed yet", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({ modules: [makeModule()], requiredForLevelUp: 4 });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("0 / 4 requis")).toBeInTheDocument());
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("caps progression at 100% once requiredForLevelUp modules are passed", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({
      modules: [
        makeModule({ id: 1, code: "M0-1", passed: true, attempted: true, bestScore: 10 }),
        makeModule({ id: 2, code: "M0-2", title: "Chiffres", passed: true, attempted: true, bestScore: 10 }),
        makeModule({ id: 3, code: "M0-3", title: "Couleurs", passed: true, attempted: true, bestScore: 10 }),
        makeModule({ id: 4, code: "M0-4", title: "Famille", passed: true, attempted: true, bestScore: 10 }),
      ],
      requiredForLevelUp: 4,
    });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("4 / 4 requis")).toBeInTheDocument());
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("adapts the header and progression copy for an A1 learner who already unlocked the target level", async () => {
    useAuthStore.setState({ user: baseUser("A1") });
    mockModules({ modules: [makeModule()], targetLevelCode: "A1" });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("Modules validés")).toBeInTheDocument());
    expect(screen.queryByText(/Progression vers/)).not.toBeInTheDocument();
    expect(screen.getByText(/Niveau A1 déjà débloqué/)).toBeInTheDocument();
  });

  it("navigates to the module page when a module's CTA is followed", async () => {
    useAuthStore.setState({ user: baseUser("A0") });
    mockModules({ modules: [makeModule({ id: 42 })] });

    renderQuizPage();

    const link = await screen.findByRole("link", { name: /Commencer/ });
    await act(async () => {
      link.click();
    });

    await waitFor(() => expect(screen.getByText("Quiz module page")).toBeInTheDocument());
  });

  it.each(["A0", "A1"])("loads the modules for a %s learner", async (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    const getSpy = mockModules({ modules: [makeModule()] });

    renderQuizPage();

    expect(screen.getByRole("heading", { name: "Test de vocabulaire" })).toBeInTheDocument();
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith("/quiz/modules"));
    await waitFor(() => expect(screen.getByText("Salutations")).toBeInTheDocument());
  });

  it.each(["A2", "B1", "B2"])("redirects a %s learner to the Dashboard without fetching modules", async (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { modules: [] } });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("Dashboard page")).toBeInTheDocument());
    expect(getSpy).not.toHaveBeenCalled();
  });
});
