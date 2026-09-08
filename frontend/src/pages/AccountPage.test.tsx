import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { AccountPage } from "./AccountPage";
import type { Me } from "../types";

vi.mock("../api/client", () => ({
  api: { get: vi.fn(), delete: vi.fn() },
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
  avgScore: null,
  placementTestCompleted: true,
};

function renderAccountPage() {
  return render(
    <MemoryRouter initialEntries={["/mon-compte"]}>
      <Routes>
        <Route path="/mon-compte" element={<AccountPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: "jwt-123", user: BASE_USER });
    vi.clearAllMocks();
    // jsdom doesn't implement these at all - patched directly onto the real
    // URL constructor (not vi.stubGlobal("URL", ...), which would replace
    // the constructor itself and break `new URL(...)` for anything else
    // that needs it, react-router's own history handling included).
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
  });

  it("downloads the export on click", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { profile: { prenom: "Adam" } } });
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Télécharger mes données" }));

    expect(api.get).toHaveBeenCalledWith("/me/export");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("shows a retry-able error when the export request fails", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("network error"));
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Télécharger mes données" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Échec du téléchargement.");
  });

  it("requires typing a password before the delete confirmation button is enabled", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));

    expect(screen.getByRole("button", { name: "Confirmer la suppression" })).toBeDisabled();
  });

  it("logs out and redirects to /login with a confirmation on a correct password", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { message: "Compte supprimé." } });
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    await user.type(screen.getByLabelText("Confirme avec ton mot de passe"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledWith("/me", { data: { password: "Password123!" } });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("shows an incorrect-password error without navigating away on a 422", async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { status: 422 } });
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    await user.type(screen.getByLabelText("Confirme avec ton mot de passe"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    expect(await screen.findByText("Mot de passe incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("jwt-123");
  });

  it("cancels the confirmation and clears the typed password", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    await user.type(screen.getByLabelText("Confirme avec ton mot de passe"), "something");
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.getByRole("button", { name: "Supprimer mon compte" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Confirme avec ton mot de passe")).not.toBeInTheDocument();
  });
});
