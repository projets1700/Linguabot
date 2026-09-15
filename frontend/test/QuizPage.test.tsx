import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { QuizPage } from "../src/pages/QuizPage";
import { useAuthStore } from "../src/stores/authStore";
import type { Me } from "../src/types";

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

function renderQuizPage() {
  return render(
    <MemoryRouter initialEntries={["/quiz"]}>
      <Routes>
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
        <Route path="/quiz" element={<QuizPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuizPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["A0", "A1"])("loads and shows the modules for a %s learner", async (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: 1, code: "M0-1", title: "Salutations", questionCount: 10, passed: false }],
    });

    renderQuizPage();

    expect(screen.getByRole("heading", { name: "Test de vocabulaire" })).toBeInTheDocument();
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith("/quiz/modules"));
    await waitFor(() => expect(screen.getByText("Salutations")).toBeInTheDocument());
  });

  it.each(["A2", "B1", "B2"])("redirects a %s learner to the Dashboard without fetching modules", async (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: [] });

    renderQuizPage();

    await waitFor(() => expect(screen.getByText("Dashboard page")).toBeInTheDocument());
    expect(getSpy).not.toHaveBeenCalled();
  });
});
