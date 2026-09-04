import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);

  useEffect(() => {
    if (!user) {
      fetchMe();
    }
  }, [user, fetchMe]);

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p>Chargement...</p>
      </main>
    );
  }

  if (user.role !== "ROLE_ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
