import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
