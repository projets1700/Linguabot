// The "Chargement..." text a screen reader should announce as it updates -
// exported on its own for admin pages, which render inside AdminLayout's
// existing chrome and so never need the full-page <main> wrapper below.
export function LoadingText({ message = "Chargement..." }: { message?: string }) {
  return <p aria-live="polite">{message}</p>;
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <LoadingText message={message} />
    </main>
  );
}
