import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useFBX, useGLTF } from "@react-three/drei";
import { AnimationClip, AnimationMixer, Box3, LoopRepeat, type Group, type Mesh, type Object3D } from "three";
import { LipsyncController } from "../lib/lipsync/lipsyncController";
import { ALL_VISEME_MORPH_TARGETS, VISEME_WEIGHTS, type VisemeMorphTarget } from "../lib/lipsync/visemeTypes";
import { findVisemeFrameIndex, type AzureVisemeFrame } from "../lib/azureSpeech";
import { IDLE_ANIMATION_PATHS, MODEL_PATHS } from "../lib/avatarAssets";
import type { AvatarType } from "../types";

export type AvatarState = "idle" | "thinking" | "speaking";

const MIXAMO_BONE_PREFIX = /^mixamorig/;

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "En attente",
  thinking: "Réflexion...",
  speaking: "Parle",
};

// Exponential-decay rate for easing each morph target toward its viseme's
// target weight every frame - frame-rate independent (unlike a plain
// `* delta`, which can overshoot at low FPS), and slow enough that viseme
// changes read as smooth mouth movement rather than a snapping face.
const LIPSYNC_SMOOTH_RATE = 15;

type MorphTarget = { mesh: Mesh; index: number };

function collectMorphTargets<T extends string>(root: Object3D, names: readonly T[]): Map<T, MorphTarget[]> {
  const found = new Map<T, MorphTarget[]>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary) return;

    for (const name of names) {
      if (name in mesh.morphTargetDictionary) {
        const list = found.get(name) ?? [];
        list.push({ mesh, index: mesh.morphTargetDictionary[name] });
        found.set(name, list);
      }
    }
  });
  return found;
}

// Automatic blinking, entirely independent of lip-sync: it only ever
// writes eyeBlinkLeft/eyeBlinkRight, lip-sync only ever writes its own
// mouth/jaw targets (see ALL_VISEME_MORPH_TARGETS above) - no overlap, so
// both can run in the same frame loop without stepping on each other.
type BlinkMorphTarget = "eyeBlinkLeft" | "eyeBlinkRight";
const BLINK_MORPH_TARGETS: readonly BlinkMorphTarget[] = ["eyeBlinkLeft", "eyeBlinkRight"];

const BLINK_MIN_INTERVAL_MS = 3000;
const BLINK_MAX_INTERVAL_MS = 6000;
// Closing is quicker than opening - a real blink snaps shut and eases open.
const BLINK_CLOSE_MS = 70;
const BLINK_OPEN_MS = 110;
// Occasionally chain a quick second blink after the first, like a real
// person - never on the follow-up blink itself, so it's at most a pair.
const DOUBLE_BLINK_PROBABILITY = 0.15;
const DOUBLE_BLINK_MIN_GAP_MS = 100;
const DOUBLE_BLINK_MAX_GAP_MS = 250;

