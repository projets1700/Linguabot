import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api",
  // Generous enough for an AI reply under normal load, but bounded so a
  // hung connection surfaces as a retryable timeout (see lib/apiError.ts)
  // instead of leaving a page stuck on "..." forever.
  timeout: 20000,
});

// Auth endpoints must stay anonymous: they're PUBLIC_ACCESS on the backend,
// but Symfony's JWT authenticator rejects the *entire* request with 401 the
// moment it sees a Bearer header, even an expired/stale one - before
// access_control ever gets to check that the route is public. A leftover
// token from a previous session would otherwise silently break register/login.
const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/auth/verify-email"];

api.interceptors.request.use((config) => {
  const isPublicAuthRoute = PUBLIC_PATHS.some((path) => config.url?.startsWith(path));
  const token = isPublicAuthRoute ? null : localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// If the backend ever returns 401 outside of login/register (typically an
// expired token on a protected route), log the user out so they're not
// stuck retrying with credentials that will never work again. Imported
// lazily inside the callback (not at module scope) to sidestep the
// client.ts <-> authStore.ts circular import - by the time a request
// actually runs, both modules have finished loading.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isPublicAuthRoute = PUBLIC_PATHS.some((path) => error.config?.url?.startsWith(path));
    if (error.response?.status === 401 && !isPublicAuthRoute) {
      const { useAuthStore } = await import("../stores/authStore");
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);
