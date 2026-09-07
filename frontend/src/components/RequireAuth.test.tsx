import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { RequireAuth } from "./RequireAuth";

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
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

  it("renders the protected content when a token is present", () => {
    useAuthStore.setState({ token: "jwt-123" });

    renderWithRouter();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
