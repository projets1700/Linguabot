import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

// Audit C6/C9: always nested inside RequireAuth now (see App.tsx's layout
// route), which already guarantees `user` is resolved and non-null before
// this ever renders - no more separate fetchMe()/loading state of its own.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "ROLE_ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
