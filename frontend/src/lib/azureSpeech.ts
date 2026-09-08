import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import type { MutableRefObject } from "react";
import { api } from "../api/client";
import { ALL_VISEME_MORPH_TARGETS, type VisemeMorphTarget } from "./lipsync/visemeTypes";
import type { AvatarType } from "../types";

// One real audio frame (60 FPS, per Azure's own FacialExpression viseme
// docs) worth of ARKit blend shape weights, already narrowed down to just
// the mouth/jaw targets this app's models actually have (see
// BLEND_SHAPE_ORDER below) - AvatarScene applies these through the exact
// same smoothing loop it already uses for the heuristic viseme system.
export type AzureVisemeFrame = {
  timeMs: number;
  weights: Partial<Record<VisemeMorphTarget, number>>;
};

const VOICE_NAME_BY_AVATAR: Record<AvatarType, string> = {
  male: "en-US-GuyNeural",
  female: "en-US-JennyNeural",
};

// Exact order Azure documents for the 55-value BlendShapes array (see
// "Get facial position with viseme" in the Speech Services docs) - index i
// here is the ARKit name carried at BlendShapes[frame][i]. Most of these
// (eyes, brows, cheeks, tongue, head roll) aren't in VisemeMorphTarget and
// are simply never looked up: this app drives blinking with its own
// independent system (see AvatarScene's blink code), not Azure's.
const BLEND_SHAPE_ORDER = [
  "eyeBlinkLeft", "eyeLookDownLeft", "eyeLookInLeft", "eyeLookOutLeft", "eyeLookUpLeft", "eyeSquintLeft", "eyeWideLeft",
  "eyeBlinkRight", "eyeLookDownRight", "eyeLookInRight", "eyeLookOutRight", "eyeLookUpRight", "eyeSquintRight", "eyeWideRight",
  "jawForward", "jawLeft", "jawRight", "jawOpen",
  "mouthClose", "mouthFunnel", "mouthPucker", "mouthLeft", "mouthRight",
  "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight",
  "mouthDimpleLeft", "mouthDimpleRight", "mouthStretchLeft", "mouthStretchRight",
  "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
  "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
  "noseSneerLeft", "noseSneerRight",
  "tongueOut", "headRoll", "leftEyeRoll", "rightEyeRoll",
] as const;

const BLEND_SHAPE_INDEX_BY_MORPH_TARGET = new Map<VisemeMorphTarget, number>(
  ALL_VISEME_MORPH_TARGETS.map((name) => [name, BLEND_SHAPE_ORDER.indexOf(name as (typeof BLEND_SHAPE_ORDER)[number])]),
);

const FRAME_DURATION_MS = 1000 / 60;

/**
 * Walks `frames` (sorted ascending by timeMs) forward to the last frame
 * whose timeMs has already passed, starting the search from `fromIndex`
 * instead of 0 - called every animation frame with the previous result as
 * `fromIndex`, so the whole utterance is a single forward walk, never
 * re-scanned from the start. Returns `fromIndex` unchanged when frames is
 * empty (nothing to walk to yet).
 */
export function findVisemeFrameIndex(frames: AzureVisemeFrame[], elapsedMs: number, fromIndex: number): number {
  if (frames.length === 0) return fromIndex;

  let index = Math.min(fromIndex, frames.length - 1);
  while (index < frames.length - 1 && frames[index + 1].timeMs <= elapsedMs) {
    index++;
  }
  return index;
}

function extractVisemeWeights(blendShapeRow: number[]): Partial<Record<VisemeMorphTarget, number>> {
  const weights: Partial<Record<VisemeMorphTarget, number>> = {};
  for (const [name, index] of BLEND_SHAPE_INDEX_BY_MORPH_TARGET) {
    if (index !== -1 && blendShapeRow[index] != null) weights[name] = blendShapeRow[index];
  }
  return weights;
}

function escapeSsmlText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchAzureCredentials(): Promise<{ token: string; region: string } | null> {
  try {
    const response = await api.get("/speech/token");
    if (response.status !== 200) return null;

    const { token, region } = response.data ?? {};
    if (typeof token !== "string" || !token || typeof region !== "string" || !region) return null;

    return { token, region };
  } catch {
    return null;
  }
}

type SpeakWithVisemesOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  // Mutated in place as viseme events arrive (not replaced), and read live
  // by AvatarScene's frame loop - same "page owns a ref, AvatarScene polls
  // it every frame" pattern as speech.ts's onBoundary/charIndexRef.
  framesRef: MutableRefObject<AzureVisemeFrame[]>;
  // Set to performance.now() right as playback begins, so AvatarScene can
  // compute how far into the timeline the audio actually is.
  startTimeRef: MutableRefObject<number | null>;
};

/**
 * Real audio + natively-synchronized visemes for English speech, via Azure
 * Speech. Returns false (no side effects yet - safe for the caller to fall
 * back to speech.ts's speakText) when no key is configured or the token
 * request itself fails. Once synthesis actually starts (onStart fired,
 * startTimeRef set), any later failure still resolves true - the caller is
 * already committed for this utterance and must not also speak it via the
 * fallback path, which would read the line twice.
 */
export async function speakEnglishWithAzureVisemes(text: string, avatarType: AvatarType, options: SpeakWithVisemesOptions): Promise<boolean> {
  const credentials = await fetchAzureCredentials();
  if (!credentials) return false;

  let synthesizer: SpeechSDK.SpeechSynthesizer;
  try {
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(credentials.token, credentials.region);
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
  } catch {
    return false;
  }

  options.framesRef.current = [];
  synthesizer.visemeReceived = (_sender, event) => {
    if (!event.animation) return;

    let parsed: { FrameIndex: number; BlendShapes: number[][] };
    try {
      parsed = JSON.parse(event.animation);
    } catch {
      return;
    }

    parsed.BlendShapes.forEach((row, i) => {
      options.framesRef.current.push({
        timeMs: (parsed.FrameIndex + i) * FRAME_DURATION_MS,
        weights: extractVisemeWeights(row),
      });
    });
  };

  const voiceName = VOICE_NAME_BY_AVATAR[avatarType];
  const ssml =
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">' +
    `<voice name="${voiceName}"><mstts:viseme type="FacialExpression"/>${escapeSsmlText(text)}</voice></speak>`;

  // Once this fires, playback via the default speaker output has begun (the
  // JS SDK streams PCM chunks to the Web Audio API as they arrive rather
  // than waiting for the whole utterance) - close enough to "audio started"
  // for lip-sync purposes, same order of approximation as speech.ts's own
  // utterance.onstart.
  options.onStart?.();
  options.startTimeRef.current = performance.now();

  try {
    const result = await new Promise<SpeechSDK.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (r) => resolve(r),
        (error) => reject(new Error(error)),
      );
    });

    if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      console.warn("Azure Speech: synthesis did not complete successfully", result.reason);
    }
  } catch (error) {
    console.warn("Azure Speech: synthesis failed mid-utterance", error);
  } finally {
    synthesizer.close();
    options.startTimeRef.current = null;
    options.onEnd?.();
  }

  return true;
}
