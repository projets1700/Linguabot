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

  it("stores the token returned by register", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { token: "jwt-456" } });

    await useAuthStore.getState().register({
      prenom: "Adam",
      nom: "Amrane",
      email: "adam@test.fr",
      password: "Password123!",
    });

    expect(useAuthStore.getState().token).toBe("jwt-456");
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
