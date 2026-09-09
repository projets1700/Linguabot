import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { AvatarSpeechBubble } from "../components/AvatarSpeechBubble";
import { RewardBanner } from "../components/RewardBanner";
import { VoiceInput } from "../components/VoiceInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useConversationSession } from "../hooks/useConversationSession";
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { buildBlockedHelpMessage, buildSpokenQuizQuestion } from "../lib/quizSpeech";
import { useAuthStore } from "../stores/authStore";
import type { QuizAttemptResult, QuizQuestion } from "../types";

export function QuizModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const user = useAuthStore((state) => state.user);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Question IDs where the correct answer was revealed after a detected
  // "I don't know" - repeating it back still ends the question, but must
  // not score the same as answering unaided (see QuizService::submitAttempt).
  const [helpedQuestionIds, setHelpedQuestionIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [showQuestionText, setShowQuestionText] = useState(false);
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
    // same reasoning as SessionPage/PlacementTestPage: without `ignore`,
    // both requests resolve and each calls setQuestions with its own freshly
    // parsed (referentially distinct) array - even though the content is
    // identical, that reference change made the speak-effect below think
    // `questions` had genuinely changed and re-fire speakText a second time
    // mid-utterance, which is what left the avatar's mouth stuck frozen.
    let ignore = false;
    setLoadError(false);

    api
      .get<QuizQuestion[]>(`/quiz/modules/${moduleId}/questions`)
      .then((response) => {
        if (!ignore) setQuestions(response.data);
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [moduleId, retryCount]);

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
      speakAssistantLine(buildSpokenQuizQuestion(questions[currentIndex].questionText));
      setShowQuestionText(false);
    }
    // speakAssistantLine comes from useConversationSession() and must not
    // retrigger this effect on its own.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questions]);

  async function handleVoiceAnswer(transcript: string) {
    const question = questions[currentIndex];

    // A deterministic "I'm stuck" detection, not a grammar/quality judgment
    // (see detectLearnerBlock.ts). Unlike the open conversation pages, the
    // quiz already has a known correct answer for this question, so the
    // avatar can just say it - see QuizController::answer() - instead of
    // asking the AI to invent one. This turn is NOT recorded as an answer:
    // no point, question stays active, the learner can retry after.
    const { blocked } = detectLearnerBlock(transcript);
    if (blocked) {
      setAvatarState("thinking");
      try {
        const { data } = await api.get<{ answer: string }>(`/quiz/questions/${question.id}/answer`);
        speakAssistantLine(buildBlockedHelpMessage(data.answer));
        setHelpedQuestionIds((current) =>
          current.includes(question.id) ? current : [...current, question.id],
        );
      } catch {
        setAvatarState("idle");
      }
      return;
    }

    const nextAnswers = { ...answers, [question.id]: transcript };
    setAnswers(nextAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(false);
    setAvatarState("thinking");
    try {
      const response = await api.post<QuizAttemptResult>("/quiz/attempts", {
        moduleId: Number(moduleId),
        answers: nextAnswers,
        helpedQuestionIds,
      });
      setResult(response.data);
    } catch {
      // Network/API failure: without this, `submitting` stayed true forever
      // and the mic (disabled while submitting) never came back - the quiz
      // was permanently stuck on its last question.
      setSubmitError(true);
      setAvatarState("idle");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  // Covers both an outright fetch failure and a technically-successful but
  // empty response (e.g. a module with no questions configured) - either
  // way, `questions[currentIndex]` below would otherwise be undefined and
  // crash on `.questionText`.
  if (loadError || questions.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <ErrorBanner
          message="Impossible de charger les questions de ce module."
          onRetry={() => setRetryCount((count) => count + 1)}
        />
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
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
            <Button to="/quiz">Retour aux modules</Button>
            <Button to="/dashboard" variant="secondary">Dashboard</Button>
          </div>
        </Card>
      </main>
    );
  }

  const question = questions[currentIndex];

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <Card className="w-full max-w-md flex flex-col gap-4">
        {/* relative wrapper, not AvatarScene's own root div - see the
            comment in SessionPage.tsx for why. */}
        <div className="relative">
          <AvatarScene
            state={avatarState}
            avatarType={user?.avatarType ?? "male"}
            speechText={speechText}
            charIndexRef={charIndexRef}
            onReady={handleAvatarReady}
          />
          <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
        </div>

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
        <VoiceInput onResult={handleVoiceAnswer} disabled={submitting || avatarState === "speaking" || avatarState === "thinking"} />

        {submitting && <p className="text-slate-400 text-sm text-center">Envoi...</p>}
        {submitError && <ErrorBanner message="Échec de l'envoi. Réponds à nouveau pour réessayer." />}
      </Card>
    </main>
  );
}
