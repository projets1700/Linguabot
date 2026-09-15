import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { AvatarSpeechBubble } from "../components/AvatarSpeechBubble";
import { ConversationLog } from "../components/ConversationLog";
import { HelpPanel } from "../components/HelpPanel";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { classifyOnboardingReadiness } from "../lib/onboardingIntro";
import { useAuthStore } from "../stores/authStore";
import type { DailyChallenge, DailyChallengeFinishResult } from "../types";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

// Same "portrait" + transparentBackground pairing the Dashboard intro
// already established for its "professeur face à l'élève" composition -
// reused as-is (no new preset, no AvatarScene change). Height grows once
// the mission starts, since the initial presentation chrome around it
// disappears and LinguaBot becomes the main element on screen.
const AVATAR_HEIGHT_BEFORE_START =
  "h-[240px] sm:h-[320px] lg:h-[380px] transition-[height] duration-700 ease-out motion-reduce:transition-none";
const AVATAR_HEIGHT_DURING_CHALLENGE =
  "h-[300px] sm:h-[360px] lg:h-[420px] transition-[height] duration-700 ease-out motion-reduce:transition-none";

// The pre-launch briefing is built from the real challenge data (title/
// context/objective), never invented - same idea as the backend's own
// ensureOpeningMessage(), just spoken by LinguaBot the teacher before the
// mission starts rather than by the challenge's in-character opening line.
function buildMissionBriefing(challenge: DailyChallenge): string {
  return `Today's mission: ${challenge.title}. ${challenge.context} ${challenge.objective} Are you ready?`;
}

const MISSION_REFORMULATED_READY_QUESTION =
  "I didn't quite catch that. Say yes when you're ready, or use the button below.";
const MISSION_DECLINED_MESSAGE = "No problem. Tap the button below whenever you're ready.";

