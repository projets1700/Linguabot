import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-center">
        Parlez anglais avec votre coach IA
      </h1>
      <p className="text-slate-300 text-center max-w-xl">
        Pratiquez l'anglais oral via des scénarios de la vie réelle avec votre
        avatar IA 3D.
      </p>
      <div className="flex gap-4">
        <Link to="/register" className="bg-blue-600 px-6 py-3 rounded-lg">
          Créer un compte
        </Link>
        <Link to="/login" className="bg-slate-800 px-6 py-3 rounded-lg">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
