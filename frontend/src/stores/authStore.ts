import { create } from "zustand";
import { api } from "../api/client";
import type { Me } from "../types";

type RegisterPayload = {
  prenom: string;
  nom: string;
  email: string;
  password: string;
};

type AuthState = {
  token: string | null;
  user: Me | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: null,
  loading: false,
  error: null,

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
      const response = await api.post("/auth/register", payload);
      localStorage.setItem("token", response.data.token);
      set({ token: response.data.token, loading: false });
    } catch {
      set({ loading: false, error: "Impossible de créer le compte." });
      throw new Error("register_failed");
    }
  },

  async fetchMe() {
    const response = await api.get<Me>("/me");
    set({ user: response.data });
  },

  logout() {
    localStorage.removeItem("token");
    set({ token: null, user: null });
  },
}));
