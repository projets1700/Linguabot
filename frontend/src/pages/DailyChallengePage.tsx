import { useEffect, useState } from "react";
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
import { useAuthStore } from "../stores/authStore";
import type { DailyChallenge, DailyChallengeFinishResult } from "../types";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

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

  async function handleStart() {
    if (!challenge) return;
    const response = await api.post<{ openingMessage: string }>("/daily-challenge/start");
    setMessages([{ id: Date.now(), role: "assistant", content: response.data.openingMessage }]);
    setChatStarted(true);
    speakAssistantLine(response.data.openingMessage);
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

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-4">
        <p className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-1">
          🔥 Défi du jour · +{challenge.xpReward} XP
        </p>
        <h1 className="text-2xl font-bold">{challenge.title}</h1>
        {!chatStarted && (
          <p className="text-slate-400 text-sm mt-1">Une mini-mission pour pratiquer ton anglais.</p>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-4 mb-4">
        <p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-2">🎯 Ta mission</p>
        <p className="text-slate-300 text-sm mb-1.5">{challenge.context}</p>
        <p className="text-white text-sm font-medium">{challenge.objective}</p>
        {!chatStarted && challenge.keywords.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {challenge.keywords.map((keyword) => (
              <span key={keyword} className="bg-slate-900 text-slate-400 text-xs px-3 py-1 rounded-full">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      {!chatStarted ? (
        <Button onClick={handleStart} size="lg">Relever le défi</Button>
      ) : (
        <>
          <div className="bg-slate-900/40 rounded-2xl overflow-hidden mb-4">
            {/* relative wrapper, not AvatarScene's own root div - see the
                comment in SessionPage.tsx for why. */}
            <div className="relative">
              <AvatarScene
                state={avatarState}
                avatarType={user?.avatarType ?? "male"}
                speechText={speechText}
                charIndexRef={charIndexRef}
                onReady={handleAvatarReady}
                framing="portrait"
                showStateLabel={false}
                heightClassName="h-[240px] sm:h-[280px]"
              />
              <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
            </div>

            {/* The mic becomes the primary action once the mission starts -
                attached directly under the avatar rather than floating in
                its own row further down the page. Same VoiceInput/onResult/
                disabled wiring as before; only variant/size changed (the
                Dashboard intro already established this "brand"+"compact"
                pairing for an avatar-attached mic). */}
            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-slate-900/60">
              <p className="text-sm font-semibold text-white">{turnStatusLabel}</p>
              {/* The mic must stay off while the AI is talking or about to
                  talk, otherwise it can pick its own voice back up through
                  the speakers and "answer its own question" - "thinking" is
                  included because avatarState flips to "speaking" only once
                  the browser's TTS actually starts, which lags behind the
                  reply arriving. */}
              <VoiceInput
                onResult={handleVoiceResult}
                disabled={sending || avatarState === "speaking" || avatarState === "thinking"}
                variant="brand"
                size="compact"
              />
            </div>
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
    </main>
  );
}