type BlinkState = {
  phase: "waiting" | "closing" | "opening";
  phaseElapsedMs: number;
  waitMs: number;
  value: number;
  isFollowUpBlink: boolean;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomBlinkInterval(): number {
  return randomBetween(BLINK_MIN_INTERVAL_MS, BLINK_MAX_INTERVAL_MS);
}

function createBlinkState(): BlinkState {
  return { phase: "waiting", phaseElapsedMs: 0, waitMs: randomBlinkInterval(), value: 0, isFollowUpBlink: false };
}

// Smoothstep instead of a linear ramp - avoids the eyelid snapping open
// instantly at the end of each phase, still cheap (no trig).
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Advances one blink cycle by `deltaMs` and returns the eyelid closure for this frame (0 = open, 1 = closed). */
function updateBlink(deltaMs: number, blink: BlinkState): number {
  if (blink.phase === "waiting") {
    blink.waitMs -= deltaMs;
    if (blink.waitMs <= 0) {
      blink.phase = "closing";
      blink.phaseElapsedMs = 0;
    }
    return blink.value;
  }

  blink.phaseElapsedMs += deltaMs;

  if (blink.phase === "closing") {
    const t = Math.min(blink.phaseElapsedMs / BLINK_CLOSE_MS, 1);
    blink.value = smoothstep(t);
    if (t >= 1) {
      blink.phase = "opening";
      blink.phaseElapsedMs = 0;
    }
    return blink.value;
  }

  // opening
  const t = Math.min(blink.phaseElapsedMs / BLINK_OPEN_MS, 1);
  blink.value = 1 - smoothstep(t);
  if (t >= 1) {
    blink.value = 0;
    blink.phase = "waiting";
    if (blink.isFollowUpBlink) {
      blink.isFollowUpBlink = false;
      blink.waitMs = randomBlinkInterval();
    } else if (Math.random() < DOUBLE_BLINK_PROBABILITY) {
      blink.isFollowUpBlink = true;
      blink.waitMs = randomBetween(DOUBLE_BLINK_MIN_GAP_MS, DOUBLE_BLINK_MAX_GAP_MS);
    } else {
      blink.waitMs = randomBlinkInterval();
    }
  }
  return blink.value;
}

function AvatarModel({
  avatarType,
  state,
  speechText,
  charIndexRef,
  visemeFramesRef,
  visemeStartTimeRef,
  onReady,
}: {
  avatarType: AvatarType;
  state: AvatarState;
  speechText: string | null;
  charIndexRef: MutableRefObject<number | null> | undefined;
  visemeFramesRef: MutableRefObject<AzureVisemeFrame[]> | undefined;
  visemeStartTimeRef: MutableRefObject<number | null> | undefined;
  onReady: (() => void) | undefined;
}) {
  const { scene } = useGLTF(MODEL_PATHS[avatarType]);
  // Loads the whole FBX (skeleton + Mixamo's own unused "Erika Archer"
  // reference mesh/textures - there's no way to ask FBXLoader for just the
  // animation) purely to read its .animations; the FBX object itself is
  // never added to the scene, so that reference mesh never renders.
  const fbx = useFBX(IDLE_ANIMATION_PATHS[avatarType]);
  const groupRef = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const morphTargetsRef = useRef<Map<VisemeMorphTarget, MorphTarget[]>>(new Map());
  const currentWeightsRef = useRef<Partial<Record<VisemeMorphTarget, number>>>({});
  const lipsyncControllerRef = useRef(new LipsyncController());
  const lastSeenCharIndexRef = useRef<number | null>(null);
  const blinkTargetsRef = useRef<Map<BlinkMorphTarget, MorphTarget[]>>(new Map());
  const blinkStateRef = useRef(createBlinkState());
  // Tracks which Azure utterance (identified by its startTime) the cursor
  // below belongs to, so a new utterance restarts the walk from frame 0
  // instead of continuing from wherever the previous one left off.
  const azureUtteranceStartRef = useRef<number | null>(null);
  const azureFrameCursorRef = useRef(0);
  // Kept in sync on every render via this effect (never mutated during
  // render itself) so the model-ready effect below can always call the
  // latest onReady without re-running - and thus without re-firing it - on
  // every parent re-render.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  // Found once per model load, not searched again on every frame: every
  // mesh carrying one of the lip-sync ARKit blendshapes (AvatarHead,
  // AvatarTeethLower for jaw*, sometimes AvatarEyelashes for mouthSmile* -
  // never assume there's exactly one mesh per target, see the facial morph
  // target audit).
  useEffect(() => {
    const targets = collectMorphTargets(scene, ALL_VISEME_MORPH_TARGETS);
    morphTargetsRef.current = targets;
    currentWeightsRef.current = {};

    if (!targets.has("jawOpen")) {
      console.warn(`AvatarScene: no "jawOpen" morph target found on the "${avatarType}" model - lip-sync disabled.`);
    }

    // Same "found once, not every frame" approach as above (AvatarHead and
    // AvatarEyelashes both carry eyeBlinkLeft/Right per the facial morph
    // target audit).
    const blinkTargets = collectMorphTargets(scene, BLINK_MORPH_TARGETS);
    blinkTargetsRef.current = blinkTargets;
    blinkStateRef.current = createBlinkState();

    if (!blinkTargets.has("eyeBlinkLeft") || !blinkTargets.has("eyeBlinkRight")) {
      console.warn(`AvatarScene: eyeBlinkLeft/eyeBlinkRight morph target missing on the "${avatarType}" model - blinking disabled.`);
    }

    // The model is now actually mounted and wired up for lip-sync/blinking -
    // the earliest correct moment for the page to start speech, instead of
    // firing it as soon as its own data arrives regardless of whether the
    // (much heavier, ~30MB) avatar assets have even finished loading yet.
    onReadyRef.current?.();
  }, [scene, avatarType]);

  // Starts/stops the lip-sync sequence whenever the page hands over a new
  // line of dialogue (or clears it once speech ends) - independent of
  // avatarState, which only decides whether the sequence is actually
  // being played back below (see useFrame).
  useEffect(() => {
    lastSeenCharIndexRef.current = null;
    if (speechText) {
      lipsyncControllerRef.current.start(speechText);
    } else {
      lipsyncControllerRef.current.stop();
    }
  }, [speechText]);

  useEffect(() => {
    if (!groupRef.current) return;

    // The model is a ~1.8m humanoid with its feet at y=0. The camera below
    // looks at the world origin, so we shift the whole model down until the
    // jaw/neck area - not the whole body - lands there: a bust/face framing
    // instead of a full-body shot, computed from the model's own bounding
    // box rather than a hardcoded height (male and female differ slightly).
    // Computed once from the bind pose: the idle clip only sways/breathes
    // (no Hips.position track - see below), so this stays valid throughout.
    const box = new Box3().setFromObject(scene);
    const height = box.max.y - box.min.y;
    groupRef.current.position.y = -(box.min.y + height * 0.8);
  }, [scene]);

  // Retarget Mixamo's "Idle" clip onto our GLB skeleton by name only (per
  // the prior audit: same bone names once the "mixamorig" prefix is
  // stripped, and both rigs already share a T-pose rest pose - no need for
  // a full retargetClip solve). Hips.position is dropped entirely: the FBX
  // is authored in centimeters and the GLB in meters, and converting isn't
  // worth it for a track whose whole range is ~0.18cm (imperceptible) -
  // dropping it also keeps the bust-framing offset above undisturbed.
  const idleClip = useMemo(() => {
    const sourceClip = fbx.animations.find((clip) => clip.tracks.length > 0);
    if (!sourceClip) return null;

    const tracks = sourceClip.tracks
      .filter((track) => !track.name.endsWith(".position"))
      .map((track) => {
        const clonedTrack = track.clone();
        clonedTrack.name = clonedTrack.name.replace(MIXAMO_BONE_PREFIX, "");
        return clonedTrack;
      });

    return new AnimationClip("idle", sourceClip.duration, tracks);
  }, [fbx]);

  useEffect(() => {
    if (!idleClip || !groupRef.current) return;

    const mixer = new AnimationMixer(scene);
    const action = mixer.clipAction(idleClip);
    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.play();
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheClip(idleClip);
      mixer.uncacheRoot(scene);
      mixerRef.current = null;
    };
  }, [idleClip, scene]);

  useFrame((_frameState, delta) => {
    mixerRef.current?.update(delta);

    // Runs every frame regardless of avatarState (idle/thinking/speaking
    // all blink) and writes only eyeBlinkLeft/Right, never touched by the
    // lip-sync loop below - the two can't clobber each other.
    const blinkTargets = blinkTargetsRef.current;
    if (blinkTargets.size > 0) {
      const blinkValue = updateBlink(delta * 1000, blinkStateRef.current);
      for (const name of BLINK_MORPH_TARGETS) {
        const targets = blinkTargets.get(name);
        if (!targets) continue;
        for (const { mesh, index } of targets) {
          // oxlint-disable-next-line react/immutability
          if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = blinkValue;
        }
      }
    }

    const morphTargets = morphTargetsRef.current;
    if (morphTargets.size === 0) return;

    const controller = lipsyncControllerRef.current;
    let targetWeights: Partial<Record<VisemeMorphTarget, number>> = VISEME_WEIGHTS.REST;

    const azureStartTime = visemeStartTimeRef?.current;
    if (state === "speaking" && azureStartTime != null) {
      // Real Azure timeline available for this utterance - takes priority
      // over the heuristic controller below, which never even starts.
      if (azureUtteranceStartRef.current !== azureStartTime) {
        azureUtteranceStartRef.current = azureStartTime;
        azureFrameCursorRef.current = 0;
      }
      const frames = visemeFramesRef?.current ?? [];
      const elapsedMs = performance.now() - azureStartTime;
      azureFrameCursorRef.current = findVisemeFrameIndex(frames, elapsedMs, azureFrameCursorRef.current);
      targetWeights = frames[azureFrameCursorRef.current]?.weights ?? VISEME_WEIGHTS.REST;
    } else if (state === "speaking") {
      // A fresh boundary value from the page's onBoundary callback beats
      // the time-based estimate - only report it once per new value (not
      // every frame) so staleness detection inside the controller can
      // actually notice when the browser stops sending them and fall back.
      const liveCharIndex = charIndexRef?.current;
      if (liveCharIndex != null && liveCharIndex !== lastSeenCharIndexRef.current) {
        controller.reportBoundary(liveCharIndex);
        lastSeenCharIndexRef.current = liveCharIndex;
      }
      targetWeights = VISEME_WEIGHTS[controller.update(delta * 1000)];
    }

    const damping = 1 - Math.exp(-delta * LIPSYNC_SMOOTH_RATE);

    for (const name of ALL_VISEME_MORPH_TARGETS) {
      const targets = morphTargets.get(name);
      if (!targets) continue;

      const target = targetWeights[name] ?? 0;
      const current = currentWeightsRef.current[name] ?? 0;
      const next = current + (target - current) * damping;
      currentWeightsRef.current[name] = next;

      for (const { mesh, index } of targets) {
        // Standard R3F/three.js pattern: mutate the imperative scene graph
        // directly inside useFrame, same as mixer.update() above. Not React
        // state, so the react-compiler-style "immutability" lint doesn't
        // apply here - this is the actual intended way to drive it.
        // oxlint-disable-next-line react/immutability
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = next;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

export function AvatarScene({
  state,
  avatarType,
  speechText = null,
  charIndexRef,
  visemeFramesRef,
  visemeStartTimeRef,
  onReady,
}: {
  state: AvatarState;
  avatarType: AvatarType;
  // The line currently being spoken (set when speech starts, cleared to
  // null when it ends) - drives text-based lip-sync. Both optional: pages
  // that don't pass them just get REST/no mouth movement while
  // "speaking", same as before this feature existed for them.
  speechText?: string | null;
  charIndexRef?: MutableRefObject<number | null>;
  // Real Azure-provided viseme timeline (English pages only) - when
  // visemeStartTimeRef.current is set, this takes over from the heuristic
  // speechText/charIndexRef path above for as long as speech continues.
  // Both optional and independent from speechText/charIndexRef: pages that
  // don't pass them behave exactly as before Azure support existed.
  visemeFramesRef?: MutableRefObject<AzureVisemeFrame[]>;
  visemeStartTimeRef?: MutableRefObject<number | null>;
  // Fires once the avatar's GLB/FBX assets (~30MB) have actually finished
  // loading and it's mounted - pages should hold off calling speakText/
  // speakEnglishWithAvatar until this fires, otherwise speech can start
  // while the avatar is still just an empty/loading box. Pass a stable
  // (useCallback or ref-backed) function: a new reference every render
  // does not re-fire it, but a stable one avoids any confusion either way.
  onReady?: () => void;
}) {
  // Tracks which avatarType last reported ready, rather than a plain
  // boolean - so switching avatarType (AvatarModel remounts below,
  // key={avatarType}) falls back to "not ready" for the new one purely by
  // this comparison no longer matching, with no extra effect needed to
  // reset it.
  const [readyForAvatarType, setReadyForAvatarType] = useState<AvatarType | null>(null);
  const modelReady = readyForAvatarType === avatarType;

  function handleReady() {
    setReadyForAvatarType(avatarType);
    onReady?.();
  }

  return (
    <div className="w-full h-[280px] bg-slate-900 rounded-xl overflow-hidden relative">
      <Canvas camera={{ position: [0, 0, 1.5], fov: 32 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 2, 2]} />
        <Suspense fallback={null}>
          <AvatarModel
            key={avatarType}
            avatarType={avatarType}
            state={state}
            speechText={speechText}
            charIndexRef={charIndexRef}
            onReady={handleReady}
            visemeFramesRef={visemeFramesRef}
            visemeStartTimeRef={visemeStartTimeRef}
          />
        </Suspense>
        <OrbitControls enableZoom={false} />
      </Canvas>
      {!modelReady && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 bg-slate-900 pointer-events-none">
          Chargement de l'avatar...
        </div>
      )}
      <span className="absolute bottom-2 left-2 text-xs text-slate-400 uppercase">
        {STATE_LABEL[state]}
      </span>
    </div>
  );
}
