import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
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

type MicCycleState = "speaking" | "thinking" | "listening" | "ready";

const MIC_CYCLE_CONTENT: Record<MicCycleState, { icon: string; title: string; subtitle?: string }> = {
  speaking: { icon: "🔊", title: "LinguaBot parle…" },
  thinking: { icon: "✦", title: "LinguaBot réfléchit…" },
  ready: { icon: "🎙", title: "À toi de parler" },
  listening: { icon: "🎙", title: "À toi de parler", subtitle: "● Je t'écoute…" },
};

const CLASSROOM_BACKGROUND_SRC = "/images/dashboard/classroom-background.webp";
const CLASSROOM_BACKGROUND_STYLE: CSSProperties = {
  backgroundImage: `url(${CLASSROOM_BACKGROUND_SRC})`,
  backgroundSize: "cover",
  backgroundPosition: "center 32%",
  filter: "blur(1px)",
};

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
  const [showTranscript, setShowTranscript] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
  } = useConversationSession();

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

  const lastAssistantMessage = messages.filter((message) => message.role === "assistant").at(-1)?.content ?? "";

  function replayCurrentLine() {
    if (lastAssistantMessage) {
      speakAssistantLine(lastAssistantMessage);
    }
  }

  const micCycleState: MicCycleState =
    avatarState === "speaking"
      ? "speaking"
      : sending || avatarState === "thinking"
        ? "thinking"
        : micListening
          ? "listening"
          : "ready";
  const micCycleContent = MIC_CYCLE_CONTENT[micCycleState];

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <main className="relative flex-1 flex flex-col text-white overflow-hidden">
        <div className="absolute inset-0 scale-105" style={CLASSROOM_BACKGROUND_STYLE} aria-hidden="true" />
        <div className="absolute inset-0 bg-[#0b1220]/20" aria-hidden="true" />

        <div className="relative z-10 flex items-start justify-between gap-4 p-4 sm:p-6 shrink-0">
          <p className="font-bold text-white/90">LinguaBot</p>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-white/70">
              Test oral · {Math.min(answeredCount + 1, totalQuestions)} sur {totalQuestions}
            </p>
            <div className="flex gap-1 mt-1.5 justify-end" aria-hidden="true">
              {Array.from({ length: totalQuestions }, (_, index) => (
                <span
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index < answeredCount
                      ? "bg-blue-400"
                      : index === answeredCount
                        ? "bg-blue-400/70 ring-2 ring-blue-400"
                        : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3 px-4 pb-3">
          <div className="relative w-full max-w-[300px] sm:max-w-[340px] mt-10 [@media(min-height:700px)]:mt-20 [@media(min-height:900px)]:mt-32">
            <div
              className="absolute left-1/2 bottom-6 -translate-x-1/2 w-[65%] h-8 rounded-full bg-black/25 blur-xl pointer-events-none"
              aria-hidden="true"
            />
            <AvatarScene
              state={avatarState}
              avatarType={user?.avatarType ?? "male"}
              speechText={speechText}
              charIndexRef={charIndexRef}
              onReady={handleAvatarReady}
              framing="placementTestPortrait"
              transparentBackground
              showStateLabel={false}
              heightClassName="h-[40vh] sm:h-[48vh] min-h-[280px]"
            />
          </div>

          <div className="relative w-full max-w-[560px] -mt-8 [@media(min-height:700px)]:-mt-16 bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3.5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-400">LinguaBot</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={replayCurrentLine}
                  aria-label="Réécouter"
                  className="text-blue-300 hover:text-blue-200"
                >
                  🔊
                </button>
                <VoiceInput
                  onResult={handleVoiceResult}
                  disabled={sending || finishing || avatarState === "speaking"}
                  onListeningChange={setMicListening}
                  hideStatusText
                  variant="brand"
                  size="compact"
                />
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto mt-1.5">
              {showTranscript && lastAssistantMessage ? (
                <p className="text-white text-sm leading-snug">{lastAssistantMessage}</p>
              ) : (
                <p className="text-slate-300 text-sm italic">Écoute attentivement la question…</p>
              )}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-white uppercase tracking-wide mt-2">
              <span aria-hidden="true">{micCycleContent.icon}</span> {micCycleContent.title}
              {micCycleContent.subtitle && (
                <span className="text-slate-300 normal-case font-normal">· {micCycleContent.subtitle}</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowTranscript((current) => !current)}
              className="block mx-auto mt-1 text-xs text-slate-300 underline hover:text-white"
            >
              {showTranscript ? "Masquer le texte" : "Afficher le texte"}
            </button>
          </div>

          {sendError && <ErrorBanner message="Échec de l'envoi de la réponse. Réessaie en parlant à nouveau." />}

          <p className="text-xs text-white/40 text-center">
            Ce test est obligatoire une seule fois, juste après ton inscription.
          </p>
        </div>
      </main>
    </div>
  );
}
