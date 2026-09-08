import { Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/admin", label: "Statistiques" },
  { to: "/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/admin/scenarios", label: "Scénarios" },
  { to: "/admin/defis", label: "Défis du jour" },
  { to: "/admin/gamification", label: "Gamification" },
  { to: "/admin/logs", label: "Logs" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <nav className="w-56 bg-slate-900 p-4 flex flex-col gap-1 shrink-0">
        <p className="text-slate-400 text-xs uppercase font-bold mb-2 px-2">Administration</p>
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={location.pathname === item.to ? "page" : undefined}
            className={`px-3 py-2 rounded-lg text-sm ${
              location.pathname === item.to
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link to="/dashboard" className="mt-auto px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-800">
          ← Retour à l'app
        </Link>
      </nav>
      <div className="flex-1 p-8 overflow-x-auto">{children}</div>
    </div>
  );
}
