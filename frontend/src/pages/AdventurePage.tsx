import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import type { WorldSummary } from "../types";

type WorldTheme = {
  icon: string;
  /** Tailwind `bg-gradient-to-br` stop classes - no photo assets exist yet (see RoomBackdrop for the same fallback philosophy one screen deeper), so each world's identity comes from color + a crest icon instead. */
  gradient: string;
  accent: string;
  bar: string;
  glow: string;
};

const DEFAULT_THEME: WorldTheme = {
  icon: "🗺️",
  gradient: "from-slate-600/30 via-slate-700/10 to-slate-900",
  accent: "text-slate-300",
  bar: "bg-slate-400",
  glow: "hover:shadow-slate-500/20",
};

/** Keyed by World.code - one distinct color identity per world, chosen to echo its theme (warm home, neon nightlife, sky travel, beach teal, corporate indigo, urban blue, medical rose, party violet). */
const WORLD_THEMES: Record<string, WorldTheme> = {
  W1: { icon: "🏠", gradient: "from-amber-500/35 via-orange-600/10 to-slate-900", accent: "text-amber-300", bar: "bg-amber-400", glow: "hover:shadow-amber-500/20" },
  W2: { icon: "🎭", gradient: "from-fuchsia-600/35 via-purple-700/10 to-slate-900", accent: "text-fuchsia-300", bar: "bg-fuchsia-400", glow: "hover:shadow-fuchsia-500/20" },
  W3: { icon: "✈️", gradient: "from-sky-500/35 via-blue-600/10 to-slate-900", accent: "text-sky-300", bar: "bg-sky-400", glow: "hover:shadow-sky-500/20" },
  W4: { icon: "🌴", gradient: "from-teal-500/35 via-cyan-600/10 to-slate-900", accent: "text-teal-300", bar: "bg-teal-400", glow: "hover:shadow-teal-500/20" },
  W5: { icon: "💼", gradient: "from-indigo-500/35 via-blue-800/10 to-slate-900", accent: "text-indigo-300", bar: "bg-indigo-400", glow: "hover:shadow-indigo-500/20" },
  W6: { icon: "🏙️", gradient: "from-blue-600/35 via-slate-700/10 to-slate-900", accent: "text-blue-300", bar: "bg-blue-400", glow: "hover:shadow-blue-500/20" },
  W7: { icon: "❤️", gradient: "from-rose-600/35 via-red-700/10 to-slate-900", accent: "text-rose-300", bar: "bg-rose-400", glow: "hover:shadow-rose-500/20" },
  W8: { icon: "🎉", gradient: "from-violet-600/35 via-pink-600/10 to-slate-900", accent: "text-violet-300", bar: "bg-violet-400", glow: "hover:shadow-violet-500/20" },
};

function themeFor(code: string): WorldTheme {
  return WORLD_THEMES[code] ?? DEFAULT_THEME;
}

function percentOf(world: WorldSummary): number {
  return world.situationsTotal > 0 ? Math.round((world.situationsCompleted / world.situationsTotal) * 100) : 0;
}

export function AdventurePage() {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    api
      .get<WorldSummary[]>("/worlds")
      .then((response) => setWorlds(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)))
      .finally(() => setLoading(false));
  }, [retryCount]);

  // World 0 (lowest orderNum, always "Daily Life" today) is the world
  // LinguaBot is actively steering a learner toward right now - given the
  // hero treatment below. Every other world is a destination the learner
  // can already see and reach, just not the one being pushed this instant.
  const [featured, ...rest] = worlds;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white px-4 sm:px-8 py-10 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">🌍 Your Adventure</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Explore the world. Practice real English.</h1>
          <p className="text-slate-400">Every world is a place to talk, listen, and level up.</p>
        </div>

        {loading ? (
          <p className="text-center text-slate-400">Loading...</p>
        ) : loadError ? (
          <ErrorBanner
            message={loadError.message}
            onRetry={loadError.retryable ? () => setRetryCount((count) => count + 1) : undefined}
          />
        ) : (
          <>
            {featured && <FeaturedWorldCard world={featured} />}

            {rest.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                  More destinations
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rest.map((world) => (
                    <WorldCard key={world.code} world={world} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FeaturedWorldCard({ world }: { world: WorldSummary }) {
  const theme = themeFor(world.code);
  const percent = percentOf(world);

  return (
    <Link
      to={`/aventure/${world.code}`}
      className={`relative block overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} border border-white/10 p-8 sm:p-10 mb-10 transition-all hover:-translate-y-1 shadow-xl ${theme.glow}`}
    >
      <span aria-hidden className="absolute -right-8 -top-8 text-[160px] leading-none opacity-10 select-none">
        {theme.icon}
      </span>

      <p className="text-xs uppercase tracking-widest text-slate-300/80 mb-4">Start here</p>

      <div className="flex items-center gap-4 mb-3">
        <span className="text-5xl" aria-hidden>
          {theme.icon}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold">{world.title}</h2>
      </div>

      {world.description && <p className="text-slate-200/90 max-w-xl mb-7">{world.description}</p>}

      <div className="max-w-md">
        <div className="flex justify-between text-sm mb-1.5">
          <span className={`font-semibold ${theme.accent}`}>
            {world.situationsCompleted} / {world.situationsTotal} situations
          </span>
          <span className="text-slate-300">{percent}%</span>
        </div>
        <div className="bg-black/30 rounded-full h-2.5 overflow-hidden">
          <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${percent}%` }} />
        </div>
      </div>

      <p className={`mt-7 font-bold ${theme.accent}`}>Enter world →</p>
    </Link>
  );
}

function WorldCard({ world }: { world: WorldSummary }) {
  const theme = themeFor(world.code);
  const percent = percentOf(world);

  return (
    <Link
      to={`/aventure/${world.code}`}
      className={`relative block overflow-hidden rounded-xl bg-gradient-to-br ${theme.gradient} border border-white/10 p-6 transition-all hover:-translate-y-1 shadow-lg ${theme.glow}`}
    >
      <span aria-hidden className="absolute -right-5 -top-5 text-8xl leading-none opacity-10 select-none">
        {theme.icon}
      </span>

      <span className="text-3xl mb-3 block" aria-hidden>
        {theme.icon}
      </span>
      <p className="font-bold text-lg mb-1">{world.title}</p>
      {world.description && <p className="text-slate-300/80 text-sm mb-4 line-clamp-2">{world.description}</p>}

      <div className="bg-black/30 rounded-full h-1.5 overflow-hidden mb-2">
        <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${percent}%` }} />
      </div>
      <p className={`text-xs font-semibold ${theme.accent}`}>
        {world.situationsCompleted} / {world.situationsTotal} · Enter →
      </p>
    </Link>
  );
}
