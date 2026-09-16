import { Button } from "../components/ui/Button";
import { useAuthStore } from "../stores/authStore";

// Reachable regardless of auth state (not wrapped in RequireAuth) - an
// unknown URL should show "page introuvable", not silently redirect to
// /login as if the real problem were being logged out.
export function NotFoundPage() {
  const token = useAuthStore((state) => state.token);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-4">Page not found</h1>
        <p className="text-slate-400 mb-8">The page you requested doesn't exist.</p>
        <Button to={token ? "/dashboard" : "/"}>
          {token ? "Back to dashboard" : "Back to home"}
        </Button>
      </div>
    </main>
  );
}
