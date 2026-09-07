import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const location = useLocation();

  useEffect(() => {
    if (token && !user) {
      fetchMe();
    }
  }, [token, user, fetchMe]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p>Chargement...</p>
      </main>
    );
  }

  // The oral placement test is mandatory right after registration: every
  // protected route redirects there until it's done, so closing the tab
  // mid-test or logging back in later still routes the learner back to it.
  // Admin accounts are created outside that flow (no registration, no
  // placement test) and must not get stuck behind this gate.
  if (
    user.role !== "ROLE_ADMIN" &&
    !user.placementTestCompleted &&
    location.pathname !== "/placement-test"
  ) {
    return <Navigate to="/placement-test" replace />;
  }

  return <>{children}</>;
}
