import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./client";

// client.ts registers exactly one request interceptor unconditionally at
// module load (above), so `handlers` is never actually undefined here - the
// `!` reflects that, rather than papering over a real possibility. The
// minimal `{ url, headers: {} }` fixture below only needs to support plain
// property access (config.headers.Authorization), never AxiosHeaders' own
// methods, so it's asserted to the type the interceptor actually expects
// rather than constructed as a full AxiosHeaders instance.
function fulfilledRequest(config: { url: string; headers: Record<string, string> }) {
  return api.interceptors.request.handlers![0].fulfilled(config as InternalAxiosRequestConfig);
}

describe("api client request interceptor", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not attach a stale Authorization header to /auth/login or /auth/register", async () => {
    localStorage.setItem("token", "stale-expired-token");

    const loginConfig = await fulfilledRequest({ url: "/auth/login", headers: {} });
    const registerConfig = await fulfilledRequest({ url: "/auth/register", headers: {} });

    expect(loginConfig.headers.Authorization).toBeUndefined();
    expect(registerConfig.headers.Authorization).toBeUndefined();
  });

  it("does attach the token to other endpoints", async () => {
    localStorage.setItem("token", "a-valid-token");

    const config = await fulfilledRequest({ url: "/me", headers: {} });

    expect(config.headers.Authorization).toBe("Bearer a-valid-token");
  });
});
