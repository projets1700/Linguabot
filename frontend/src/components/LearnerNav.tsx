import { Link, useLocation } from "react-router-dom";
import { isQuizHiddenForLevel } from "../lib/quizSpeech";
import { useAuthStore } from "../stores/authStore";

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
  { to: "/dashboard", label: "Home" },
  { to: "/quiz", label: "Vocabulary Test" },
  { to: "/defi-du-jour", label: "Challenges" },
  // V2 pilot (LinguaBot_V2_Conception.md) - World/Room/Mission navigation
  // lives under nested dynamic routes (/aventure/:worldCode/:roomCode/...),
  // so this stays active on any of them, not just the exact /aventure path.
  { to: "/aventure", label: "Adventure" },
  { to: "/trophees", label: "Progress", matches: ["/trophees", "/badges"] },
  { to: "/mon-compte", label: "Profile" },
];

export function LearnerNav() {
  const location = useLocation();
  const levelCode = useAuthStore((state) => state.user?.level.code);
  const items = isQuizHiddenForLevel(levelCode) ? NAV.filter((item) => item.to !== "/quiz") : NAV;

  return (
    <nav
      aria-label="Main navigation"
      className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 overflow-x-auto"
    >
      <div className="flex items-center gap-1 py-2 whitespace-nowrap">
        <Link to="/dashboard" className="font-bold text-white pr-4 mr-1 border-r border-slate-700">
          LinguaBot
        </Link>
        {items.map((item) => {
          const candidates = item.matches ?? [item.to];
          const active = candidates.some(
            (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
          );
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
