import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { AvatarSpeechBubble } from "../components/AvatarSpeechBubble";
import { ConversationLog } from "../components/ConversationLog";
import { HelpPanel } from "../components/HelpPanel";
import { PronunciationPractice } from "../components/PronunciationPractice";
import { RewardBanner } from "../components/RewardBanner";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { selectPracticeSentence } from "../lib/selectPracticeSentence";
import { useAuthStore } from "../stores/authStore";
import type { SessionDetail, SessionFinishResult, SessionMessage } from "../types";

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  // The transcript behind the current sendError, so "Réessayer" can resend
  // the exact same turn without the learner repeating it by voice (V1.1
  // §4.3) - cleared on a successful send, kept across a failed retry.
  const [failedTranscript, setFailedTranscript] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<SessionFinishResult | null>(null);
  // Sticky once true: B1/B2 profiles keep HelpPanel hidden until the
  // learner explicitly asks (detectLearnerBlock or the "Besoin d'aide ?"
  // button below) - once unlocked for a turn, it stays available for the
  // rest of the session (see CecrlProfileService::PROFILES.helpVisibleByDefault).
  const [helpUnlocked, setHelpUnlocked] = useState(false);
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
    setLoadError(null);

    api
      .get<SessionDetail>(`/sessions/${id}`)
      .then((response) => {
        if (ignore) return;

        setSession(response.data);
        setMessages(response.data.messages);

        // A previously-finished session being reopened (refresh, or coming
        // back via the URL): show its persisted bilan directly instead of
        // the live conversation UI - there's nothing left to talk about, and
        // without this the learner would see the opening line replayed and
        // a "Terminer la session" button for a session that's already over.
        if ("completed" === response.data.status && response.data.summary) {
          // The score (0-100) and which badges/trophies were newly unlocked
          // are both point-in-time facts from the original finish() call,
          // never persisted (see Session::summaryData) - only the fields
          // this completed view actually renders (summary, and an empty
          // rewards state) are reconstructed here.
          setResult({
            score: 0,
            xpEarned: response.data.summary.xpEarned,
            userTotalXp: user?.totalXp ?? 0,
            userSessionsCount: user?.sessionsCount ?? 0,
            levelUp: null,
            newBadges: [],
            newTrophies: [],
            summary: response.data.summary,
          });

          return;
        }

        const opening = response.data.messages.at(-1);
        if (opening) {
          speakAssistantLine(opening.content);
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
  }, [id, retryCount]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Split from handleVoiceResult below so a failed send can be retried with
  // the exact same transcript (from the ErrorBanner's "Réessayer") without
  // adding a second user bubble or requiring a new voice turn.
  async function sendMessage(transcript: string) {
    setSending(true);
    setSendError(null);
    setAvatarState("thinking");

    // A deterministic "I'm stuck" detection, not a grammar/quality judgment
    // (see detectLearnerBlock.ts) - tells the backend to have the AI offer
    // one example answer for this turn instead of just moving on.
    const { blocked } = detectLearnerBlock(transcript);
    if (blocked) setHelpUnlocked(true);

    try {
      const response = await api.post<{ userTranscript: string; assistantMessage: string }>(
        `/sessions/${id}/message`,
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
    const userMessage: SessionMessage = { id: Date.now(), role: "user", content: transcript };
    setMessages((current) => [...current, userMessage]);
    return sendMessage(transcript);
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
          <h1 className="text-3xl font-bold mb-4">Session terminée</h1>
          <RewardBanner badges={result.newBadges} trophies={result.newTrophies} levelUp={result.levelUp} />
          <SessionSummaryCard summary={result.summary} />
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

      {/* relative wrapper, not AvatarScene's own root div: AvatarScene's
          canvas box uses overflow-hidden, which would clip a bubble wider
          than the 3D viewport - rendering the bubble as a sibling here
          instead keeps AvatarScene itself untouched. speechText only ever
          comes from useConversationSession's speakAssistantLine(), which
          SessionPage only ever calls with the AI's own reply - the
          learner's transcript never reaches this prop, so the bubble can
          never be mistaken for the learner's own words. */}
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
        bottomRef={bottomRef}
        initialShowText={session.cecrlProfile.transcriptMode === "auto"}
      />

      {session.cecrlProfile.helpVisibleByDefault || helpUnlocked ? (
        <HelpPanel
          profile={session.cecrlProfile}
          translateEndpoint={`/sessions/${id}/translate`}
          hintEndpoint={`/sessions/${id}/hint`}
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

      {sendError && (
        <ErrorBanner
          message={sendError.message}
          onRetry={sendError.retryable && failedTranscript ? () => sendMessage(failedTranscript) : undefined}
        />
      )}
    </main>
  );
}
