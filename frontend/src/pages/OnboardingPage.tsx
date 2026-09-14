import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AvatarScene } from "../components/AvatarScene";
import { AvatarSpeechBubble } from "../components/AvatarSpeechBubble";
import { VoiceInput } from "../components/VoiceInput";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useConversationSession } from "../hooks/useConversationSession";
import { normalizeApiError, type ApiError } from "../lib/apiError";
import { classifyOnboardingReadiness, isRecognizableNameReply } from "../lib/onboardingIntro";
import { useAuthStore } from "../stores/authStore";

// Audit A1/P0-01: the oral name/readiness exchange (English, deterministic
// 3-way intent recognition) used to be folded into DashboardPage's own
// first-visit intro, which ran AFTER the mandatory placement test - a
// learner met "the teacher" only once already graded. RequireAuth now
// gates on !onboardingCompleted before the placement-test gate, so this is
// its own standalone route, run first.
const ONBOARDING_GREETING = "Hello! I'm LinguaBot, your English teacher. What's your name?";
const ONBOARDING_READY_QUESTION = "Are you ready to start?";
const ONBOARDING_REFORMULATED_READY_QUESTION =
  "I didn't quite catch that. You can say: yes, I'm ready — or no, not yet.";
const ONBOARDING_DECLINED_MESSAGE = "No problem. Come back when you're ready!";

export function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const [stage, setStage] = useState<"name" | "ready">("name");
  const [completing, setCompleting] = useState(false);
  // Audit P0-03: a failed /onboarding/complete (or the fetchMe() right after
  // it) used to be silently swallowed (`catch {}`), so the UI moved on as if
  // onboarding had finished while the backend still had it as incomplete -
  // a learner who later returned would be sent right back here, confused.
  // Never swallowed now: stays on this screen with a visible retry instead.
  const [completeError, setCompleteError] = useState<ApiError | null>(null);
  const greetingSpokenRef = useRef(false);
  const { avatarState, speechText, charIndexRef, speakAssistantLine, handleAvatarReady } = useConversationSession();

  useEffect(() => {
    if (greetingSpokenRef.current) return;
    greetingSpokenRef.current = true;
    speakAssistantLine(ONBOARDING_GREETING, "en-US");
    // speakAssistantLine is a fresh function reference every render (from
    // useConversationSession) and must not retrigger this - it only ever
    // needs to run once, guarded by greetingSpokenRef above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNameReply(transcript: string) {
    if (isRecognizableNameReply(transcript)) {
      setStage("ready");
      // The real account first name, never the raw transcript - matches
      // what the rest of the app already calls the learner (prenom from
      // registration), not whatever the mic happened to pick up.
      speakAssistantLine(`Nice to meet you, ${user?.prenom || "there"}! ${ONBOARDING_READY_QUESTION}`, "en-US");
    } else {
      speakAssistantLine(ONBOARDING_GREETING, "en-US");
    }
  }

  async function completeOnboarding() {
    setCompleting(true);
    setCompleteError(null);
    try {
      await api.post("/onboarding/complete");
      await fetchMe();
      navigate("/placement-test");
    } catch (error) {
      setCompleteError(normalizeApiError(error));
    } finally {
      setCompleting(false);
    }
  }

  function handleReadyReply(transcript: string) {
    const intent = classifyOnboardingReadiness(transcript);

    if (intent === "affirmative") {
      void completeOnboarding();
      return;
    }

    if (intent === "negative") {
      speakAssistantLine(ONBOARDING_DECLINED_MESSAGE, "en-US");
      return;
    }

    speakAssistantLine(ONBOARDING_REFORMULATED_READY_QUESTION, "en-US");
  }

  function handleVoiceResult(transcript: string) {
    if (stage === "name") {
      handleNameReply(transcript);
    } else {
      handleReadyReply(transcript);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8">
      {/* relative wrapper, not AvatarScene's own root div - same reasoning
          as SessionPage: AvatarScene's canvas box uses overflow-hidden,
          which would clip a wider bubble. */}
      <div className="relative mb-6 w-full max-w-md">
        <AvatarScene
          state={avatarState}
          avatarType={user?.avatarType ?? "male"}
          speechText={speechText}
          charIndexRef={charIndexRef}
          onReady={handleAvatarReady}
        />
        <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
      </div>

      <VoiceInput onResult={handleVoiceResult} disabled={avatarState === "speaking" || completing} />

      {completing && <p className="text-slate-400 text-sm mt-4">Un instant...</p>}
      {completeError && (
        <div className="mt-4 w-full max-w-md">
          <ErrorBanner
            message={completeError.message}
            onRetry={completeError.retryable ? () => void completeOnboarding() : undefined}
          />
        </div>
      )}
    </main>
  );
}
