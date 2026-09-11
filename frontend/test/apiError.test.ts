import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { normalizeApiError } from "../src/lib/apiError";

function axiosError(overrides: { status?: number; code?: string; hasResponse?: boolean }): AxiosError {
  const { status, code, hasResponse = status !== undefined } = overrides;
  const error = new AxiosError(
    "request failed",
    code,
    { headers: new AxiosHeaders() },
    {},
    hasResponse
      ? {
          status: status!,
          statusText: "",
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: {},
        }
      : undefined,
  );
  return error;
}

describe("normalizeApiError", () => {
  it("classifies a response-less ECONNABORTED error as timeout", () => {
    const result = normalizeApiError(axiosError({ code: "ECONNABORTED" }));
    expect(result.kind).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("classifies any other response-less error as offline", () => {
    const result = normalizeApiError(axiosError({ code: "ERR_NETWORK" }));
    expect(result.kind).toBe("offline");
    expect(result.retryable).toBe(true);
  });

  it("classifies a 401 as unauthorized and non-retryable", () => {
    const result = normalizeApiError(axiosError({ status: 401 }));
    expect(result.kind).toBe("unauthorized");
    expect(result.status).toBe(401);
    expect(result.retryable).toBe(false);
  });

  it("classifies a 429 as rate_limit and retryable", () => {
    const result = normalizeApiError(axiosError({ status: 429 }));
    expect(result.kind).toBe("rate_limit");
    expect(result.retryable).toBe(true);
  });

  it("classifies a 500 as server and retryable", () => {
    const result = normalizeApiError(axiosError({ status: 500 }));
    expect(result.kind).toBe("server");
    expect(result.retryable).toBe(true);
  });

  it("classifies a 503 as server too", () => {
    const result = normalizeApiError(axiosError({ status: 503 }));
    expect(result.kind).toBe("server");
  });

  it("classifies an unhandled status (e.g. 422 business rule) as unknown and non-retryable", () => {
    const result = normalizeApiError(axiosError({ status: 422 }));
    expect(result.kind).toBe("unknown");
    expect(result.retryable).toBe(false);
  });

  it("classifies a non-Axios error as unknown", () => {
    const result = normalizeApiError(new Error("boom"));
    expect(result.kind).toBe("unknown");
  });

  it("gives every kind a non-empty, distinct message", () => {
    const messages = [
      normalizeApiError(axiosError({ code: "ECONNABORTED" })),
      normalizeApiError(axiosError({ code: "ERR_NETWORK" })),
      normalizeApiError(axiosError({ status: 401 })),
      normalizeApiError(axiosError({ status: 429 })),
      normalizeApiError(axiosError({ status: 500 })),
      normalizeApiError(axiosError({ status: 422 })),
    ].map((error) => error.message);

    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(messages.length);
  });
});
