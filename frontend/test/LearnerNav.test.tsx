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

describe("LearnerNav - Vocabulary Test link visibility past A1", () => {
  it.each(["A0", "A1"])("still shows the Vocabulary Test link for a %s learner", (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    renderNav();
    expect(screen.getByRole("link", { name: "Vocabulary Test" })).toBeInTheDocument();
  });

  it.each(["A2", "B1", "B2"])("hides the Vocabulary Test link for a %s learner", (levelCode) => {
    useAuthStore.setState({ user: baseUser(levelCode) });
    renderNav();
    expect(screen.queryByRole("link", { name: "Vocabulary Test" })).not.toBeInTheDocument();
  });

  it("still shows every other nav entry when the Vocabulary Test link is hidden", () => {
    useAuthStore.setState({ user: baseUser("B2") });
    renderNav();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Challenges" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adventure" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });
});
