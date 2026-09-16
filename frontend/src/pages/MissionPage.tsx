import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { ConversationLog } from "../components/ConversationLog";
import { HelpPanel } from "../components/HelpPanel";
import { RewardBanner } from "../components/RewardBanner";
import { RoomBackdrop } from "../components/RoomBackdrop";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { useAuthStore } from "../stores/authStore";
import type { MissionFinishResult, MissionSessionDetail, MissionSessionMessage } from "../types";

/**
 * Runs a Mission's conversation - the V2 pilot equivalent of SessionPage,
 * reusing the exact same voice/help/pronunciation/finish plumbing. Unlike
 * DailyChallengePage's separate briefing/ready-check state, a Mission is
 * already explicitly started by the "Start" click on RoomPage, so this
 * mirrors SessionPage's simpler "load an already-started session, speak its
 * opening line, converse" flow rather than DailyChallengePage's.
 */
export function MissionPage() {
  const { missionSessionId } = useParams<{ missionSessionId: string }>();
  const user = useAuthStore((state) => state.user);
  const [missionSession, setMissionSession] = useState<MissionSessionDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [messages, setMessages] = useState<MissionSessionMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [failedTranscript, setFailedTranscript] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<MissionFinishResult | null>(null);
  const [helpUnlocked, setHelpUnlocked] = useState(false);
  const {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
  } = useConversationSession();
  const openingSpokenRef = useRef(false);

  useEffect(() => {
    let ignore = false;
    setLoadError(null);
    openingSpokenRef.current = false;

    api
      .get<MissionSessionDetail>(`/mission-sessions/${missionSessionId}`)
      .then((response) => {
        if (ignore) return;
        setMissionSession(response.data);
        setMessages(response.data.messages);

        if ("in_progress" === response.data.status && !openingSpokenRef.current) {
          const opening = response.data.messages.at(-1);
          if (opening) {
            openingSpokenRef.current = true;
            speakAssistantLine(opening.content);
          }
        }
      })
      .catch((error) => {
        if (!ignore) setLoadError(normalizeApiError(error));
      });

    return () => {
      ignore = true;
    };
    // speakAssistantLine comes from useConversationSession() and must not
    // retrigger this fetch - it only ever needs to run once per session id.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [missionSessionId, retryCount]);

  async function sendMessage(transcript: string) {
    setSending(true);
    setSendError(null);
    setAvatarState("thinking");

    const { blocked } = detectLearnerBlock(transcript);
    if (blocked) setHelpUnlocked(true);

    try {
      const response = await api.post<{ userTranscript: string; assistantMessage: string }>(
        `/mission-sessions/${missionSessionId}/message`,
        { message: transcript, learnerBlocked: blocked },
      );
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      speakAssistantLine(response.data.assistantMessage);
      setFailedTranscript(null);
    } catch (error) {
      setAvatarState("idle");
      setSendError(normalizeApiError(error));
      setFailedTranscript(transcript);
    } finally {
      setSending(false);
    }
  }

  function handleVoiceResult(transcript: string) {
    const userMessage: MissionSessionMessage = { id: Date.now(), role: "user", content: transcript };
    setMessages((current) => [...current, userMessage]);
    return sendMessage(transcript);
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const response = await api.post<MissionFinishResult>(`/mission-sessions/${missionSessionId}/finish`);
      setResult(response.data);
    } finally {
      setFinishing(false);
    }
  }

  if (!missionSession) {
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

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <Card className="w-full max-w-lg text-center">
          <h1 className="text-3xl font-bold mb-4">Mission complete!</h1>
          <RewardBanner badges={result.newBadges} trophies={result.newTrophies} levelUp={result.levelUp} />
          <SessionSummaryCard summary={result.summary} />
          <div className="flex gap-4 justify-center">
            <Button to={`/aventure/${missionSession.mission.worldCode}/${missionSession.mission.roomCode}`}>
              Back to room
            </Button>
            <Button to="/dashboard" variant="secondary">
              Dashboard
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? null;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{missionSession.mission.title}</h1>
          <p className="text-slate-400 text-sm">
            With {missionSession.mission.characterName} · {missionSession.mission.roomTitle}
          </p>
        </div>
        <Button
          onClick={handleFinish}
          disabled={finishing || messages.filter((m) => m.role === "user").length === 0}
          variant="success"
        >
          {finishing ? "..." : "Finish mission"}
        </Button>
      </div>

      <div className="mb-4">
        <RoomBackdrop
          backgroundImageSrc={missionSession.mission.backgroundImageSrc}
          roomTitle={missionSession.mission.roomTitle}
          avatarState={avatarState}
          avatarType={user?.avatarType ?? "male"}
          speechText={speechText}
          charIndexRef={charIndexRef}
          onReady={handleAvatarReady}
          heightClassName="h-[280px] sm:h-[340px]"
        />
      </div>

      <ConversationLog
        messages={messages}
        initialShowText={missionSession.cecrlProfile.transcriptMode === "auto"}
      />

      {missionSession.cecrlProfile.helpVisibleByDefault || helpUnlocked ? (
        <HelpPanel
          profile={missionSession.cecrlProfile}
          translateEndpoint={`/mission-sessions/${missionSessionId}/translate`}
          hintEndpoint={`/mission-sessions/${missionSessionId}/hint`}
          textToTranslate={lastAssistantMessage}
          onHintReceived={speakAssistantLine}
        />
      ) : (
        <div className="mb-4">
          <Button onClick={() => setHelpUnlocked(true)} variant="secondary" size="sm">
            Need help?
          </Button>
        </div>
      )}

      <VoiceInput onResult={handleVoiceResult} disabled={sending || avatarState === "speaking"} />

      {sendError && (
        <ErrorBanner
          message={sendError.message}
          onRetry={sendError.retryable && failedTranscript ? () => sendMessage(failedTranscript) : undefined}
        />
      )}
    </main>
  );
}
