import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ConversationLog } from "../components/ConversationLog";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { speakText } from "../lib/speech";
import type { DailyChallenge, DailyChallengeFinishResult } from "../types";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

export function DailyChallengePage() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<DailyChallengeFinishResult | null>(null);

  useEffect(() => {
    api.get<DailyChallenge>("/daily-challenge").then((response) => setChallenge(response.data));
  }, []);

  async function handleStart() {
    if (!challenge) return;
    const response = await api.post<{ openingMessage: string }>("/daily-challenge/start");
    setMessages([{ id: Date.now(), role: "assistant", content: response.data.openingMessage }]);
    setChatStarted(true);
    speakText(response.data.openingMessage);
  }

  async function handleVoiceResult(transcript: string) {
    setSending(true);
    const userMessage: ChatMessage = { id: Date.now(), role: "user", content: transcript };
    const turnNumber = messages.filter((m) => m.role === "user").length;
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await api.post<{ assistantMessage: string }>("/daily-challenge/message", {
        message: userMessage.content,
        turnNumber,
      });
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
      speakText(response.data.assistantMessage);
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
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p>Chargement...</p>
      </main>
    );
  }

  if (result || challenge.completed) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="bg-slate-900 p-8 rounded-xl w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Défi relevé ! 🎉</h1>
          {result && <RewardBanner badges={result.newBadges} trophies={result.newTrophies} />}
          <p className="text-slate-300 mb-6">
            +{result?.xpEarned ?? challenge.xpReward} XP (bonus x2 défi du jour)
          </p>
          <Link to="/dashboard" className="bg-blue-600 px-4 py-2 rounded-lg">
            Dashboard
          </Link>
        </div>
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
        <button onClick={handleStart} className="bg-blue-600 px-6 py-3 rounded-lg">
          Relever le défi
        </button>
      ) : (
        <>
          <ConversationLog messages={messages} />

          <div className="mb-4">
            <VoiceInput onResult={handleVoiceResult} disabled={sending} />
          </div>

          <button
            onClick={handleFinish}
            disabled={finishing || messages.filter((m) => m.role === "user").length === 0}
            className="bg-green-600 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {finishing ? "..." : "Terminer le défi"}
          </button>
        </>
      )}
    </main>
  );
}
