import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-center">
        Speak English with your AI coach
      </h1>
      <p className="text-slate-300 text-center max-w-xl">
        Practice spoken English through real-life scenarios with your
        3D AI avatar.
      </p>
      <div className="flex gap-4">
        <Link to="/register" className="bg-blue-600 px-6 py-3 rounded-lg">
          Create an account
        </Link>
        <Link to="/login" className="bg-slate-800 px-6 py-3 rounded-lg">
          Log in
        </Link>
      </div>
    </main>
  );
}
