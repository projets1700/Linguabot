import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { ConversationLog } from "../components/ConversationLog";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { speakEnglishWithAvatar } from "../lib/speech";
import type { AzureVisemeFrame } from "../lib/azureSpeech";
import { useAuthStore } from "../stores/authStore";
import type { DailyChallenge, DailyChallengeFinishResult } from "../types";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

export function DailyChallengePage() {
  const user = useAuthStore((state) => state.user);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<DailyChallengeFinishResult | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [speechText, setSpeechText] = useState<string | null>(null);
  const charIndexRef = useRef<number | null>(null);
  const visemeFramesRef = useRef<AzureVisemeFrame[]>([]);
  const visemeStartTimeRef = useRef<number | null>(null);
  // AvatarScene isn't even mounted until chatStarted (see the JSX below) -
  // its ~30MB of GLB/FBX assets only start loading right as handleStart
  // fires, which is also exactly when this page wants to speak the opening
  // line, making this page the worst case for the race this gate fixes.
  // Any speech requested before onReady fires is held here and replayed
  // exactly once, the moment it does.
  const avatarReadyRef = useRef(false);
  const pendingSpeechRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api.get<DailyChallenge>("/daily-challenge").then((response) => setChallenge(response.data));
  }, []);

  function speakAssistantLine(text: string) {
    charIndexRef.current = null;
    setSpeechText(text);
    const avatarType = useAuthStore.getState().user?.avatarType ?? "male";
    const speak = () =>
      void speakEnglishWithAvatar(text, avatarType, { framesRef: visemeFramesRef, startTimeRef: visemeStartTimeRef }, {
        onStart: () => setAiSpeaking(true),
        onBoundary: (event) => {
          charIndexRef.current = event.charIndex;
        },
        onEnd: () => {
          setAiSpeaking(false);
          setSpeechText(null);
        },
      });

    if (avatarReadyRef.current) {
      speak();
    } else {
      pendingSpeechRef.current = speak;
    }
  }

  function handleAvatarReady() {
    avatarReadyRef.current = true;
    const pending = pendingSpeechRef.current;
    if (pending) {
      pendingSpeechRef.current = null;
      pending();
    }
  }

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
    const userMessage: ChatMessage = { id: Date.now(), role: "user", content: transcript };
    const turnNumber = messages.filter((m) => m.role === "user").length;
    // The backend doesn't persist this conversation, so it has no way to
    // know what was already said - the frontend (which does render the
    // full transcript) is the source of truth it needs for real GPT-4o
    // replies and for detecting an echo/repeat request server-side.
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await api.post<{ assistantMessage: string }>("/daily-challenge/message", {
        message: userMessage.content,
        turnNumber,
        history,
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
          <div className="mb-4">
            <AvatarScene
              state={aiSpeaking ? "speaking" : sending ? "thinking" : "idle"}
              avatarType={user?.avatarType ?? "male"}
              speechText={speechText}
              charIndexRef={charIndexRef}
              visemeFramesRef={visemeFramesRef}
              visemeStartTimeRef={visemeStartTimeRef}
              onReady={handleAvatarReady}
            />
          </div>

          <ConversationLog messages={messages} />

          <div className="mb-4">
            {/* The mic must stay off while the AI is talking, otherwise it
                can pick its own voice back up through the speakers and
                "answer its own question". */}
            <VoiceInput onResult={handleVoiceResult} disabled={sending || aiSpeaking} />
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
