import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { AvatarSpeechBubble } from "../components/AvatarSpeechBubble";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import {
  detectDashboardDestination,
  detectDashboardReadyIntent,
  hasSeenDashboardIntro,
  markDashboardIntroSeen,
} from "../lib/dashboardIntro";
import { classifyOnboardingReadiness, isRecognizableNameReply } from "../lib/onboardingIntro";
import { useAuthStore } from "../stores/authStore";
import type { DailyChallenge } from "../types";

// Fired well after the intro's own /api/me settles, and never awaited by
// anything visible - the daily-challenge card already has a sensible
// static fallback, so a slow or failed response here (this project's dev
// PHP server queues concurrent requests - see the effect below) just means
// the card keeps showing that fallback instead of blocking or erroring.
const DAILY_CHALLENGE_PREVIEW_DELAY_MS = 1500;

// Cosmetic only, for the "XP toward next level" bar below - not sourced from
// any API response (Me never returns the *next* level's threshold, only the
// learner's own current one). These are the CDCF §3.6 thresholds, seeded
// verbatim by the levels fixture (LevelFixtures) and stable since the
// project's Jalon 3 modeling - not expected to drift, but this bar degrades
// to "100%, palier maximal" rather than breaking if a level code doesn't match.
const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2"];
const LEVEL_XP_THRESHOLDS: Record<string, number> = { A0: 0, A1: 300, A2: 1000, B1: 2500, B2: 5000 };

function progressToNextLevel(levelCode: string, totalXp: number): { percent: number; nextLevelCode: string | null } {
  const index = LEVEL_ORDER.indexOf(levelCode);
  const nextLevelCode = index >= 0 && index < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[index + 1] : null;
  if (!nextLevelCode) return { percent: 100, nextLevelCode: null };

  const floor = LEVEL_XP_THRESHOLDS[levelCode] ?? 0;
  const ceiling = LEVEL_XP_THRESHOLDS[nextLevelCode] ?? floor;
  const percent = ceiling > floor ? Math.min(100, Math.max(0, ((totalXp - floor) / (ceiling - floor)) * 100)) : 0;

  return { percent, nextLevelCode };
}

const GREETING_QUESTION = "Prêt pour ton cours d'anglais aujourd'hui ?";
const READY_NOT_UNDERSTOOD_TEXT = "Je n'ai pas bien compris. Tu peux dire oui, ou continuer avec le bouton.";
const WHAT_NEXT_QUESTION = "Par quoi commençons-nous aujourd'hui ?";
const ONBOARDING_GREETING = "Hello! I'm LinguaBot, your English teacher. What's your name?";
const ONBOARDING_READY_QUESTION = "Are you ready to start?";
const ONBOARDING_REFORMULATED_READY_QUESTION =
  "I didn't quite catch that. You can say: yes, I'm ready — or no, not yet.";
const ONBOARDING_DECLINED_MESSAGE = "No problem. Come back when you're ready!";
const DESTINATION_NOT_UNDERSTOOD_TEXT =
  "Je n'ai pas compris ton choix. Tu peux dire par exemple : Scénarios, Quiz, Défi du jour ou Progression.";
// Long enough to read as a deliberate move (not a flicker), short enough to
// stay out of the way - matches the ~0.5-0.8s range used for the app's
// other CSS-only transitions.
const TRANSITION_MS = 700;

// Expected asset - not yet in the repo. Drop a real photo here to replace
// the dark-navy fallback below: WebP, 16:9, ~1920×1080 (a moderately-lit
// modern classroom - board/window area centered, no teacher already drawn
// in it, since the real "teacher" is the 3D avatar rendered on top of it).
const CLASSROOM_BACKGROUND_SRC = "/images/dashboard/classroom-background.webp";

// Two independent background-image layers: the gradient is CSS-generated
// (always renders) and sits over `backgroundColor` regardless of whether
// the photo layer loads - a missing/404 classroom-background.webp still
// leaves a normal dark scene, never a blank/broken box (§18).
const INTRO_SCENE_STYLE: CSSProperties = {
  backgroundColor: "#0b1220",
  backgroundImage: `linear-gradient(180deg, rgba(8,12,24,0.30) 0%, rgba(8,12,24,0.45) 55%, rgba(8,12,24,0.72) 100%), url(${CLASSROOM_BACKGROUND_SRC})`,
  backgroundSize: "cover",
  backgroundPosition: "center 32%",
};

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}


