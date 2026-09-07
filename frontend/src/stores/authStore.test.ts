import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { useAuthStore } from "./authStore";

vi.mock("../api/client", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, loading: false, error: null });
    vi.clearAllMocks();
  });

  it("stores the token and clears loading on successful login", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { token: "jwt-123" } });

    await useAuthStore.getState().login("adam@test.fr", "Password123!");

    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "adam@test.fr",
      password: "Password123!",
    });
    expect(useAuthStore.getState().token).toBe("jwt-123");
    expect(useAuthStore.getState().loading).toBe(false);
    expect(localStorage.getItem("token")).toBe("jwt-123");
  });

  it("sets an error and throws on failed login without storing a token", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("401"));

    await expect(useAuthStore.getState().login("adam@test.fr", "wrong")).rejects.toThrow();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().error).not.toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("does not store a token on register: the account only exists after email verification", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { message: "Vérifie ta boîte mail" } });

    await useAuthStore.getState().register({
      prenom: "Adam",
      nom: "Amrane",
      email: "adam@test.fr",
      password: "Password123!",
    });

    expect(api.post).toHaveBeenCalledWith("/auth/register", {
      prenom: "Adam",
      nom: "Amrane",
      email: "adam@test.fr",
      password: "Password123!",
    });
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("sets an error and throws on failed register", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("422"));

    await expect(
      useAuthStore.getState().register({
        prenom: "Adam",
        nom: "Amrane",
        email: "adam@test.fr",
        password: "Password123!",
      }),
    ).rejects.toThrow();

    expect(useAuthStore.getState().error).not.toBeNull();
  });

  it("stores the token returned by verifyEmail on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { token: "jwt-456" } });

    await useAuthStore.getState().verifyEmail("some-token");

    expect(api.post).toHaveBeenCalledWith("/auth/verify-email", { token: "some-token" });
    expect(useAuthStore.getState().token).toBe("jwt-456");
    expect(localStorage.getItem("token")).toBe("jwt-456");
  });

  it("surfaces an expiry-specific error when verifyEmail returns 410", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 410 } });

    await expect(useAuthStore.getState().verifyEmail("stale-token")).rejects.toThrow();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().error).toMatch(/expiré/);
  });

  it("surfaces a generic invalid-link error when verifyEmail fails for another reason", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 404 } });

    await expect(useAuthStore.getState().verifyEmail("bad-token")).rejects.toThrow();

    expect(useAuthStore.getState().error).toMatch(/invalide/);
  });

  it("fetchMe populates the user from /me", async () => {
    const me = { id: 1, prenom: "Adam", email: "adam@test.fr", level: { code: "A0" } };
    vi.mocked(api.get).mockResolvedValueOnce({ data: me });

    await useAuthStore.getState().fetchMe();

    expect(api.get).toHaveBeenCalledWith("/me");
    expect(useAuthStore.getState().user).toEqual(me);
  });

  it("logout clears the token, user and localStorage", () => {
    localStorage.setItem("token", "jwt-123");
    useAuthStore.setState({ token: "jwt-123", user: { id: 1 } as never });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
