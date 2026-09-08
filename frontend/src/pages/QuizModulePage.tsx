import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { speakText } from "../lib/speech";
import { buildSpokenQuizQuestion } from "../lib/quizSpeech";
import { useAuthStore } from "../stores/authStore";
import type { QuizAttemptResult, QuizQuestion } from "../types";

export function QuizModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const user = useAuthStore((state) => state.user);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [showQuestionText, setShowQuestionText] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [speechText, setSpeechText] = useState<string | null>(null);
  const charIndexRef = useRef<number | null>(null);

  useEffect(() => {
    // Guard against React StrictMode's dev-mode double effect invocation,
    // same reasoning as SessionPage/PlacementTestPage: without `ignore`,
    // both requests resolve and each calls setQuestions with its own freshly
    // parsed (referentially distinct) array - even though the content is
    // identical, that reference change made the speak-effect below think
    // `questions` had genuinely changed and re-fire speakText a second time
    // mid-utterance, which is what left the avatar's mouth stuck frozen.
    let ignore = false;

    api
      .get<QuizQuestion[]>(`/quiz/modules/${moduleId}/questions`)
      .then((response) => {
        if (!ignore) setQuestions(response.data);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [moduleId]);

  useEffect(() => {
    if (questions.length > 0) {
      // The A0 quiz's prompts are stored in French ("Comment dit-on
      // "X" ?" - QuizFixtures) since it's testing basic French-to-English
      // vocabulary for absolute beginners, and the on-screen text (revealed
      // on request below) stays exactly that. But reading the French
      // sentence aloud with an English voice - a local French voice turned
      // out unreliable, cutting audio short mid-sentence with no way to
      // detect that from the Web Speech API - produced hard-to-understand
      // "franglish". Spoken aloud, the question is translated to its
      // English wrapper instead ("How do you say X?"), keeping only the
      // quoted French word itself - the vocabulary being tested - unchanged.
      // Reset before speaking: a stale charIndex left over from a previous
      // question must not be mistaken for a fresh one on the very first
      // frame of this one.
      charIndexRef.current = null;
      const spokenQuestion = buildSpokenQuizQuestion(questions[currentIndex].questionText);
      setSpeechText(spokenQuestion);
      speakText(spokenQuestion, {
        onStart: () => setAiSpeaking(true),
        onBoundary: (event) => {
          charIndexRef.current = event.charIndex;
        },
        onEnd: () => {
          setAiSpeaking(false);
          setSpeechText(null);
        },
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
        <AvatarScene
          state={aiSpeaking ? "speaking" : submitting ? "thinking" : "idle"}
          avatarType={user?.avatarType ?? "male"}
          speechText={speechText}
          charIndexRef={charIndexRef}
        />

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
