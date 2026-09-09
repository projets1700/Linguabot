import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { AvatarSpeechBubble } from "../components/AvatarSpeechBubble";
import { ConversationLog } from "../components/ConversationLog";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { useAuthStore } from "../stores/authStore";
import type {
  PlacementTestDetail,
  PlacementTestFinishResult,
  PlacementTestMessageResult,
  SessionMessage,
} from "../types";

export function PlacementTestPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);

  const [test, setTest] = useState<PlacementTestDetail | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<PlacementTestFinishResult | null>(null);
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
    // Guard against React StrictMode's dev-mode double effect invocation,
    // same reasoning as SessionPage: without `ignore`, a stale second
    // "start" call could clobber messages from the first.
    let ignore = false;

    api
      .post<PlacementTestDetail>("/placement-test/start")
      .then((response) => {
        if (!ignore) {
          setTest(response.data);
          setMessages(response.data.messages);
          setTotalQuestions(response.data.totalQuestions);
          setAnsweredCount(response.data.answeredCount);
          const opening = response.data.messages.at(-1);
          if (opening) {
            speakAssistantLine(opening.content);
          }
        }
      })
      .catch(() => {
        // Already completed (e.g. a stale bookmark, or landing here via a
        // race RequireAuth has since been fixed to avoid): nothing left to
        // do here, send them on to the dashboard instead of hanging on a
        // permanent "Chargement..." spinner.
        if (!ignore) {
          navigate("/dashboard");
        }
      });

    return () => {
      ignore = true;
    };
    // navigate is stable (react-router) and speakAssistantLine comes from
    // useConversationSession() - neither should retrigger this fetch, which
    // only ever needs to run once on mount, same reasoning as SessionPage.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function finishTest(testId: number) {
    setFinishing(true);
    try {
      const response = await api.post<PlacementTestFinishResult>(`/placement-test/${testId}/finish`);
      // fetchMe() must resolve before the result screen (and its "go to
      // dashboard" button) appears: otherwise a fast click can navigate to
      // /dashboard while the store still holds the pre-test
      // placementTestCompleted: false, and RequireAuth bounces straight
      // back here - the backend already considers the test done, so
      // restarting it 422s and the page hangs on "Chargement...".
      await fetchMe();
      setResult(response.data);
    } finally {
      setFinishing(false);
    }
  }

  async function handleVoiceResult(transcript: string) {
    if (!test) return;

    setSending(true);
    setSendError(false);
    setAvatarState("thinking");
    const userMessage: SessionMessage = { id: Date.now(), role: "user", content: transcript };
    setMessages((current) => [...current, userMessage]);

    // Same detection as every other AI page (detectLearnerBlock.ts), but the
    // placement test is a graded evaluation: the backend only adds a warm,
    // content-free acknowledgment when blocked - it never reveals or hints
    // an answer here, since that would let the learner inflate their
    // measured level (see PlacementTestService::BLOCKED_ACKNOWLEDGMENT).
    const { blocked } = detectLearnerBlock(transcript);

    try {
      const response = await api.post<PlacementTestMessageResult>(
        `/placement-test/${test.id}/message`,
        { message: userMessage.content, learnerBlocked: blocked },
      );
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      setAnsweredCount(response.data.answeredCount);
      speakAssistantLine(response.data.assistantMessage);

      if (response.data.readyToFinish) {
        await finishTest(test.id);
      }
    } catch {
      setAvatarState("idle");
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  if (!test) {
    return <LoadingScreen />;
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Test terminé !</h1>
          <p className="text-slate-300 mb-2">Ton niveau estimé :</p>
          <p className="text-4xl font-bold text-blue-400 mb-6">{result.level.code}</p>
          <p className="text-slate-400 mb-6">{result.level.name}</p>
          <Button onClick={() => navigate("/dashboard")} size="lg">
            Accéder à mon tableau de bord
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Test de niveau oral</h1>
        <p className="text-slate-400 text-sm">
          Une courte discussion de 3 à 5 minutes en anglais pour évaluer ton niveau. Question{" "}
          {Math.min(answeredCount + 1, totalQuestions)} / {totalQuestions}.
        </p>
      </div>

      {/* relative wrapper, not AvatarScene's own root div - see the comment
          in SessionPage.tsx for why. */}
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

      <ConversationLog messages={messages} bottomRef={bottomRef} />

      {/* The mic must stay off while the AI is talking, otherwise it can
          pick its own voice back up through the speakers and "answer its
          own question". */}
      <VoiceInput onResult={handleVoiceResult} disabled={sending || finishing || avatarState === "speaking"} />

      {sendError && <ErrorBanner message="Échec de l'envoi de la réponse. Réessaie en parlant à nouveau." />}

      <p className="text-xs text-slate-500 text-center mt-4">
        Ce test est obligatoire une seule fois, juste après ton inscription.
      </p>
    </main>
  );
}
