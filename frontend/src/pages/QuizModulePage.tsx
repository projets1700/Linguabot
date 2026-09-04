import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { QuizAttemptResult, QuizQuestion } from "../types";

export function QuizModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  useEffect(() => {
    api
      .get<QuizQuestion[]>(`/quiz/modules/${moduleId}/questions`)
      .then((response) => setQuestions(response.data))
      .finally(() => setLoading(false));
  }, [moduleId]);

  async function handleSubmitAnswer(event: FormEvent) {
    event.preventDefault();

    const question = questions[currentIndex];
    const nextAnswers = { ...answers, [question.id]: currentAnswer };
    setAnswers(nextAnswers);
    setCurrentAnswer("");

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
      <form
        onSubmit={handleSubmitAnswer}
        className="bg-slate-900 p-8 rounded-xl w-full max-w-md flex flex-col gap-4"
      >
        <p className="text-slate-400 text-sm">
          Question {currentIndex + 1} / {questions.length}
        </p>
        <h1 className="text-2xl font-bold">{question.questionText}</h1>

        <input
          autoFocus
          required
          value={currentAnswer}
          onChange={(event) => setCurrentAnswer(event.target.value)}
          placeholder="Votre réponse en anglais"
          className="bg-slate-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-600"
        />

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {submitting
            ? "Envoi..."
            : currentIndex < questions.length - 1
              ? "Suivant"
              : "Valider"}
        </button>
      </form>
    </main>
  );
}
