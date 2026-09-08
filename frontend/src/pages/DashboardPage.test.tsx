import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { DashboardPage } from "./DashboardPage";
import type { Me } from "../types";

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
    avgScore: null,
    placementTestCompleted: true,
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

describe("DashboardPage", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, fetchMe: vi.fn() });
  });

  it("shows a welcome/onboarding card for a learner with zero XP and zero sessions", () => {
    useAuthStore.setState({ user: baseUser() });

    renderDashboard();

    expect(screen.getByText(/Bienvenue, Adam/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commencer le quiz A0" })).toBeInTheDocument();
  });

  it("does not show the welcome card once the learner has any XP", () => {
    useAuthStore.setState({ user: baseUser({ totalXp: 50 }) });

    renderDashboard();

    expect(screen.queryByText(/Bienvenue, Adam/)).not.toBeInTheDocument();
  });

  it("does not show the welcome card once the learner has completed a session", () => {
    useAuthStore.setState({ user: baseUser({ sessionsCount: 1 }) });

    renderDashboard();

    expect(screen.queryByText(/Bienvenue, Adam/)).not.toBeInTheDocument();
  });

  it("always shows the stat cards, regardless of activity", () => {
    useAuthStore.setState({ user: baseUser() });

    renderDashboard();

    expect(screen.getByText("XP total")).toBeInTheDocument();
    expect(screen.getByText("Sessions complétées")).toBeInTheDocument();
  });
});
