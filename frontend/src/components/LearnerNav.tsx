import { Link, useLocation } from "react-router-dom";

// The hub pages a learner needs to jump between without relying on the
// browser's back button - deliberately not rendered on the immersive,
// avatar-driven screens (Session, Quiz module, Daily Challenge, Placement
// test), which already end with their own "Dashboard" button and are meant
// to stay free of extra chrome while the avatar is talking.
//
// "Progression" covers both /trophees and /badges under one label (they
// used to be two separate top-level entries, which duplicated the
// dashboard's own quick-access cards) - it links to /trophees, and matches
// active on either page so a learner on /badges still sees where they are.
const NAV: { to: string; label: string; matches?: string[] }[] = [
  { to: "/dashboard", label: "Accueil" },
  { to: "/catalog", label: "Scénarios" },
  { to: "/quiz", label: "Quiz" },
  { to: "/defi-du-jour", label: "Défis" },
  { to: "/trophees", label: "Progression", matches: ["/trophees", "/badges"] },
  { to: "/mon-compte", label: "Profil" },
];

export function LearnerNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Navigation principale"
      className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 overflow-x-auto"
    >
      <div className="flex items-center gap-1 py-2 whitespace-nowrap">
        <Link to="/dashboard" className="font-bold text-white pr-4 mr-1 border-r border-slate-700">
          LinguaBot
        </Link>
        {NAV.map((item) => {
          const active = (item.matches ?? [item.to]).includes(location.pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
