import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LearnerNav } from "../src/components/LearnerNav";
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

function renderNav() {
  return render(
    <MemoryRouter>
      <LearnerNav />
    </MemoryRouter>,
  );
}

describe("LearnerNav - Test de vocabulaire link visibility past A1", () => {
  it.each(["A0", "A1"])("still shows the Test de vocabulaire link for a %s learner", (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    renderNav();
    expect(screen.getByRole("link", { name: "Test de vocabulaire" })).toBeInTheDocument();
  });

  it.each(["A2", "B1", "B2"])("hides the Test de vocabulaire link for a %s learner", (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    renderNav();
    expect(screen.queryByRole("link", { name: "Test de vocabulaire" })).not.toBeInTheDocument();
  });

  it("still shows every other nav entry when the Test de vocabulaire link is hidden", () => {
    useAuthStore.setState({ user: baseUser("B2") });
    renderNav();
    expect(screen.getByRole("link", { name: "Accueil" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scénarios" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Défis" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Progression" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profil" })).toBeInTheDocument();
  });
});
