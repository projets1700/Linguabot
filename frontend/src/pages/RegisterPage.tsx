import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PasswordInput } from "../components/ui/PasswordInput";
import { useAuthStore } from "../stores/authStore";
import type { AvatarType } from "../types";

const AVATAR_OPTIONS: { type: AvatarType; label: string; emoji: string }[] = [
  { type: "male", label: "Homme", emoji: "👨" },
  { type: "female", label: "Femme", emoji: "👩" },
];

export function RegisterPage() {
  const register = useAuthStore((state) => state.register);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarType, setAvatarType] = useState<AvatarType | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!avatarType) return;

    try {
      await register({ prenom, nom, email, password, avatarType });
      setSubmittedEmail(email);
    } catch {
      // error is already surfaced via the store's `error` state
    }
  }

  if (submittedEmail) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="bg-slate-900 p-8 rounded-xl w-full max-w-sm flex flex-col gap-4 text-center">
          <h1 className="text-3xl font-bold mb-2">Vérifie ta boîte mail</h1>
          <p className="text-slate-300">
            Un email de confirmation a été envoyé à <strong>{submittedEmail}</strong>. Clique sur
            le lien qu'il contient pour activer ton compte (valable 1 heure).
          </p>
          <p className="text-sm text-slate-400">
            Déjà activé ?{" "}
            <Link to="/login" className="text-blue-400">
              Connectez-vous
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-8 rounded-xl w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-3xl font-bold mb-2">Inscription</h1>

        <div className="flex gap-4">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-sm text-slate-300">Prénom</span>
            <input
              required
              value={prenom}
              onChange={(event) => setPrenom(event.target.value)}
              className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="flex flex-col gap-1 flex-1">
            <span className="text-sm text-slate-300">Nom</span>
            <input
              required
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>

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
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-slate-300">Choisis ton avatar</span>
          <div role="radiogroup" aria-label="Choix de l'avatar" className="flex gap-4">
            {AVATAR_OPTIONS.map((option) => {
              const isSelected = avatarType === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setAvatarType(option.type)}
                  className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-slate-800"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                  }`}
                >
                  <span className="text-4xl" aria-hidden="true">
                    {option.emoji}
                  </span>
                  <span className={isSelected ? "text-blue-400 font-semibold" : "text-slate-300"}>
                    {option.label}
                    {isSelected && " ✓"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !avatarType}
          className="bg-blue-600 rounded-lg px-4 py-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>

        <p className="text-sm text-slate-400 text-center">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-blue-400">
            Connectez-vous
          </Link>
        </p>
      </form>
    </main>
  );
}
