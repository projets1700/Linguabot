import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene, type AvatarState } from "../components/AvatarScene";
import { VoiceInput } from "../components/VoiceInput";
import { useAuthStore } from "../stores/authStore";
import type {
  PlacementTestDetail,
  PlacementTestFinishResult,
  PlacementTestMessageResult,
  SessionMessage,
} from "../types";

const SPEAKING_DURATION_MS = 2200;

export function PlacementTestPage() {
  const navigate = useNavigate();
  const fetchMe = useAuthStore((state) => state.fetchMe);

  const [test, setTest] = useState<PlacementTestDetail | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<PlacementTestFinishResult | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
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
          setAvatarState("speaking");
          setTimeout(() => setAvatarState("idle"), SPEAKING_DURATION_MS);
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
    setAvatarState("thinking");
    const userMessage: SessionMessage = { id: Date.now(), role: "user", content: transcript };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await api.post<PlacementTestMessageResult>(
        `/placement-test/${test.id}/message`,
        { message: userMessage.content },
      );
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      setAnsweredCount(response.data.answeredCount);
      setAvatarState("speaking");
      setTimeout(() => setAvatarState("idle"), SPEAKING_DURATION_MS);

      if (response.data.readyToFinish) {
        await finishTest(test.id);
      }
    } catch {
      setAvatarState("idle");
    } finally {
      setSending(false);
    }
  }

  if (!test) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p>Chargement...</p>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="bg-slate-900 p-8 rounded-xl w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Test terminé !</h1>
          <p className="text-slate-300 mb-2">Ton niveau estimé :</p>
          <p className="text-4xl font-bold text-blue-400 mb-6">{result.level.code}</p>
          <p className="text-slate-400 mb-6">{result.level.name}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-600 px-6 py-2 rounded-lg"
          >
            Accéder à mon tableau de bord
          </button>
        </div>
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

      <div className="mb-4">
        <AvatarScene state={avatarState} />
      </div>

      <div className="flex-1 bg-slate-900 rounded-xl p-4 mb-4 flex flex-col gap-3 overflow-y-auto min-h-[300px]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[80%] px-4 py-2 rounded-xl ${
              message.role === "assistant"
                ? "bg-slate-800 self-start"
                : "bg-blue-600 self-end"
            }`}
          >
            {message.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <VoiceInput onResult={handleVoiceResult} disabled={sending || finishing} />

      <p className="text-xs text-slate-500 text-center mt-4">
        Ce test est obligatoire une seule fois, juste après ton inscription.
      </p>
    </main>
  );
}
