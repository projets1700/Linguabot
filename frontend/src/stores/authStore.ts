import { create } from "zustand";
import { api } from "../api/client";
import { preloadAvatarAssets } from "../lib/avatarAssets";
import type { AvatarType, Me } from "../types";

type RegisterPayload = {
  prenom: string;
  nom: string;
  email: string;
  password: string;
  avatarType: AvatarType;
};

type AuthState = {
  token: string | null;
  user: Me | null;
  loading: boolean;
  error: string | null;
  // Separate from `error` above (login/register/verifyEmail's own field,
  // read by LoginPage) - fetchMe() failing for a reason other than a
  // request-rejected 401 (a network blip, a 500) shouldn't leak an
  // unrelated message into the login form the next time it's read.
  fetchMeError: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: null,
  loading: false,
  error: null,
  fetchMeError: false,

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", response.data.token);
      set({ token: response.data.token, loading: false });
    } catch {
      set({ loading: false, error: "Email ou mot de passe incorrect." });
      throw new Error("login_failed");
    }
  },

  async register(payload) {
    set({ loading: true, error: null });
    try {
      // No token yet: the backend only stores a pending registration and
      // emails a verification link. The account (and the token) only exist
      // once verifyEmail() below runs.
      await api.post("/auth/register", payload);
      set({ loading: false });
    } catch {
      set({ loading: false, error: "Impossible de créer le compte." });
      throw new Error("register_failed");
    }
  },

  async verifyEmail(token) {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/auth/verify-email", { token });
      localStorage.setItem("token", response.data.token);
      set({ token: response.data.token, loading: false });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const message =
        status === 410
          ? "Ce lien a expiré. Merci de vous réinscrire."
          : "Ce lien de vérification est invalide.";
      set({ loading: false, error: message });
      throw new Error("verify_email_failed");
    }
  },

  async fetchMe() {
    set({ fetchMeError: false });
    try {
      const response = await api.get<Me>("/me");
      set({ user: response.data });
      // Warms the loader cache for this learner's avatar (~30MB of GLB/FBX)
      // as early as possible - by the time they actually reach a page that
      // renders AvatarScene, it can mount near-instantly instead of leaving
      // the avatar blank for a couple of seconds while speech (unaware of
      // the avatar's own loading state) has already started.
      preloadAvatarAssets(response.data.avatarType);
    } catch {
      // A 401 here already triggers the api client's own logout+redirect
      // (see api/client.ts's response interceptor) - this only matters for
      // everything else (network blip, 500): without it, `user` never
      // resolves and RequireAuth was stuck on "Chargement..." forever, with
      // no way to know why or retry.
      set({ fetchMeError: true });
    }
  },

  logout() {
    localStorage.removeItem("token");
    set({ token: null, user: null, fetchMeError: false });
  },
}));
