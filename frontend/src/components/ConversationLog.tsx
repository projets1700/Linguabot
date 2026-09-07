import { useState } from "react";

type Message = { id: number; role: "user" | "assistant"; content: string };

type Props = {
  messages: Message[];
  bottomRef?: React.RefObject<HTMLDivElement | null>;
};

/**
 * The AI is meant to be heard (see speakText in lib/speech.ts), not read -
 * so the transcript stays hidden by default, replaced by an audio-mode
 * placeholder. "Je n'ai pas compris" reveals it on demand for a learner who
 * missed something, without turning the whole app back into a chat log.
 */
export function ConversationLog({ messages, bottomRef }: Props) {
  const [showText, setShowText] = useState(false);

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex-1 bg-slate-900 rounded-xl p-4 flex flex-col gap-3 overflow-y-auto min-h-[300px]">
        {showText ? (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[80%] px-4 py-2 rounded-xl ${
                  message.role === "assistant" ? "bg-slate-800 self-start" : "bg-blue-600 self-end"
                }`}
              >
                {message.content}
              </div>
            ))}
            {bottomRef && <div ref={bottomRef} />}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-slate-500 text-sm">
            🔊 Mode audio — écoute la conversation
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowText((current) => !current)}
        className="self-center text-xs text-slate-400 underline hover:text-slate-300"
      >
        {showText ? "Masquer le texte" : "Je n'ai pas compris ? Afficher le texte"}
      </button>
    </div>
  );
}
