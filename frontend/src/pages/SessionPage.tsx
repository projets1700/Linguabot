import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { ConversationLog } from "../components/ConversationLog";
import { HelpPanel } from "../components/HelpPanel";
import { PronunciationPractice } from "../components/PronunciationPractice";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { selectPracticeSentence } from "../lib/selectPracticeSentence";
import { useAuthStore } from "../stores/authStore";
import type { SessionDetail, SessionFinishResult, SessionMessage } from "../types";

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<SessionFinishResult | null>(null);
  const {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
  } = useConversationSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Guard against React StrictMode's dev-mode double effect invocation:
    // without `ignore`, the first (discarded) run's late-resolving fetch
    // would overwrite messages already sent under the second run.
    let ignore = false;

    api.get<SessionDetail>(`/sessions/${id}`).then((response) => {
      if (!ignore) {
        setSession(response.data);
        setMessages(response.data.messages);
        const opening = response.data.messages.at(-1);
        if (opening) {
          speakAssistantLine(opening.content);
        }
      }
    });

    return () => {
      ignore = true;
    };
    // speakAssistantLine comes from useConversationSession() and must not
    // retrigger this fetch - it only ever needs to run once per session id.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleVoiceResult(transcript: string) {
    setSending(true);
    setSendError(false);
    setAvatarState("thinking");
    const userMessage: SessionMessage = { id: Date.now(), role: "user", content: transcript };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await api.post<{ userTranscript: string; assistantMessage: string }>(
        `/sessions/${id}/message`,
        { message: userMessage.content },
      );
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      speakAssistantLine(response.data.assistantMessage);
    } catch {
      setAvatarState("idle");
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const response = await api.post<SessionFinishResult>(`/sessions/${id}/finish`);
      setResult(response.data);
    } finally {
      setFinishing(false);
    }
  }

  if (!session) {
    return <LoadingScreen />;
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Session terminée</h1>
          <RewardBanner badges={result.newBadges} trophies={result.newTrophies} levelUp={result.levelUp} />
          <p className="text-slate-300 mb-2">Score : {result.score}/100</p>
          <p className="text-slate-300 mb-6">+{result.xpEarned} XP</p>
          <div className="flex gap-4 justify-center">
            <Button to="/catalog">Rejouer un scénario</Button>
            <Button to="/dashboard" variant="secondary">Dashboard</Button>
          </div>
        </Card>
      </main>
    );
  }

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? null;
  // Extracted verbatim from the AI's own last line, never rewritten - a
  // full reply can run several sentences/too long to usefully repeat aloud,
  // see selectPracticeSentence.ts. null when nothing in it is usable.
  const practiceSentence = lastAssistantMessage
    ? selectPracticeSentence(lastAssistantMessage, user?.level.code)
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{session.scenario.title}</h1>
          <p className="text-slate-400 text-sm">Avec {session.scenario.characterName}</p>
        </div>
        <Button
          onClick={handleFinish}
          disabled={finishing || messages.filter((m) => m.role === "user").length === 0}
          variant="success"
        >
          {finishing ? "..." : "Terminer la session"}
        </Button>
      </div>

      <div className="mb-4">
        <AvatarScene
          state={avatarState}
          avatarType={user?.avatarType ?? "male"}
          speechText={speechText}
          charIndexRef={charIndexRef}
          onReady={handleAvatarReady}
        />
      </div>

      <ConversationLog
        messages={messages}
        bottomRef={bottomRef}
        initialShowText={session.cecrlProfile.transcriptMode === "auto"}
      />

      <HelpPanel
        profile={session.cecrlProfile}
        translateEndpoint={`/sessions/${id}/translate`}
        hintEndpoint={`/sessions/${id}/hint`}
        textToTranslate={lastAssistantMessage}
      />

      {practiceSentence && (
        <div className="mb-4">
          {/* transcriptMode doubles as the prominence signal here (auto for
              A0/A1, available for A2, onDemand for B1/B2) - same repurposing
              pattern HelpPanel already uses for its translate button,
              instead of adding a new CECRL field for this one component. */}
          <PronunciationPractice
            targetText={practiceSentence}
            prominence={session.cecrlProfile.transcriptMode}
          />
        </div>
      )}

      {/* The mic must stay off while the AI is talking, otherwise it can
          pick its own voice back up through the speakers and "answer its
          own question". */}
      <VoiceInput onResult={handleVoiceResult} disabled={sending || avatarState === "speaking"} />

      {sendError && <ErrorBanner message="Échec de l'envoi du message. Réessaie en parlant à nouveau." />}
    </main>
  );
}