export function DailyChallengePage() {
  const user = useAuthStore((state) => state.user);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  // The exact request behind the current sendError, so "Réessayer" can
  // resend it verbatim without the learner repeating it by voice (V1.1 §4.3).
  const [failedSend, setFailedSend] = useState<{ transcript: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<DailyChallengeFinishResult | null>(null);
  // Sticky once true - see the identical helpUnlocked comment in SessionPage.tsx.
  const [helpUnlocked, setHelpUnlocked] = useState(false);
  const {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
  } = useConversationSession();

  function loadChallenge() {
    setLoadError(null);
    api
      .get<DailyChallenge>("/daily-challenge")
      .then((response) => setChallenge(response.data))
      .catch((error) => setLoadError(normalizeApiError(error)));
  }

  useEffect(() => {
    loadChallenge();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Speaks the mission briefing once the challenge has loaded, exactly once -
  // same ref-guarded "fire once" pattern as OnboardingPage's greeting.
  // speakAssistantLine itself defers to AvatarScene's own onReady gate
  // (useConversationSession), so this doesn't need to wait on avatar
  // readiness itself.
  const missionBriefedRef = useRef(false);
  useEffect(() => {
    // challenge.completed short-circuits to the result screen below (no
    // avatar rendered there at all) - must not speak into that screen.
    if (!challenge || challenge.completed || chatStarted || missionBriefedRef.current) return;
    missionBriefedRef.current = true;
    speakAssistantLine(buildMissionBriefing(challenge), "en-US");
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  async function handleStart() {
    if (!challenge) return;
    const response = await api.post<{ openingMessage: string }>("/daily-challenge/start");
    setMessages([{ id: Date.now(), role: "assistant", content: response.data.openingMessage }]);
    setChatStarted(true);
    speakAssistantLine(response.data.openingMessage);
  }

  // Same 3-way intent recognition already used by OnboardingPage's own
  // "Are you ready?" question (classifyOnboardingReadiness) - reused as-is
  // rather than reimplemented, so a learner saying "yes"/"ready"/"ok" here
  // is understood exactly the same way it already is there. "No forced
  // loop on a decline" is the same rule: a "no" is acknowledged once and
  // the mic keeps listening (nothing re-asks on a timer), the manual
  // button always stays the fallback either way.
  function handleMissionReadyReply(transcript: string) {
    const intent = classifyOnboardingReadiness(transcript);

    if (intent === "affirmative") {
      void handleStart();
      return;
    }

    if (intent === "negative") {
      speakAssistantLine(MISSION_DECLINED_MESSAGE, "en-US");
      return;
    }

    speakAssistantLine(MISSION_REFORMULATED_READY_QUESTION, "en-US");
  }

  // Split from handleVoiceResult below so a failed send can be retried with
  // the exact same transcript without adding a second user bubble or
  // requiring a new voice turn. The backend now persists this conversation
  // itself (ChallengeMessage, mirroring SessionMessage - audit A5), so it no
  // longer needs turnNumber/history sent along; it rebuilds both from what
  // was actually said.
  async function sendMessage(transcript: string) {
    setSending(true);
    setSendError(null);
    setAvatarState("thinking");

    // A deterministic "I'm stuck" detection, not a grammar/quality judgment
    // (see detectLearnerBlock.ts) - same signal SessionPage sends, so the
    // backend can have the AI offer one example answer for this turn
    // instead of just moving on (CecrlProfileService::BLOCKED_INSTRUCTION).
    const { blocked } = detectLearnerBlock(transcript);
    if (blocked) setHelpUnlocked(true);

    try {
      const response = await api.post<{ assistantMessage: string }>("/daily-challenge/message", {
        message: transcript,
        learnerBlocked: blocked,
      });
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      speakAssistantLine(response.data.assistantMessage);
      setFailedSend(null);
    } catch (error) {
      // A 422 is an expected rejection (e.g. echo detection): nothing to
      // say, the mic just resumes listening for a real answer. Anything
      // else (network/API failure) gets a visible error instead of failing
      // silently.
      const status = (error as { response?: { status?: number } }).response?.status;
      setAvatarState("idle");
      if (status !== 422) {
        setSendError(normalizeApiError(error));
        setFailedSend({ transcript });
      }
    } finally {
      setSending(false);
    }
  }

  function handleVoiceResult(transcript: string) {
    const userMessage: ChatMessage = { id: Date.now(), role: "user", content: transcript };
    setMessages((current) => [...current, userMessage]);
    return sendMessage(transcript);
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const response = await api.post<DailyChallengeFinishResult>("/daily-challenge/finish");
      setResult(response.data);
    } finally {
      setFinishing(false);
    }
  }

  if (!challenge) {
    if (loadError) {
      return (
        <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
          <ErrorBanner
            message={loadError.message}
            onRetry={loadError.retryable ? loadChallenge : undefined}
          />
        </main>
      );
    }
    return <LoadingScreen />;
  }

  if (result || challenge.completed) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Défi relevé ! 🎉</h1>
          {result && (
            <RewardBanner badges={result.newBadges} trophies={result.newTrophies} levelUp={result.levelUp} />
          )}
          <p className="text-slate-300 mb-6">
            +{result?.xpEarned ?? challenge.xpReward} XP (bonus x2 défi du jour)
          </p>
          <Button to="/dashboard">Dashboard</Button>
        </Card>
      </main>
    );
  }

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? null;

  // Mirrors the 3 real avatarState values (idle/thinking/speaking) plus the
  // in-flight `sending` request into a single learner-facing line for the
  // mic zone below - no new state, just a label over what useConversationSession
  // and sendMessage() already track.
  const turnStatusLabel =
    sending || avatarState === "thinking"
      ? "Analyse de ta réponse..."
      : avatarState === "speaking"
        ? "LinguaBot parle..."
        : "À toi de parler";

  // Same idea, for the pre-launch "are you ready?" exchange - no "sending"/
  // "thinking" state exists here (classifyOnboardingReadiness runs locally,
  // no network round-trip), so this only ever toggles between LinguaBot
  // talking and listening for the reply.
  const missionReadyStatusLabel = avatarState === "speaking" ? "LinguaBot parle..." : "Dis \"yes\" quand tu es prêt";

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Zone A - header: full "Défi du jour · +XP reward" badge before
            the mission starts, collapsed to a one-line reminder once it
            does (§10.A - the detailed presentation must fully disappear,
            not just shrink in place). */}
        {!chatStarted ? (
          <div className="flex items-center justify-between mb-2">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">🔥 Défi du jour</p>
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-3 py-1 text-xs font-bold">
              +{challenge.xpReward} XP
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-1">
            <span aria-hidden="true">🔥</span>
            <span className="text-white font-semibold">{challenge.title}</span>
            <span aria-hidden="true">·</span>
            <span>En cours</span>
          </div>
        )}

        {/* Zone B - the avatar itself: a single persistent AvatarScene
            instance (never remounted between the two states, only its
            height changes) so starting the challenge never reloads the 3D
            model or avatar-ready gate - just grows it. "relative" wrapper,
            not AvatarScene's own root div - see the comment in
            SessionPage.tsx for why. No opaque Card around it on purpose
            (§3.B/§10.B): transparentBackground lets it sit directly on the
            page's own Deep Navy background instead of inside a boxed panel. */}
        <div className="relative">
          <AvatarScene
            state={avatarState}
            avatarType={user?.avatarType ?? "male"}
            speechText={speechText}
            charIndexRef={charIndexRef}
            onReady={handleAvatarReady}
            framing="portrait"
            transparentBackground
            showStateLabel={false}
            heightClassName={chatStarted ? AVATAR_HEIGHT_DURING_CHALLENGE : AVATAR_HEIGHT_BEFORE_START}
          />
          <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
        </div>

        {!chatStarted ? (
          <>
            {/* LinguaBot explains the mission and asks if the learner is
                ready (buildMissionBriefing effect above) - same mic, same
                disabled-while-speaking rule, same intent classifier as
                everywhere else the avatar asks a yes/no question. The
                manual "Relever le défi" button below stays the fallback
                for a learner without a working mic, or who just prefers it. */}
            <div className="flex flex-col items-center gap-2 mt-3 mb-5">
              <p className="text-sm font-semibold text-white">{missionReadyStatusLabel}</p>
              <VoiceInput
                onResult={handleMissionReadyReply}
                disabled={avatarState === "speaking" || avatarState === "thinking"}
                variant="brand"
                size="compact"
              />
            </div>

            {/* Zone C - mission title, visually important, and zone D - the
                mission card itself, deliberately narrower than the page
                column (§3.D: 600-700px, not edge-to-edge). */}
            <div className="text-center mt-4 mb-6">
              <h1 className="text-3xl font-bold">{challenge.title}</h1>
              <p className="text-slate-400 text-sm mt-1">Une mini-mission pour pratiquer ton anglais.</p>
            </div>

            <div className="max-w-[640px] mx-auto bg-gradient-to-b from-slate-800/80 to-slate-800/40 border border-slate-700/50 rounded-2xl p-5 shadow-lg shadow-black/20 mb-6">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-3">🎯 Ta mission</p>
              <p className="text-slate-400 text-sm leading-relaxed mb-2">{challenge.context}</p>
              <p className="text-white text-base font-semibold leading-relaxed">{challenge.objective}</p>
              {challenge.keywords.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-4">
                  {challenge.keywords.map((keyword) => (
                    <span key={keyword} className="bg-slate-900/60 text-slate-500 text-[11px] px-2.5 py-1 rounded-full">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button onClick={handleStart} size="lg">▶ Relever le défi</Button>
            </div>
          </>
        ) : (
          <>
            {/* Zone: turn status + mic, the primary interaction once the
                mission is active (§ÉTAT 2.C). The mic must stay off while
                the AI is talking or about to talk, otherwise it can pick
                its own voice back up through the speakers and "answer its
                own question" - "thinking" is included because avatarState
                flips to "speaking" only once the browser's TTS actually
                starts, which lags behind the reply arriving. */}
            <div className="flex flex-col items-center gap-2 mt-3 mb-5">
              <p className="text-sm font-semibold text-white">{turnStatusLabel}</p>
              <VoiceInput
                onResult={handleVoiceResult}
                disabled={sending || avatarState === "speaking" || avatarState === "thinking"}
                variant="brand"
                size="compact"
              />
            </div>

            <ConversationLog
              messages={messages}
              initialShowText={challenge.cecrlProfile.transcriptMode === "auto"}
            />

            {challenge.cecrlProfile.helpVisibleByDefault || helpUnlocked ? (
              <HelpPanel
                profile={challenge.cecrlProfile}
                translateEndpoint="/daily-challenge/translate"
                hintEndpoint="/daily-challenge/hint"
                textToTranslate={lastAssistantMessage}
                onHintReceived={speakAssistantLine}
              />
            ) : (
              <div className="mb-4">
                <Button onClick={() => setHelpUnlocked(true)} variant="secondary" size="sm">
                  Besoin d'aide ?
                </Button>
              </div>
            )}

            {sendError && (
              <div className="mb-4">
                <ErrorBanner
                  message={sendError.message}
                  onRetry={
                    sendError.retryable && failedSend
                      ? () => sendMessage(failedSend.transcript)
                      : undefined
                  }
                />
              </div>
            )}

            <Button
              onClick={handleFinish}
              disabled={finishing || messages.filter((m) => m.role === "user").length === 0}
              variant="success"
            >
              {finishing ? "..." : "Terminer le défi"}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
