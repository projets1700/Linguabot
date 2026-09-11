import { useEffect } from "react";
import { useToastStore } from "../../stores/toastStore";

const AUTO_DISMISS_MS = 4000;

/**
 * Mounted once at the app root (see App.tsx). Reserved for failures with no
 * natural persistent spot for a local ErrorBanner (e.g. CatalogPage's
 * per-card "start" click) - pages that already show a local error never
 * also call showToast() for that same error (V1.1 §4.3: never both at once).
 */
export function ToastViewport() {
  const message = useToastStore((state) => state.message);
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, dismissToast]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        role="alert"
        aria-live="polite"
        className="bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg"
      >
        {message}
      </div>
    </div>
  );
}
