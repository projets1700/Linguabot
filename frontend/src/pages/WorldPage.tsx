import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { LearnerNav } from "../components/LearnerNav";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import type { WorldDetail, WorldRoom } from "../types";

type RoomTheme = {
  icon: string;
  /** Tailwind `bg-gradient-to-br` stop classes - used only while backgroundImageSrc is null (no room artwork exists yet). */
  gradient: string;
  accent: string;
  bar: string;
  glow: string;
};

const DEFAULT_THEME: RoomTheme = {
  icon: "🚪",
  gradient: "from-slate-600/35 via-slate-700/10 to-slate-900",
  accent: "text-slate-300",
  bar: "bg-slate-400",
  glow: "hover:shadow-slate-500/20",
};

/** Keyed by Room.code - a hand-picked identity per Daily Life room; any room code not listed here (other worlds, or ones added later) falls back to DEFAULT_THEME rather than breaking. */
const ROOM_THEMES: Record<string, RoomTheme> = {
  "W1-R1": { icon: "🛋️", gradient: "from-amber-500/35 via-orange-600/10 to-slate-900", accent: "text-amber-300", bar: "bg-amber-400", glow: "hover:shadow-amber-500/20" },
  "W1-R2": { icon: "🍳", gradient: "from-orange-500/35 via-red-700/10 to-slate-900", accent: "text-orange-300", bar: "bg-orange-400", glow: "hover:shadow-orange-500/20" },
  "W1-R3": { icon: "🛏️", gradient: "from-indigo-500/35 via-blue-800/10 to-slate-900", accent: "text-indigo-300", bar: "bg-indigo-400", glow: "hover:shadow-indigo-500/20" },
  "W1-R4": { icon: "🛒", gradient: "from-lime-500/35 via-green-700/10 to-slate-900", accent: "text-lime-300", bar: "bg-lime-400", glow: "hover:shadow-lime-500/20" },
  "W1-R5": { icon: "🥐", gradient: "from-yellow-500/35 via-amber-700/10 to-slate-900", accent: "text-yellow-300", bar: "bg-yellow-400", glow: "hover:shadow-yellow-500/20" },
  "W1-R6": { icon: "👗", gradient: "from-pink-500/35 via-rose-700/10 to-slate-900", accent: "text-pink-300", bar: "bg-pink-400", glow: "hover:shadow-pink-500/20" },
  "W1-R7": { icon: "💇", gradient: "from-violet-500/35 via-purple-700/10 to-slate-900", accent: "text-violet-300", bar: "bg-violet-400", glow: "hover:shadow-violet-500/20" },
};

function themeFor(code: string): RoomTheme {
  return ROOM_THEMES[code] ?? DEFAULT_THEME;
}