// AvatarScene's ~30MB GLB/FBX load through react-three-fiber's Suspense -
// nothing today catches a load failure (none of the app's other pages wrap
// it either), which would otherwise blank the whole Dashboard instead of
// just the avatar panel. Scoped tightly to AvatarScene alone so a 3D failure
// never takes the rest of the page (cards, voice-free navigation) down with it.
class AvatarSceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="w-full h-full min-h-[220px] flex items-center justify-center text-sm text-slate-400 bg-slate-900 rounded-xl">
          Avatar indisponible pour le moment.
        </div>
      );
    }
    return this.props.children;
  }
}

// Reveals its content with a light fade+rise once `visible` flips true - a
// no-op wrapper (renders already-visible content, no transition classes)
// under prefers-reduced-motion.
function RevealSection({
  visible,
  delayMs,
  reducedMotion,
  className = "",
  children,
}: {
  visible: boolean;
  delayMs: number;
  reducedMotion: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (reducedMotion) return <div className={className}>{children}</div>;

  return (
    <div
      className={`transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const fetchMeError = useAuthStore((state) => state.fetchMeError);
  const logout = useAuthStore((state) => state.logout);
  const { avatarState, speechText, charIndexRef, speakAssistantLine, handleAvatarReady, stopSpeaking } =
    useConversationSession();

  // The guided intro plays once per session (= once per login, see
  // markDashboardIntroSeen/DASHBOARD_INTRO_SEEN_KEY above) - a learner who
  // already saw it this session and navigates back to /dashboard (which
  // remounts this component) lands straight on the cards instead of
  // replaying the classroom greeting every time.
  const [phase, setPhase] = useState<"intro" | "dashboard">(() => (hasSeenDashboardIntro() ? "dashboard" : "intro"));
  const [introStage, setIntroStage] = useState<"onboarding-name" | "onboarding-ready" | "greeting">("greeting");
  const [transitioning, setTransitioning] = useState(false);
  const [cardsRevealed, setCardsRevealed] = useState(() => hasSeenDashboardIntro());
  const [dailyChallengePreview, setDailyChallengePreview] = useState<DailyChallenge | null>(null);
  // Mirrors the LinguaBot card's own mic listening state, so the status
  // line next to it can say "Je t'écoute…" instead of "Disponible pour
  // parler" while it's actually listening, rather than showing both at once.
  const [micListening, setMicListening] = useState(false);
  // Purely cosmetic (see the fade-in on the challenge card below) - flips
  // true one frame after the real challenge arrives, never gates the fetch
  // or the fallback content itself.
  const [challengeContentFadedIn, setChallengeContentFadedIn] = useState(false);
  const greetingSpokenRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const previousAvatarStateRef = useRef(avatarState);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Deferred well past the intro (only once the cards have actually
  // revealed) and further delayed on top of that, specifically so it never
  // lands anywhere near the intro's own /api/me calls - concurrent with
  // those, this measurably queued for 20s+ behind them on this project's
  // dev PHP server. Best-effort only: the daily-challenge card already has
  // a static fallback, so a slow/failed response here just means it keeps
  // showing that instead of the real title/XP.
  useEffect(() => {
    if (!cardsRevealed) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .get<DailyChallenge>("/daily-challenge")
        .then((response) => {
          if (cancelled) return;
          setDailyChallengePreview(response.data);
          requestAnimationFrame(() => {
            if (!cancelled) setChallengeContentFadedIn(true);
          });
        })
        .catch(() => {});
    }, DAILY_CHALLENGE_PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cardsRevealed]);

  // The guided greeting, spoken once the learner's data has arrived - reuses
  // the same speakAssistantLine() pipeline as every other page (never a
  // parallel voice system). speakAssistantLine itself buffers this until
  // AvatarScene's onReady fires if the 3D assets are still loading.
  useEffect(() => {
    if (!user || phase !== "intro" || greetingSpokenRef.current) return;
    greetingSpokenRef.current = true;

    if (!user.onboardingCompleted) {
      setIntroStage("onboarding-name");
      speakAssistantLine(ONBOARDING_GREETING, "en-US");
      return;
    }

    const greeting = user.prenom ? `Bonjour ${user.prenom}. ${GREETING_QUESTION}` : `Bonjour. ${GREETING_QUESTION}`;
    speakAssistantLine(greeting, "fr-FR");
    // speakAssistantLine is a fresh function reference every render (from
    // useConversationSession) and must not retrigger this - it only ever
    // needs to run once, guarded by greetingSpokenRef above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [user, phase]);

  // Navigates only once a destination-confirmation line (set via
  // pendingNavigationRef below) has actually finished being spoken - never
  // right when the destination is recognized, so the learner hears "Très
  // bien, commençons le quiz." before the page actually changes.
  useEffect(() => {
    const wasSpeaking = previousAvatarStateRef.current === "speaking";
    previousAvatarStateRef.current = avatarState;
    if (wasSpeaking && avatarState === "idle" && pendingNavigationRef.current) {
      const route = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      navigate(route);
    }
  }, [avatarState, navigate]);

  function beginDashboardTransition() {
    if (transitionStartedRef.current) return;
    transitionStartedRef.current = true;
    markDashboardIntroSeen();

    // A "oui"/skip can arrive while the greeting is still mid-sentence -
    // without this, that line kept talking (and the bubble kept following
    // the avatar as it resized/moved into the hero) straight through the
    // transition instead of stopping the moment the learner moved on.
    stopSpeaking();

    setPhase("dashboard");
    const reduced = prefersReducedMotion();
    setTransitioning(!reduced);

    window.setTimeout(
      () => {
        setTransitioning(false);
        setCardsRevealed(true);
        speakAssistantLine(WHAT_NEXT_QUESTION, "fr-FR");
      },
      reduced ? 0 : TRANSITION_MS,
    );
  }

  function handleIntroVoiceResult(transcript: string) {
    if (detectDashboardReadyIntent(transcript)) {
      beginDashboardTransition();
    } else {
      speakAssistantLine(READY_NOT_UNDERSTOOD_TEXT, "fr-FR");
    }
  }

  function handleDashboardVoiceResult(transcript: string) {
    const destination = detectDashboardDestination(transcript);
    if (destination) {
      pendingNavigationRef.current = destination.route;
      speakAssistantLine(destination.confirmSpeech, "fr-FR");
    } else {
      speakAssistantLine(DESTINATION_NOT_UNDERSTOOD_TEXT, "fr-FR");
    }
  }

  function handleOnboardingNameReply(transcript: string) {
    if (isRecognizableNameReply(transcript)) {
      setIntroStage("onboarding-ready");
      speakAssistantLine(`Nice to meet you, ${user?.prenom || "there"}! ${ONBOARDING_READY_QUESTION}`, "en-US");
    } else {
      speakAssistantLine(ONBOARDING_GREETING, "en-US");
    }
  }

  async function completeOnboardingAndTransition() {
    try {
      await api.post("/onboarding/complete");
      await fetchMe();
    } catch {}
    beginDashboardTransition();
  }

  function handleOnboardingReadyReply(transcript: string) {
    const intent = classifyOnboardingReadiness(transcript);

    if (intent === "affirmative") {
      void completeOnboardingAndTransition();
      return;
    }

    if (intent === "negative") {
      speakAssistantLine(ONBOARDING_DECLINED_MESSAGE, "en-US");
      return;
    }

    speakAssistantLine(ONBOARDING_REFORMULATED_READY_QUESTION, "en-US");
  }

  function handleVoiceResult(transcript: string) {
    if (phase === "dashboard") {
      handleDashboardVoiceResult(transcript);
    } else if (introStage === "onboarding-name") {
      handleOnboardingNameReply(transcript);
    } else if (introStage === "onboarding-ready") {
      handleOnboardingReadyReply(transcript);
    } else {
      handleIntroVoiceResult(transcript);
    }
  }

  function handleLogout() {
    // logout() itself clears the intro-seen flag (see authStore.ts) - it's
    // the single place every logout path (this button, and an automatic
    // 401) goes through.
    logout();
    navigate("/login");
  }

  if (!user) {
    if (fetchMeError) {
      return (
        <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
          <ErrorBanner message="Impossible de charger ton profil." onRetry={fetchMe} />
        </main>
      );
    }
    return <LoadingScreen />;
  }

  const isNewLearner = user.totalXp === 0 && user.sessionsCount === 0;
  const { percent: xpPercent, nextLevelCode } = progressToNextLevel(user.level.code, user.totalXp);
  const reducedMotion = prefersReducedMotion();
  const micDisabled = avatarState === "speaking" || transitioning;

  return (
    <div className={phase === "intro" ? "min-h-dvh bg-slate-950 flex flex-col" : "min-h-screen bg-slate-950"}>
      <main
        className={
          phase === "intro"
            // No max-w-6xl/mx-auto here on purpose: the classroom scene must
            // fill the FULL viewport width (§14/§15 of the spec - a capped,
            // centered content column left two empty dark bars flanking the
            // scene on wide screens, which is exactly the "grand espace
            // vide" this chantier is trying to eliminate). The dashboard
            // phase below is unaffected and keeps its own max-w-6xl.
            ? "flex-1 flex flex-col text-white px-4 sm:px-6 py-4 sm:py-6 w-full"
            : "text-white p-8 max-w-6xl mx-auto"
        }
      >
        {/* ---------- Minimal header (replaces the full nav on this page only - LearnerNav stays untouched on the other 5 pages that use it) ---------- */}
        <div className={`flex justify-between items-center gap-4 shrink-0 ${phase === "intro" ? "mb-2 sm:mb-3" : "mb-5"}`}>
          <Link to="/dashboard" className="font-bold text-white">
            LinguaBot
          </Link>
          <div className="flex items-center gap-4">
            {user.role === "ROLE_ADMIN" && (
              <Link to="/admin" className="text-sm text-amber-400 hover:text-amber-300">
                Administration
              </Link>
            )}
            <Link to="/voix" className="text-sm text-slate-400 hover:text-white">
              🔊 Voix de l'IA
            </Link>
            <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-white">
              Déconnexion
            </button>
          </div>
        </div>

        {/* ---------- Avatar composition: a single persistent AvatarScene instance across intro -> dashboard (never unmounted, so its ~30MB assets never reload) - only CSS (framing/size/classes) changes. Structural shape stays identical between phases at every level down to AvatarScene itself (only classNames differ) - React reconciles by (type, position among siblings), so any level whose child TYPES or ORDER actually changes between phases would remount everything below it. The one place that legitimately swaps type is the second child of "Level A" below (hero card vs mic/skip block), which is safe: it's a sibling AFTER the avatar branch, not an ancestor of it. ---------- */}
        <div
          className={
            phase === "intro"
              ? "relative flex-1 flex flex-col rounded-2xl overflow-hidden"
              : "grid md:grid-cols-[1fr_380px] gap-4 mb-6 items-stretch mt-4 sm:mt-3"
          }
          style={phase === "intro" ? INTRO_SCENE_STYLE : undefined}
        >
          {/* "Level B": avatar + bubble. Intro: grows to fill the classroom
              box and left-aligns a width-capped inner column so the avatar
              sits left-of-center, leaving room on the right for the bubble
              (which centers on this whole row, not on the narrower inner
              column - see the two-child structure below) - matches §7/§8's
              composition without needing to move AvatarSpeechBubble itself.
              mt-20/24 (margin, not padding - padding wouldn't move the
              containing block's own top edge, which is what
              AvatarSpeechBubble's bottom-full is measured from): the
              classroom box above clips overflow (for its own rounded
              corners) - without shifting this whole row down, the bubble
              renders above the avatar's box and gets silently clipped away
              by that overflow-hidden instead of showing near the head.
              Dashboard: unchanged compact hero-corner cell. */}
          <div
            className={
              phase === "intro"
                ? "relative flex-1 flex w-full px-2 sm:px-6 mt-20 sm:mt-24"
                : "relative w-full max-w-md mx-auto md:max-w-none order-2"
            }
          >
            {/* Intro: this inner box IS the avatar's own footprint (canvas
                fills it via h-full/w-full) - the mic + skip link below are
                positioned absolutely WITHIN it (bottom-right), so they read
                as a small control attached to the avatar itself rather than
                a separate full-width row underneath. That also frees the
                ~190px that row used to cost, which is what was starving the
                avatar's actual height on shorter viewports (1366×768 and
                similar laptop screens) - Level B's flex-1 now has nothing
                else to share space with.
                Positioned via `left: calc(36% - 300px)` (300 = half of the
                fixed 600px width) rather than a width-percentage of Level B:
                since the classroom scene is full-viewport-width (no
                max-w-6xl), a percentage-of-width box would either get far
                too wide or drift away from the intended visual center
                depending on viewport size - a fixed box width + calc()-based
                left keeps that center constant across viewports. Mobile
                reverts to simple centering (no fixed target position there).
                drop-shadow: a plain CSS filter on this wrapper div (not a
                Three.js/Canvas change) - a very soft, low-opacity shadow so
                the silhouette reads as sitting IN the room rather than
                pasted over it. */}
            <div
              className={
                phase === "intro"
                  ? "absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md md:left-[calc(36%_-_300px)] md:translate-x-0 md:w-[600px] md:max-w-none drop-shadow-[0_18px_28px_rgba(0,0,0,0.32)]"
                  : "w-full"
              }
            >
              {/* Same wrapper element in both phases (only its className
                  differs) - AvatarScene must stay at the exact same
                  position in the tree across the intro -> dashboard
                  transition, or React would remount it and reload its
                  ~30MB of assets. The dashboard-only footer below gives
                  this card an identity ("who is this?") beyond just being
                  a portrait - it's a sibling added after AvatarScene, not
                  a new ancestor, so it doesn't affect that either. */}
              <div
                className={
                  phase === "dashboard"
                    // Purely a presence cue (a brighter border on hover) -
                    // not a click target. The always-on mic at the bottom
                    // of the dashboard is already the real "talk to
                    // LinguaBot" action; this card doesn't need (and isn't
                    // given) its own competing entry point to it.
                    ? "rounded-2xl border border-blue-500/15 hover:border-blue-400/30 transition-colors bg-gradient-to-b from-slate-800/70 to-slate-900 overflow-hidden"
                    // Intro: must resolve to the exact same box the avatar
                    // used to render straight into (no wrapper at all) -
                    // AvatarScene's own div is h-full, which needs an
                    // ancestor with an explicit height to size against.
                    // Skipping this (an empty className, i.e. height:auto)
                    // silently collapsed the whole intro avatar down to a
                    // tiny default canvas size - confirmed by reproducing
                    // it. h-full here just re-forwards the parent's own
                    // inset-y-0-driven height, restoring that chain.
                    : "h-full"
                }
              >
                <AvatarSceneBoundary>
                  <AvatarScene
                    state={avatarState}
                    avatarType={user.avatarType}
                    speechText={speechText}
                    charIndexRef={charIndexRef}
                    onReady={handleAvatarReady}
                    framing={phase === "intro" ? "portrait" : "dashboardPortrait"}
                    transparentBackground={phase === "intro"}
                    showStateLabel={false}
                    heightClassName={
                      phase === "intro"
                        ? "h-full min-h-[320px] transition-[height] duration-700 ease-out motion-reduce:transition-none"
                        : "h-[185px] sm:h-[190px] transition-[height] duration-700 ease-out motion-reduce:transition-none"
                    }
                  />
                </AvatarSceneBoundary>

                {phase === "dashboard" && (
                  // The mic now lives here (same VoiceInput, same
                  // onResult/disabled wiring as before - only its
                  // variant/size changed) instead of floating on its own at
                  // the bottom of the page, so the control visually reads
                  // as "LinguaBot is listening", not as a standalone
                  // Dashboard widget.
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/40">
                    <div>
                      <p className="font-bold text-white text-sm leading-tight">LinguaBot</p>
                      <p className="text-xs text-slate-400 leading-tight">Ton professeur IA</p>
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mt-1">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-emerald-400 opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        {micListening ? "Je t'écoute…" : "Disponible pour parler"}
                      </span>
                    </div>
                    <VoiceInput
                      onResult={handleVoiceResult}
                      disabled={micDisabled}
                      lang="fr-FR"
                      variant="brand"
                      size="compact"
                      onListeningChange={setMicListening}
                      hideStatusText
                    />
                  </div>
                )}
              </div>

              {/* Mic + skip, nested back inside the avatar's own box (per
                  this finishing pass - a dedicated Level-B-wide anchor read
                  as "attached to the viewport", not to the avatar) and
                  anchored to ITS right edge with a small, fixed offset, so
                  it visually hugs the avatar regardless of viewport size.
                  `top` (not `bottom`) at ~66% down the box - hip height on
                  this crop, not the very bottom edge (which lands near
                  mid-thigh and reads as detached from the body). */}
              {phase === "intro" && (
                <div className="absolute top-[87%] right-1 sm:top-[66%] sm:right-4 flex flex-col items-center gap-1">
                  <VoiceInput
                    onResult={handleVoiceResult}
                    disabled={micDisabled}
                    lang={introStage === "greeting" ? "fr-FR" : "en-US"}
                    variant="brand"
                    size="compact"
                  />
                  <button
                    type="button"
                    onClick={beginDashboardTransition}
                    className="text-xs text-slate-300 hover:text-white underline underline-offset-2 whitespace-nowrap"
                  >
                    Continuer sans parler →
                  </button>
                </div>
              )}
            </div>

            {/* Bubble gets its own anchor point, independent of the
                avatar's own width. Mobile: centered above the avatar as
                before (left-1/2 + -translate-x-1/2); desktop (md:): explicit
                left/top anchor near the avatar's head-and-shoulders, with
                the translate cancelled so `left` is the bubble's own edge,
                not its center. AvatarSpeechBubble's own bottom-full/centering
                logic is untouched either way - only where its anchor sits
                changes. */}
            {phase === "intro" ? (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[16%] w-[85vw] md:left-[44%] md:translate-x-0 md:w-[380px] md:top-[20%]"
              >
                <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
              </div>
            ) : (
              <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
            )}
          </div>

          {phase === "dashboard" && (
            <RevealSection visible={cardsRevealed} delayMs={0} reducedMotion={reducedMotion} className="order-1">
              {/* No h-full/justify-center here on purpose - this card sizes
                  to its own (now tighter) content instead of stretching to
                  match the avatar column's height, which is fixed and
                  locked (see AvatarScene above). Stretching used to leave a
                  lot of dead vertical space padded out inside the card;
                  sizing to content shrinks the card's own footprint by
                  ~20% without touching the avatar at all.
                  Not the shared <Card variant="stat"> here (deliberately) -
                  that component's p-6 is also used by AccountPage, so
                  trimming its padding globally would resize a page outside
                  this chantier's scope. Replicating its look locally with a
                  slightly smaller *vertical* padding (py-5 vs p-6) keeps
                  the change scoped to this card alone. */}
              <div className="bg-slate-800 rounded-xl px-6 py-6 flex flex-col gap-3">
                <div>
                  <h1 className="text-2xl font-bold mb-0.5">Bonjour {user.prenom} 👋</h1>
                  <p className="text-slate-400 text-sm">Prêt à continuer ton anglais ?</p>
                </div>

                <div>
                  {/* Level code shown once (here) - it used to also flank
                      the bar's left end, a plain duplicate of this same
                      line. "Prochain : X" replaces that second "A1" with
                      the one piece of information the bar itself doesn't
                      already say. */}
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm text-slate-300">
                      <span className="font-semibold text-white">{user.level.code}</span> · {user.level.name}
                    </p>
                    {nextLevelCode && <p className="text-xs text-slate-400 shrink-0">Prochain : {nextLevelCode}</p>}
                  </div>
                  <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{user.totalXp} XP</p>
                </div>

                <Button to={isNewLearner ? "/quiz" : "/catalog"} size="lg" className="self-start">
                  {isNewLearner ? "Commencer le quiz A0 →" : "▶ Reprendre"}
                </Button>
              </div>
            </RevealSection>
          )}
        </div>

        {phase === "dashboard" && (
          <>
            {/* ---------- Daily challenge + progression ---------- */}
            <RevealSection visible={cardsRevealed} delayMs={100} reducedMotion={reducedMotion}>
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                <Card variant="stat" className="border border-amber-500/25 flex flex-col justify-center">
                  <p className="text-amber-400 text-xs font-bold uppercase mb-2">🔥 Défi du jour</p>
                  {/* dailyChallengePreview arrives (if at all) well after this
                      card first renders - see the deferred fetch effect
                      above. Until/unless it does, the generic fallback text
                      keeps the card from ever looking broken or empty - and
                      never a blocking spinner. The opacity transition below
                      only ever plays once, when real content first replaces
                      the fallback; it's not tied to the fetch/error logic
                      itself, which stays exactly as before. */}
                  <div className={`transition-opacity duration-300 ${dailyChallengePreview && challengeContentFadedIn ? "opacity-100" : dailyChallengePreview ? "opacity-0" : ""}`}>
                    {dailyChallengePreview ? (
                      <>
                        <p className="text-lg font-bold text-white mb-1">{dailyChallengePreview.title}</p>
                        <p className="text-slate-400 text-sm mb-4">+{dailyChallengePreview.xpReward} XP à gagner</p>
                      </>
                    ) : (
                      <p className="text-slate-400 text-sm mb-4">Un nouveau défi t'attend chaque jour.</p>
                    )}
                  </div>
                  <Button to="/defi-du-jour" variant="secondary" className="self-start">
                    {dailyChallengePreview?.completed
                      ? "Revoir le défi du jour →"
                      : dailyChallengePreview?.started
                        ? "Continuer le défi →"
                        : "Commencer →"}
                  </Button>
                </Card>

                {/* Deliberately shows NONE of A1/A2/level-code/XP/progress
                    bar - all of that already lives in the hero card above.
                    Was briefly showing user.avgScore ("Score moyen") too,
                    removed after auditing its source: SessionController's
                    own comment states it's "simulated scoring" - literally
                    just 40 + userTurns*15, not a real linguistic measure -
                    so presenting it as a quality/skill metric would be
                    showing a made-up statistic, not a real one. */}
                <Card variant="stat" className="border border-blue-500/15 flex flex-col justify-center">
                  <p className="text-blue-400 text-xs font-bold uppercase mb-2">📊 Ta progression</p>
                  <p className="text-lg font-bold mb-0.5">
                    {user.sessionsCount} session{user.sessionsCount > 1 ? "s" : ""} complétée
                    {user.sessionsCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">Retrouve tes badges et trophées débloqués.</p>
                  <Link to="/trophees" className="text-blue-400 text-sm">Voir ma progression →</Link>
                </Card>
              </div>
            </RevealSection>

            {/* ---------- Choisir une activité ---------- */}
            <RevealSection visible={cardsRevealed} delayMs={200} reducedMotion={reducedMotion}>
              <h2 className="text-lg font-bold mb-2.5">Choisir une activité</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-5">
                <Link
                  to="/catalog"
                  className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
                >
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
                    💬
                  </span>
                  <p className="font-bold mb-0.5">Scénarios</p>
                  <p className="text-slate-400 text-sm mb-2">Converse avec LinguaBot dans des situations réelles.</p>
                  <p className="text-blue-400 text-sm">Explorer →</p>
                </Link>
                <Link
                  to="/quiz"
                  className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
                >
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
                    🎙️
                  </span>
                  <p className="font-bold mb-0.5">Quiz vocal</p>
                  <p className="text-slate-400 text-sm mb-2">Entraîne ton vocabulaire à l'oral.</p>
                  <p className="text-blue-400 text-sm">Commencer →</p>
                </Link>
                <Link
                  to="/trophees"
                  className="block bg-slate-800 hover:bg-slate-700/80 hover:-translate-y-0.5 px-6 py-4 rounded-xl transition-all"
                >
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 text-2xl mb-2">
                    🏅
                  </span>
                  <p className="font-bold mb-0.5">Badges & trophées</p>
                  <p className="text-slate-400 text-sm mb-2">Découvre tes récompenses débloquées.</p>
                  <p className="text-blue-400 text-sm">Voir mes récompenses →</p>
                </Link>
              </div>
            </RevealSection>

            {/* Voice destination navigation is still a bonus on top of the
                cards above (always clickable on their own, no vocal
                confirmation required), available on every visit - the mic
                that drives it just moved into the LinguaBot card's own
                footer above (same handler, same `disabled` gating) instead
                of floating here on its own. */}
          </>
        )}
      </main>
    </div>
  );
}
