import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { LoginPage } from "./LoginPage";

vi.mock("../api/client", () => ({
  api: { post: vi.fn(), get: vi.fn() },
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, loading: false, error: null });
    vi.clearAllMocks();
  });

  it("logs in and navigates to the dashboard on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { token: "jwt-123" } });
    const user = userEvent.setup();

    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "adam@test.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "adam@test.fr",
      password: "Password123!",
    });
  });

  it("shows an error message and stays on the page when login fails", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("401"));
    const user = userEvent.setup();

    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "adam@test.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "wrong");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Email ou mot de passe incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });
});