function roomStats(room: WorldRoom) {
  const total = room.situations.length;
  const completed = room.situations.filter((s) => s.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  // Room has no description field of its own (only World and Situation do) -
  // the first situation's title is real data already in this payload and
  // gives an honest preview of what happens in the room, instead of
  // inventing room copy that doesn't exist server-side.
  const subtitle = room.situations[0]?.title ?? null;
  return { total, completed, percent, subtitle };
}

/** backgroundImageSrc is null for every room today (no art seeded yet for the V2 pilot) - same fallback philosophy as RoomBackdrop, but without mounting AvatarScene, which doesn't belong on a multi-room selection screen. */
function roomBackground(room: WorldRoom, theme: RoomTheme): { className: string; style?: CSSProperties } {
  if (room.backgroundImageSrc) {
    return {
      className: "bg-slate-900",
      style: {
        backgroundImage: `linear-gradient(180deg, rgba(8,12,24,0.25) 0%, rgba(8,12,24,0.85) 100%), url(${room.backgroundImageSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
    };
  }

  return { className: `bg-gradient-to-br ${theme.gradient}` };
}

/**
 * The room-selection step between the world map (AdventurePage) and a
 * specific room's situations/missions (RoomPage) - LinguaBot_V2_Conception.md
 * §14's "carte de mondes -> sélection de salle -> situations disponibles".
 */
export function WorldPage() {
  const { worldCode } = useParams<{ worldCode: string }>();
  const [world, setWorld] = useState<WorldDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoadError(null);
    api
      .get<WorldDetail>(`/worlds/${worldCode}`)
      .then((response) => setWorld(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)));
  }, [worldCode, retryCount]);

  if (!world) {
    if (loadError) {
      return (
        <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
          <ErrorBanner
            message={loadError.message}
            onRetry={loadError.retryable ? () => setRetryCount((count) => count + 1) : undefined}
          />
        </main>
      );
    }
    return <LoadingScreen />;
  }

  const totalSituations = world.rooms.reduce((sum, room) => sum + room.situations.length, 0);
  const completedSituations = world.rooms.reduce(
    (sum, room) => sum + room.situations.filter((s) => s.completed).length,
    0,
  );
  // "Discovered" isn't a field the API returns - derived here from real
  // per-situation completion data (at least one completed situation in the
  // room), not a fabricated stat.
  const roomsDiscovered = world.rooms.filter((room) => room.situations.some((s) => s.completed)).length;
  const worldPercent = totalSituations > 0 ? Math.round((completedSituations / totalSituations) * 100) : 0;

  const numberedRooms = world.rooms.map((room, index) => ({ room, number: index + 1 }));
  const [featured, ...otherRooms] = numberedRooms;

  return (
    <div className="min-h-screen bg-slate-950">
      <LearnerNav />
      <main className="text-white px-4 sm:px-8 py-10 max-w-5xl mx-auto">
        <Link to="/aventure" className="text-sm text-slate-400 hover:text-white inline-block mb-8">
          ← Back to Adventure
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-1">{world.title}</h1>
          <p className="text-blue-400 font-semibold mb-3">Everyday English starts here.</p>
          {world.description && <p className="text-slate-400 max-w-xl mb-6">{world.description}</p>}

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${worldPercent}%` }} />
              </div>
              <span className="text-sm text-slate-300">{worldPercent}% explored</span>
            </div>
            <p className="text-sm text-slate-400">
              Rooms discovered <span className="text-white font-semibold">{roomsDiscovered} / {world.rooms.length}</span>
            </p>
            <p className="text-sm text-slate-400">
              Situations completed{" "}
              <span className="text-white font-semibold">{completedSituations} / {totalSituations}</span>
            </p>
          </div>
        </div>

        {featured && (
          <>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
              Continue your adventure
            </h2>
            <FeaturedRoomCard room={featured.room} roomNumber={featured.number} worldCode={world.code} />
          </>
        )}

        {otherRooms.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-10 mb-4">Other places</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {otherRooms.map(({ room, number }) => (
                <RoomCard key={room.code} room={room} roomNumber={number} worldCode={world.code} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function FeaturedRoomCard({ room, roomNumber, worldCode }: { room: WorldRoom; roomNumber: number; worldCode: string }) {
  const theme = themeFor(room.code);
  const { total, completed, percent, subtitle } = roomStats(room);
  const bg = roomBackground(room, theme);
  const label = `Room ${String(roomNumber).padStart(2, "0")}`;

  const body = (
    <>
      <span aria-hidden className="absolute -right-8 -top-8 text-[160px] leading-none opacity-10 select-none">
        {theme.icon}
      </span>

      <p className="text-xs uppercase tracking-widest text-slate-300/80 mb-3">{label}</p>

      <div className="flex items-center gap-4 mb-3">
        <span className="text-5xl" aria-hidden>
          {theme.icon}
        </span>
        <h3 className="text-3xl sm:text-4xl font-bold">{room.title}</h3>
      </div>

      {subtitle && <p className="text-slate-200/90 max-w-xl mb-7">{subtitle}</p>}

      <div className="max-w-md">
        <div className="flex justify-between text-sm mb-1.5">
          <span className={`font-semibold ${theme.accent}`}>
            {completed} / {total} situations
          </span>
          <span className="text-slate-300">{percent}%</span>
        </div>
        <div className="bg-black/30 rounded-full h-2.5 overflow-hidden">
          <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {room.unlocked ? (
        <p className={`mt-7 font-bold ${theme.accent}`}>Enter room →</p>
      ) : (
        <p className="mt-7 font-bold text-slate-400">🔒 Locked</p>
      )}
    </>
  );

  const sharedClasses = `relative block overflow-hidden rounded-2xl border border-white/10 p-8 sm:p-10 mb-10 shadow-xl transition-all ${bg.className}`;

  if (!room.unlocked) {
    return (
      <div className={`${sharedClasses} grayscale opacity-60 cursor-not-allowed`} style={bg.style}>
        {body}
      </div>
    );
  }

  return (
    <Link
      to={`/aventure/${worldCode}/${room.code}`}
      className={`${sharedClasses} hover:-translate-y-1 ${theme.glow}`}
      style={bg.style}
    >
      {body}
    </Link>
  );
}

function RoomCard({ room, roomNumber, worldCode }: { room: WorldRoom; roomNumber: number; worldCode: string }) {
  const theme = themeFor(room.code);
  const { total, completed, percent, subtitle } = roomStats(room);
  const bg = roomBackground(room, theme);
  const label = `Room ${String(roomNumber).padStart(2, "0")}`;

  const body = (
    <>
      <span aria-hidden className="absolute -right-5 -top-5 text-8xl leading-none opacity-10 select-none">
        {theme.icon}
      </span>

      <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <span className="text-3xl mb-2 block" aria-hidden>
        {theme.icon}
      </span>
      <p className="font-bold text-lg mb-1">{room.title}</p>
      {subtitle && <p className="text-slate-300/80 text-sm mb-4 line-clamp-2">{subtitle}</p>}

      <div className="bg-black/30 rounded-full h-1.5 overflow-hidden mb-2">
        <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${percent}%` }} />
      </div>

      {room.unlocked ? (
        <p className={`text-xs font-semibold ${theme.accent}`}>
          {completed} / {total} · Enter →
        </p>
      ) : (
        <p className="text-xs font-semibold text-slate-500">🔒 Locked</p>
      )}
    </>
  );

  const sharedClasses = `relative block overflow-hidden rounded-xl border border-white/10 p-6 shadow-lg transition-all ${bg.className}`;

  if (!room.unlocked) {
    return (
      <div className={`${sharedClasses} grayscale opacity-60 cursor-not-allowed`} style={bg.style}>
        {body}
      </div>
    );
  }

  return (
    <Link
      to={`/aventure/${worldCode}/${room.code}`}
      className={`${sharedClasses} hover:-translate-y-1 ${theme.glow}`}
      style={bg.style}
    >
      {body}
    </Link>
  );
}
