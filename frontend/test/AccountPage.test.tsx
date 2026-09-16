import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { useAuthStore } from "../src/stores/authStore";
import { AccountPage } from "../src/pages/AccountPage";
import type { Me } from "../src/types";

vi.mock("../src/api/client", () => ({
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
  onboardingCompleted: true,
  placementTestCompleted: true,
  cecrlProfile: { transcriptMode: "auto", translationMode: "visible", hintMode: "fullAnswer", helpVisibleByDefault: true },
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
    await user.click(screen.getByRole("button", { name: "Download my data" }));

    expect(api.get).toHaveBeenCalledWith("/me/export");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("shows a retry-able error when the export request fails", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("network error"));
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Download my data" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Download failed.");
  });

  it("requires typing a password before the delete confirmation button is enabled", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(screen.getByRole("button", { name: "Confirm deletion" })).toBeDisabled();
  });

  it("logs out and redirects to /login with a confirmation on a correct password", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { message: "Account deleted." } });
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.type(screen.getByLabelText("Confirm with your password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledWith("/me", { data: { password: "Password123!" } });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("shows an incorrect-password error without navigating away on a 422", async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { status: 422 } });
    const user = userEvent.setup();

    renderAccountPage();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.type(screen.getByLabelText("Confirm with your password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));

    expect(await screen.findByText("Incorrect password.")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("jwt-123");
  });

  it("cancels the confirmation and clears the typed password", async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.type(screen.getByLabelText("Confirm with your password"), "something");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm with your password")).not.toBeInTheDocument();
  });
});
