import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
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
import { normalizeApiError, type ApiError } from "../lib/apiError";
import { detectLearnerBlock } from "../lib/detectLearnerBlock";
import { buildBlockedHelpMessage, buildHelpAvailableMessage, isQuizHiddenForLevel } from "../lib/quizSpeech";
import { useAuthStore } from "../stores/authStore";
import type { QuizAttemptResult, QuizQuestion } from "../types";

export function QuizModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const user = useAuthStore((state) => state.user);
  const quizHidden = isQuizHiddenForLevel(user?.level.code);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Question IDs where the correct answer was revealed after a detected
  // "I don't know" - repeating it back still ends the question, but must
  // not score the same as answering unaided (see QuizService::submitAttempt).
  const [helpedQuestionIds, setHelpedQuestionIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  // The exact answers behind the current submitError, so "Réessayer" can
  // resend the same final attempt without the learner re-answering every
  // question (V1.1 §4.3).
  const [lastSubmitAnswers, setLastSubmitAnswers] = useState<Record<number, string> | null>(null);
  const [helpError, setHelpError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [showQuestionText, setShowQuestionText] = useState(false);
  // Per-question: B1/B2 (helpVisibleByDefault === false) must not reveal the
  // answer on the very first "I don't know" - it only unlocks a reveal
  // button, reset on every new question. A0-A2 keep today's instant reveal
  // (see CecrlProfileService::PROFILES.helpVisibleByDefault).
  const [helpUnlocked, setHelpUnlocked] = useState(false);
  const helpVisibleByDefault = user?.cecrlProfile.helpVisibleByDefault ?? true;
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
    if (quizHidden) {
      setLoading(false);
      return;
    }
    setLoadError(null);

    api
      .get<QuizQuestion[]>(`/quiz/modules/${moduleId}/questions`)
      .then((response) => {
        if (!ignore) setQuestions(response.data);
      })
      .catch((error) => {
        if (!ignore) setLoadError(normalizeApiError(error));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [moduleId, retryCount, quizHidden]);

  useEffect(() => {
    if (questions.length > 0) {
      // The quiz question is an all-English clue (QuizFixtures, e.g. "What
      // color is blood?") worded so the answer is never spoken by the clue
      // itself - spoken aloud as-is, same as the on-screen text revealed on
      // request below.
      speakAssistantLine(questions[currentIndex].questionText);
      setShowQuestionText(false);
      setHelpUnlocked(false);
      setHelpError(null);
    }
    // speakAssistantLine comes from useConversationSession() and must not
    // retrigger this effect on its own.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questions]);

  async function revealAnswer(question: QuizQuestion) {
    setAvatarState("thinking");
    setHelpError(null);
    try {
      const { data } = await api.get<{ answer: string }>(`/quiz/questions/${question.id}/answer`);
      speakAssistantLine(buildBlockedHelpMessage(data.answer));
      setHelpedQuestionIds((current) =>
        current.includes(question.id) ? current : [...current, question.id],
      );
    } catch (error) {
      setAvatarState("idle");
      setHelpError(normalizeApiError(error));
    }
  }

  // Split out so a failed submit can be retried with the exact same answers
  // (from the ErrorBanner's "Réessayer") without the learner re-answering
  // every question.
  async function submitAttempt(finalAnswers: Record<number, string>) {
    setSubmitting(true);
    setSubmitError(null);
    setAvatarState("thinking");
    try {
      // helpedQuestionIds is no longer sent - the backend now tracks which
      // questions were revealed itself (QuizController::answer() records it
      // server-side, see QuizService::recordAnswerRevealed), so a client
      // can no longer omit an id here to score an unearned point.
      const response = await api.post<QuizAttemptResult>("/quiz/attempts", {
        moduleId: Number(moduleId),
        answers: finalAnswers,
      });
      setResult(response.data);
      setLastSubmitAnswers(null);
    } catch (error) {
      // Network/API failure: without this, `submitting` stayed true forever
      // and the mic (disabled while submitting) never came back - the quiz
      // was permanently stuck on its last question.
      setSubmitError(normalizeApiError(error));
      setLastSubmitAnswers(finalAnswers);
      setAvatarState("idle");
    } finally {
      setSubmitting(false);
    }
  }

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
      if (helpVisibleByDefault || helpUnlocked) {
        await revealAnswer(question);
      } else {
        // First block at B1/B2: unlock the reveal button instead of
        // showing the answer straight away (helpVisibleByDefault === false).
        setHelpUnlocked(true);
        speakAssistantLine(buildHelpAvailableMessage());
      }
      return;
    }

    const nextAnswers = { ...answers, [question.id]: transcript };
    setAnswers(nextAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    return submitAttempt(nextAnswers);
  }

  // A2/B1/B2 learners have no legitimate way to reach this route (the
  // module list and nav link are both hidden for them), but a direct URL
  // visit must not be able to bypass that - see isQuizHiddenForLevel.
  if (quizHidden) {
    return <Navigate to="/dashboard" replace />;
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
          message={loadError?.message ?? "Unable to load this module's questions."}
          onRetry={!loadError || loadError.retryable ? () => setRetryCount((count) => count + 1) : undefined}
        />
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
          <RewardBanner badges={result.newBadges} trophies={result.newTrophies} levelUp={result.levelUp} />
          <h1 className="text-3xl font-bold mb-2">
            {result.passed ? "Module passed ✅" : "Module not passed"}
          </h1>
          <p className="text-slate-300 mb-4">
            Score: {result.score}/{questions.length}
          </p>
          <p className="text-slate-300 mb-6">+{result.xpEarned} XP</p>
          <div className="flex gap-4 justify-center">
            <Button to="/quiz">Back to modules</Button>
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
          <p className="text-slate-500 text-sm text-center py-4">🔊 Audio mode — listen to the question</p>
        )}

        <button
          type="button"
          onClick={() => setShowQuestionText((current) => !current)}
          className="self-center text-xs text-slate-400 underline hover:text-slate-300"
        >
          {showQuestionText ? "Hide text" : "Didn't catch that? Show text"}
        </button>

        {helpUnlocked && !helpVisibleByDefault && !helpedQuestionIds.includes(question.id) && (
          <Button onClick={() => revealAnswer(question)} variant="secondary" size="sm">
            💡 Show the answer
          </Button>
        )}
        {helpError && (
          <ErrorBanner
            message={helpError.message}
            onRetry={helpError.retryable ? () => revealAnswer(question) : undefined}
          />
        )}

        {/* The mic must stay off while the AI is talking, otherwise it can
            pick its own voice back up through the speakers and "answer its
            own question". */}
        <VoiceInput onResult={handleVoiceAnswer} disabled={submitting || avatarState === "speaking" || avatarState === "thinking"} />

        {submitting && <p className="text-slate-400 text-sm text-center">Sending...</p>}
        {submitError && (
          <ErrorBanner
            message={submitError.message}
            onRetry={
              submitError.retryable && lastSubmitAnswers ? () => submitAttempt(lastSubmitAnswers) : undefined
            }
          />
        )}
      </Card>
    </main>
  );
}
