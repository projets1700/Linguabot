import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Set by pages that redirect here after an action completes (e.g.
  // AccountPage after a self-service account deletion) - not an error, so
  // it's rendered separately from the store's own `error` state below.
  const confirmationMessage = (location.state as { message?: string } | null)?.message;
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      // error is already surfaced via the store's `error` state
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-8 rounded-xl w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-3xl font-bold mb-2">Connexion</h1>

        {confirmationMessage && <p className="text-green-400 text-sm">{confirmationMessage}</p>}

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-300">Mot de passe</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 rounded-lg px-4 py-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <p className="text-sm text-slate-400 text-center">
          Pas encore de compte ?{" "}
          <Link to="/register" className="text-blue-400">
            Inscrivez-vous
          </Link>
        </p>
      </form>
    </main>
  );
}
