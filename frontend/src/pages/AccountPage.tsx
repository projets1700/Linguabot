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
      link.download = "linguabot-my-data.json";
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
      navigate("/login", { state: { message: "Your account has been deleted." } });
      logout();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setDeleteError(status === 422 ? "Incorrect password." : "Deletion failed. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">My account</h1>

      <Card variant="stat" className="mb-8">
        <p className="text-slate-400 text-sm">Profile</p>
        <p className="text-xl font-bold">{user.prenom} {user.nom}</p>
        <p className="text-slate-400 text-sm mt-1">{user.email}</p>
      </Card>

      <Card variant="stat" className="mb-8">
        <h2 className="text-lg font-bold mb-2">My data</h2>
        <p className="text-slate-400 text-sm mb-4">
          Download a copy of all your data (profile, sessions, quizzes, challenges, badges, trophies).
        </p>
        <Button onClick={handleExport} disabled={exporting} variant="secondary">
          {exporting ? "Preparing..." : "Download my data"}
        </Button>
        {exportError && (
          <div className="mt-3">
            <ErrorBanner message="Download failed." onRetry={handleExport} />
          </div>
        )}
      </Card>

      <Card variant="stat">
        <h2 className="text-lg font-bold mb-2">Delete my account</h2>
        <p className="text-slate-400 text-sm mb-4">
          This action disables your account immediately and cannot be undone.
        </p>

        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete my account
          </Button>
        ) : (
          <div className="flex flex-col gap-3 max-w-xs">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-300">Confirm with your password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDelete} disabled={deleting || !password}>
                {deleting ? "Deleting..." : "Confirm deletion"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmingDelete(false);
                  setPassword("");
                  setDeleteError(null);
                }}
              >
                Cancel
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
