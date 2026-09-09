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
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { useAuthStore } from "../stores/authStore";
import type { DailyChallenge, DailyChallengeFinishResult } from "../types";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

export function DailyChallengePage() {
  const user = useAuthStore((state) => state.user);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<DailyChallengeFinishResult | null>(null);
  const {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
  } = useConversationSession();

  function loadChallenge() {
    setLoadError(false);
    api
      .get<DailyChallenge>("/daily-challenge")
      .then((response) => setChallenge(response.data))
      .catch(() => setLoadError(true));
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

  async function handleVoiceResult(transcript: string) {
    setSending(true);
    setSendError(false);
    setAvatarState("thinking");
    const userMessage: ChatMessage = { id: Date.now(), role: "user", content: transcript };
    const turnNumber = messages.filter((m) => m.role === "user").length;
    // The backend doesn't persist this conversation, so it has no way to
    // know what was already said - the frontend (which does render the
    // full transcript) is the source of truth it needs for real GPT-4o
    // replies and for detecting an echo/repeat request server-side.
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);

    // A deterministic "I'm stuck" detection, not a grammar/quality judgment
    // (see detectLearnerBlock.ts) - same signal SessionPage sends, so the
    // backend can have the AI offer one example answer for this turn
    // instead of just moving on (CecrlProfileService::BLOCKED_INSTRUCTION).
    const { blocked } = detectLearnerBlock(transcript);

    try {
      const response = await api.post<{ assistantMessage: string }>("/daily-challenge/message", {
        message: userMessage.content,
        turnNumber,
        history,
        learnerBlocked: blocked,
      });
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      speakAssistantLine(response.data.assistantMessage);
    } catch (error) {
      // A 422 is an expected rejection (e.g. echo detection): nothing to
      // say, the mic just resumes listening for a real answer. Anything
      // else (network/API failure) gets a visible error instead of failing
      // silently.
      const status = (error as { response?: { status?: number } }).response?.status;
      setAvatarState("idle");
      if (status !== 422) {
        setSendError(true);
      }
    } finally {
      setSending(false);
    }
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
          <ErrorBanner message="Impossible de charger le défi du jour." onRetry={loadChallenge} />
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
  const historyForHint = messages.map(({ role, content }) => ({ role, content }));

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 max-w-2xl mx-auto">
      <p className="text-amber-400 text-sm font-semibold mb-1 uppercase">Défi du jour · +{challenge.xpReward} XP</p>
      <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
      <p className="text-slate-300 mb-2">{challenge.context}</p>
      <p className="text-slate-400 mb-4">🎯 {challenge.objective}</p>
      <div className="flex gap-2 mb-6">
        {challenge.keywords.map((keyword) => (
          <span key={keyword} className="bg-slate-800 text-xs px-3 py-1 rounded-full">
            {keyword}
          </span>
        ))}
      </div>

      {!chatStarted ? (
        <Button onClick={handleStart} size="lg">Relever le défi</Button>
      ) : (
        <>
          {/* relative wrapper, not AvatarScene's own root div - see the
              comment in SessionPage.tsx for why. */}
          <div className="relative mb-4">
            <AvatarScene
              state={avatarState}
              avatarType={user?.avatarType ?? "male"}
              speechText={speechText}
              charIndexRef={charIndexRef}
              onReady={handleAvatarReady}
            />
            <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
          </div>

          <ConversationLog
            messages={messages}
            initialShowText={challenge.cecrlProfile.transcriptMode === "auto"}
          />

          <HelpPanel
            profile={challenge.cecrlProfile}
            translateEndpoint="/daily-challenge/translate"
            hintEndpoint="/daily-challenge/hint"
            textToTranslate={lastAssistantMessage}
            hintBody={{ history: historyForHint }}
            onHintReceived={speakAssistantLine}
          />

          <div className="mb-4">
            {/* The mic must stay off while the AI is talking or about to
                talk, otherwise it can pick its own voice back up through
                the speakers and "answer its own question" - "thinking" is
                included because avatarState flips to "speaking" only once
                the browser's TTS actually starts, which lags behind the
                reply arriving. */}
            <VoiceInput
              onResult={handleVoiceResult}
              disabled={sending || avatarState === "speaking" || avatarState === "thinking"}
            />
          </div>

          {sendError && (
            <div className="mb-4">
              <ErrorBanner message="Échec de l'envoi du message. Réessaie en parlant à nouveau." />
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
