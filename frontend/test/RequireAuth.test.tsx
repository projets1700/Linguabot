import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { useAuthStore } from "../src/stores/authStore";
import { RequireAuth } from "../src/components/RequireAuth";
import type { Me } from "../src/types";

vi.mock("../src/api/client", () => ({
  api: { get: vi.fn() },
}));

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
  onboardingCompleted: true,
  placementTestCompleted: true,
  cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
};

// /onboarding and /placement-test are nested under the SAME RequireAuth
// layout as /dashboard - matching App.tsx's real route tree (one
// RequireAuth layout wrapping every protected route via Outlet), not each
// wrapped in its own separate, independent RequireAuth. This is what
// actually exercises the mutual-exclusion between the two gates: nesting
// them independently previously masked a real infinite-redirect-loop bug
// (a fresh registration has both flags false at once; the onboarding gate
// sent it to /onboarding, then the placement gate's own check - still
// seeing pathname !== "/placement-test" - bounced it to /placement-test,
// whose onboarding check then bounced it straight back), only caught by
// live browser verification, not by the previous, more lenient test setup.
function renderWithRouter(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route element={<RequireAuth><Outlet /></RequireAuth>}>
          <Route path="/onboarding" element={<p>Onboarding page</p>} />
          <Route path="/placement-test" element={<p>Placement test page</p>} />
          <Route path="/dashboard" element={<p>Protected content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, loading: false, error: null, fetchMeError: false });
    vi.mocked(api.get).mockReset();
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

  // Audit A1/P0-01: onboarding ("meet the teacher") must happen before the
  // graded placement test, not after it.
  it("redirects to /onboarding when the user has not completed it yet", () => {
    useAuthStore.setState({
      token: "jwt-123",
      user: { ...BASE_USER, onboardingCompleted: false },
    });

    renderWithRouter();

    expect(screen.getByText("Onboarding page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("sends a learner who has done neither to /onboarding first, not /placement-test", () => {
    useAuthStore.setState({
      token: "jwt-123",
      user: { ...BASE_USER, onboardingCompleted: false, placementTestCompleted: false },
    });

    renderWithRouter();

    expect(screen.getByText("Onboarding page")).toBeInTheDocument();
  });

  it("does not gate ROLE_ADMIN accounts behind onboarding", () => {
    useAuthStore.setState({
      token: "jwt-123",
      user: { ...BASE_USER, role: "ROLE_ADMIN", onboardingCompleted: false },
    });

    renderWithRouter();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows a retry-able error instead of a permanent loading screen when fetchMe fails", async () => {
    // Regression: fetchMe() had no error handling, so a network/API
    // failure (not a 401 - that path already redirects via the api client's
    // own interceptor) left `user` unresolved forever - the protected route
    // was stuck on "Chargement..." indefinitely, with no way to recover.
    vi.mocked(api.get).mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({ data: BASE_USER });
    useAuthStore.setState({ token: "jwt-123", user: null });

    renderWithRouter();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
  });
});
