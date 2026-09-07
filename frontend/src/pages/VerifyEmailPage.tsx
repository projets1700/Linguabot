import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

type Status = "pending" | "success" | "error";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const error = useAuthStore((state) => state.error);

  const [status, setStatus] = useState<Status>("pending");
  const attempted = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");

      return;
    }

    if (attempted.current) {
      return;
    }
    attempted.current = true;

    verifyEmail(token)
      .then(() => {
        setStatus("success");
        navigate("/dashboard");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [searchParams, verifyEmail, navigate]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="bg-slate-900 p-8 rounded-xl w-full max-w-sm flex flex-col gap-4 text-center">
        {status === "pending" && (
          <>
            <h1 className="text-2xl font-bold">Activation en cours...</h1>
            <p className="text-slate-300">Merci de patienter.</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold">Compte activé !</h1>
            <p className="text-slate-300">Redirection vers ton tableau de bord...</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold">Lien invalide</h1>
            <p className="text-red-400">{error ?? "Ce lien de vérification est invalide."}</p>
            <p className="text-sm text-slate-400">
              <Link to="/register" className="text-blue-400">
                Recommencer l'inscription
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
