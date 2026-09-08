import { useRef, useState } from "react";
import type { AvatarState } from "../components/AvatarScene";
import { speakText } from "../lib/speech";

/**
 * The avatar-speech pipeline shared by every AI conversation page (Session,
 * Daily Challenge): avatar idle/thinking/speaking state and the avatar-ready
 * gate. Extracted because SessionPage.tsx and DailyChallengePage.tsx used to
 * carry this near-verbatim, which meant any fix (e.g. the avatar-ready race)
 * had to be applied twice.
 *
 * PlacementTestPage.tsx intentionally does not use this hook: its scripted,
 * no-CECRL-level-yet flow differs enough that sharing this would force an
 * awkward abstraction rather than remove real duplication.
 */
export function useConversationSession() {
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [speechText, setSpeechText] = useState<string | null>(null);
  const charIndexRef = useRef<number | null>(null);
  // The avatar's ~30MB of GLB/FBX assets take real time to load - without
  // this gate, speech (an entirely separate pipeline, unaware of the
  // avatar's own Suspense loading state) could start talking while the
  // avatar box is still empty. Any speech requested before AvatarScene's
  // onReady fires is held here and replayed exactly once, the moment it does.
  const avatarReadyRef = useRef(false);
  const pendingSpeechRef = useRef<(() => void) | null>(null);

  function speakAssistantLine(text: string) {
    charIndexRef.current = null;
    setSpeechText(text);
    const speak = () =>
      speakText(text, {
        lang: "en-US",
        onStart: () => setAvatarState("speaking"),
        onBoundary: (event) => {
          charIndexRef.current = event.charIndex;
        },
        onEnd: () => {
          setAvatarState("idle");
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

  return {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
  };
}
