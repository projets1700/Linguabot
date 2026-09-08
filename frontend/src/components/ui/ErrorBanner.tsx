// role="alert" + aria-live="polite" so a screen reader announces the error
// as soon as it appears, without the page needing to move focus to it.
export function ErrorBanner({
  message,
  onRetry,
  retryLabel = "Réessayer",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" aria-live="polite" className="text-red-400 text-sm text-center">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 text-xs bg-red-900 px-2 py-1 rounded">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
