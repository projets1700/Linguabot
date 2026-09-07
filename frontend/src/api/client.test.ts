import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./client";

describe("api client request interceptor", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not attach a stale Authorization header to /auth/login or /auth/register", async () => {
    localStorage.setItem("token", "stale-expired-token");

    const loginConfig = await api.interceptors.request.handlers[0].fulfilled({
      url: "/auth/login",
      headers: {},
    });
    const registerConfig = await api.interceptors.request.handlers[0].fulfilled({
      url: "/auth/register",
      headers: {},
    });

    expect(loginConfig.headers.Authorization).toBeUndefined();
    expect(registerConfig.headers.Authorization).toBeUndefined();
  });

  it("does attach the token to other endpoints", async () => {
    localStorage.setItem("token", "a-valid-token");

    const config = await api.interceptors.request.handlers[0].fulfilled({
      url: "/me",
      headers: {},
    });

    expect(config.headers.Authorization).toBe("Bearer a-valid-token");
  });
});
