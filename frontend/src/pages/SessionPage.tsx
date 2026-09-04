import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { SessionDetail, SessionFinishResult, SessionMessage } from "../types";

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<SessionFinishResult | null>(null);
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
      }
    });

    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;

    setSending(true);
    const userMessage: SessionMessage = { id: Date.now(), role: "user", content: draft };
    setMessages((current) => [...current, userMessage]);
    setDraft("");

    try {
      const response = await api.post<{ userTranscript: string; assistantMessage: string }>(
        `/sessions/${id}/message`,
        { message: userMessage.content },
      );
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: response.data.assistantMessage },
      ]);
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
          <h1 className="text-3xl font-bold mb-4">Session terminée</h1>
          <p className="text-slate-300 mb-2">Score : {result.score}/100</p>
          <p className="text-slate-300 mb-6">+{result.xpEarned} XP</p>
          <div className="flex gap-4 justify-center">
            <Link to="/catalog" className="bg-blue-600 px-4 py-2 rounded-lg">
              Rejouer un scénario
            </Link>
            <Link to="/dashboard" className="bg-slate-800 px-4 py-2 rounded-lg">
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{session.scenario.title}</h1>
          <p className="text-slate-400 text-sm">Avec {session.scenario.characterName}</p>
        </div>
        <button
          onClick={handleFinish}
          disabled={finishing || messages.filter((m) => m.role === "user").length === 0}
          className="bg-green-600 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {finishing ? "..." : "Terminer la session"}
        </button>
      </div>

      <div className="flex-1 bg-slate-900 rounded-xl p-4 mb-4 flex flex-col gap-3 overflow-y-auto min-h-[400px]">
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

      <form onSubmit={handleSend} className="flex gap-3">
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Répondez en anglais..."
          className="flex-1 bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-blue-600 px-6 py-2 rounded-lg disabled:opacity-50"
        >
          {sending ? "..." : "Envoyer"}
        </button>
      </form>
    </main>
  );
}
