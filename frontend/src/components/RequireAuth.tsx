import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ErrorBanner } from "./ui/ErrorBanner";
import { LoadingScreen } from "./ui/LoadingScreen";
import { useAuthStore } from "../stores/authStore";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const fetchMeError = useAuthStore((state) => state.fetchMeError);
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
    if (fetchMeError) {
      return (
        <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
          <ErrorBanner message="Impossible de charger ton profil." onRetry={fetchMe} />
        </main>
      );
    }

    return <LoadingScreen />;
  }

  // Audit A1/P0-01: onboarding (meeting "the teacher", OnboardingPage) must
  // happen before the graded oral placement test, not after it - every
  // protected route redirects to whichever of the two is still outstanding.
  // Admin accounts are created outside this flow entirely (no registration,
  // no onboarding, no placement test) and must not get stuck behind either gate.
  if (
    user.role !== "ROLE_ADMIN" &&
    !user.onboardingCompleted &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (
    user.role !== "ROLE_ADMIN" &&
    !user.placementTestCompleted &&
    location.pathname !== "/placement-test"
  ) {
    return <Navigate to="/placement-test" replace />;
  }

  return <>{children}</>;
}
