import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { RequireAuth } from "./RequireAuth";
import type { Me } from "../types";

const BASE_USER: Me = {
  id: 1,
  prenom: "Adam",
  nom: "Amrane",
  email: "adam@test.fr",
  role: "ROLE_USER",
  level: { code: "A0", name: "Débutant absolu", xpThreshold: 0 },
  totalXp: 0,
  sessionsCount: 0,
  avgScore: null,
  placementTestCompleted: true,
};

function renderWithRouter(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/placement-test" element={<p>Placement test page</p>} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <p>Protected content</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, loading: false, error: null });
  });

  it("redirects to /login when there is no token", () => {
    renderWithRouter();

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content when a token is present and the placement test is completed", () => {
    useAuthStore.setState({ token: "jwt-123", user: BASE_USER });

    renderWithRouter();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /placement-test when the user has not completed it yet", () => {
    useAuthStore.setState({
      token: "jwt-123",
      user: { ...BASE_USER, placementTestCompleted: false },
    });

    renderWithRouter();

    expect(screen.getByText("Placement test page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("does not gate ROLE_ADMIN accounts behind the placement test", () => {
    useAuthStore.setState({
      token: "jwt-123",
      user: { ...BASE_USER, role: "ROLE_ADMIN", placementTestCompleted: false },
    });

    renderWithRouter();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
