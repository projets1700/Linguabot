import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "../components/AvatarScene";
import { speakText } from "../lib/speech";

/**
 * The avatar-speech pipeline shared by every page where the avatar talks to
 * the learner (Session, Daily Challenge, Placement test, Quiz A0): avatar
 * idle/thinking/speaking state, speechText for AvatarSpeechBubble, and the
 * avatar-ready gate. Extracted because these pages used to each carry this
 * near-verbatim, which meant any fix (e.g. the avatar-ready race) had to be
 * applied separately in every one of them. This is the one place that
 * decides text -> speechText -> avatarState=speaking -> speechSynthesis ->
 * (bubble/lip-sync react to speechText+avatarState themselves) ->
 * avatarState=idle - callers never manage those steps individually.
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

  // Defaults to English (every existing caller's assistant lines are
  // English) - callers speaking French (e.g. the Dashboard's intro
  // greeting) pass lang="fr-FR", same as the A0 quiz's forced-French
  // prompts already do directly through speakText.
  function speakAssistantLine(text: string, lang: string = "en-US") {
    charIndexRef.current = null;
    setSpeechText(text);
    // Set eagerly, not just in onStart below: onStart only fires once the
    // browser's TTS engine actually begins (after waitForVoicesReady()),
    // which lags behind this call by one or more ticks. Without this, a
    // page gating the mic on `avatarState === "speaking"` has a real
    // window where the mic is still open right as the avatar starts talking.
    setAvatarState("speaking");
    const speak = () =>
      speakText(text, {
        lang,
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

  // If the learner navigates away while the avatar is still mid-sentence,
  // nothing before this stopped it: speechSynthesis is a page-global browser
  // API, unaware that the React tree that requested it is gone, so it would
  // otherwise keep talking out loud over whatever page comes next.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleAvatarReady() {
    avatarReadyRef.current = true;
    const pending = pendingSpeechRef.current;
    if (pending) {
      pendingSpeechRef.current = null;
      pending();
    }
  }

  // Interrupts whatever the avatar is (or is about to be) saying and
  // silences the bubble immediately - for a caller that lets the learner
  // skip past a line entirely (e.g. the Dashboard intro's "Continuer sans
  // parler"), rather than letting a stale utterance keep talking/showing
  // over whatever comes next.
  function stopSpeaking() {
    pendingSpeechRef.current = null;
    charIndexRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setAvatarState("idle");
    setSpeechText(null);
  }

  return {
    avatarState,
    setAvatarState,
    speechText,
    charIndexRef,
    speakAssistantLine,
    handleAvatarReady,
    stopSpeaking,
  };
}
