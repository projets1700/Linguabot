import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { speakText } from "../lib/speech";
import type { QuizAttemptResult, QuizQuestion } from "../types";

export function QuizModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [showQuestionText, setShowQuestionText] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  useEffect(() => {
    api
      .get<QuizQuestion[]>(`/quiz/modules/${moduleId}/questions`)
      .then((response) => setQuestions(response.data))
      .finally(() => setLoading(false));
  }, [moduleId]);

  useEffect(() => {
    if (questions.length > 0) {
      speakText(questions[currentIndex].questionText, {
        onStart: () => setAiSpeaking(true),
        onEnd: () => setAiSpeaking(false),
      });
      setShowQuestionText(false);
    }
  }, [currentIndex, questions]);

  async function handleVoiceAnswer(transcript: string) {
    const question = questions[currentIndex];
    const nextAnswers = { ...answers, [question.id]: transcript };
    setAnswers(nextAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    setSubmitting(true);
    const response = await api.post<QuizAttemptResult>("/quiz/attempts", {
      moduleId: Number(moduleId),
      answers: nextAnswers,
    });
    setResult(response.data);
    setSubmitting(false);
  }

  if (loading) {
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
          {result.levelUp && (
            <p className="bg-blue-600 rounded-lg py-2 mb-4 font-bold">
              🎉 Niveau {result.userLevel} débloqué !
            </p>
          )}
          <RewardBanner badges={result.newBadges} trophies={result.newTrophies} />
          <h1 className="text-3xl font-bold mb-2">
            {result.passed ? "Module validé ✅" : "Module non validé"}
          </h1>
          <p className="text-slate-300 mb-4">
            Score : {result.score}/{questions.length}
          </p>
          <p className="text-slate-300 mb-6">+{result.xpEarned} XP</p>
          <div className="flex gap-4 justify-center">
            <Link to="/quiz" className="bg-blue-600 px-4 py-2 rounded-lg">
              Retour aux modules
            </Link>
            <Link to="/dashboard" className="bg-slate-800 px-4 py-2 rounded-lg">
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const question = questions[currentIndex];

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="bg-slate-900 p-8 rounded-xl w-full max-w-md flex flex-col gap-4">
        <p className="text-slate-400 text-sm">
          Question {currentIndex + 1} / {questions.length}
        </p>

        {showQuestionText ? (
          <h1 className="text-2xl font-bold">{question.questionText}</h1>
        ) : (
          <p className="text-slate-500 text-sm text-center py-4">🔊 Mode audio — écoute la question</p>
        )}

        <button
          type="button"
          onClick={() => setShowQuestionText((current) => !current)}
          className="self-center text-xs text-slate-400 underline hover:text-slate-300"
        >
          {showQuestionText ? "Masquer le texte" : "Je n'ai pas compris ? Afficher le texte"}
        </button>

        {/* The mic must stay off while the AI is talking, otherwise it can
            pick its own voice back up through the speakers and "answer its
            own question". */}
        <VoiceInput onResult={handleVoiceAnswer} disabled={submitting || aiSpeaking} />

        {submitting && <p className="text-slate-400 text-sm text-center">Envoi...</p>}
      </div>
    </main>
  );
}
