import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useAuthStore } from "../stores/authStore";

export function AccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    try {
      const response = await api.get<Record<string, unknown>>("/me/export");
      // The backend's Content-Disposition header only matters for a browser
      // navigating there directly - this is an XHR call, so the download has
      // to be triggered client-side from the parsed JSON instead.
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "linguabot-mes-donnees.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete("/me", { data: { password } });
      // Navigate away before clearing auth state: logout() sets `user` to
      // null, and this component reads it (`if (!user) return null`) - doing
      // that first would unmount AccountPage out from under this still-running
      // handler before the redirect had a chance to happen.
      navigate("/login", { state: { message: "Ton compte a bien été supprimé." } });
      logout();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setDeleteError(status === 422 ? "Mot de passe incorrect." : "Échec de la suppression. Réessaie.");
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Mon compte</h1>

      <Card variant="stat" className="mb-8">
        <p className="text-slate-400 text-sm">Profil</p>
        <p className="text-xl font-bold">{user.prenom} {user.nom}</p>
        <p className="text-slate-400 text-sm mt-1">{user.email}</p>
      </Card>

      <Card variant="stat" className="mb-8">
        <h2 className="text-lg font-bold mb-2">Mes données</h2>
        <p className="text-slate-400 text-sm mb-4">
          Télécharge une copie de toutes tes données (profil, sessions, quiz, défis, badges, trophées).
        </p>
        <Button onClick={handleExport} disabled={exporting} variant="secondary">
          {exporting ? "Préparation..." : "Télécharger mes données"}
        </Button>
        {exportError && (
          <div className="mt-3">
            <ErrorBanner message="Échec du téléchargement." onRetry={handleExport} />
          </div>
        )}
      </Card>

      <Card variant="stat">
        <h2 className="text-lg font-bold mb-2">Supprimer mon compte</h2>
        <p className="text-slate-400 text-sm mb-4">
          Cette action désactive ton compte immédiatement et ne peut pas être annulée.
        </p>

        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Supprimer mon compte
          </Button>
        ) : (
          <div className="flex flex-col gap-3 max-w-xs">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-300">Confirme avec ton mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDelete} disabled={deleting || !password}>
                {deleting ? "Suppression..." : "Confirmer la suppression"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmingDelete(false);
                  setPassword("");
                  setDeleteError(null);
                }}
              >
                Annuler
              </Button>
            </div>
            {deleteError && <ErrorBanner message={deleteError} />}
          </div>
        )}
      </Card>
      </main>
    </div>
  );
}
