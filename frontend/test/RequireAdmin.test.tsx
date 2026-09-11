import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../src/stores/authStore";
import { RequireAdmin } from "../src/components/RequireAdmin";
import type { Me } from "../src/types";

const BASE_USER: Me = {
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
  cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
};

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <p>Admin content</p>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "jwt-123", user: null, loading: false, error: null });
  });

  it("redirects a regular user to /dashboard", () => {
    useAuthStore.setState({ user: BASE_USER });

    renderWithRouter();

    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });

  it("renders the admin content for a ROLE_ADMIN user", () => {
    useAuthStore.setState({ user: { ...BASE_USER, role: "ROLE_ADMIN" } });

    renderWithRouter();

    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });
});
