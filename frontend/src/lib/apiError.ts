import axios from "axios";

export type ApiErrorKind = "offline" | "timeout" | "unauthorized" | "rate_limit" | "server" | "unknown";

export type ApiError = {
  kind: ApiErrorKind;
  status?: number;
  retryable: boolean;
  message: string;
};

const MESSAGE_FOR_KIND: Record<ApiErrorKind, string> = {
  offline: "Pas de connexion internet. Vérifie ta connexion et réessaie.",
  timeout: "La requête a mis trop de temps à répondre. Réessaie.",
  unauthorized: "Ta session a expiré. Reconnecte-toi.",
  rate_limit: "Trop de requêtes pour le moment. Patiente quelques secondes puis réessaie.",
  server: "Le service est momentanément indisponible. Réessaie dans un instant.",
  unknown: "Une erreur est survenue. Réessaie.",
};

const RETRYABLE_KINDS: readonly ApiErrorKind[] = ["offline", "timeout", "server", "rate_limit"];

/**
 * Collapses any API failure into one of a handful of learner-facing kinds
 * (V1.1 §4.4) instead of every page inspecting error.response itself. 422s
 * (business rules - test already completed, echo detected, ...) are
 * deliberately NOT one of these kinds: callers check status === 422
 * themselves first (see DailyChallengePage/PlacementTestPage), since those
 * already carry their own meaningful backend message and aren't a network
 * failure - this only classifies the "something actually went wrong" case.
 */
export function normalizeApiError(error: unknown): ApiError {
  const kind = classify(error);
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;

  return {
    kind,
    status,
    retryable: RETRYABLE_KINDS.includes(kind),
    message: MESSAGE_FOR_KIND[kind],
  };
}

function classify(error: unknown): ApiErrorKind {
  if (!axios.isAxiosError(error)) return "unknown";

  if (!error.response) {
    return "ECONNABORTED" === error.code ? "timeout" : "offline";
  }

  const status = error.response.status;
  if (401 === status) return "unauthorized";
  if (429 === status) return "rate_limit";
  if (status >= 500) return "server";

  return "unknown";
}
