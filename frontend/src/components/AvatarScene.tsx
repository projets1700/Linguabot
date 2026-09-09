import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useFBX, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  LoopRepeat,
  type Group,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from "three";
import { LipsyncController } from "../lib/lipsync/lipsyncController";
import { ALL_VISEME_MORPH_TARGETS, VISEME_WEIGHTS, type VisemeMorphTarget } from "../lib/lipsync/visemeTypes";
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

// "bust": tight headshot, unchanged default used by every existing caller.
// "portrait": head-to-mid-thigh crop for the Dashboard intro's "professeur
// face à l'élève" composition - deliberately not "full" (feet visible),
// which left a lot of empty space above/below the model in frame.
// "dashboardPortrait": head-to-upper-torso only (no hips/legs at all) for
// the Dashboard's own small square-ish avatar card - "bust" alone left a
// sliver of hip/pants visible at the card's bottom edge, which reads as
// "mostly legs" in a card this short; kept as its own preset rather than
// tightening "bust" itself, since "bust" is shared with Session/Quiz/
// DailyChallenge/Placement and must stay exactly as it is for them.
export type AvatarFraming = "bust" | "portrait" | "dashboardPortrait";

// AvatarScene stays mounted across the Dashboard's intro -> dashboard
// transition (its ~30MB assets must load exactly once), so the SAME
// <Canvas>/default camera/OrbitControls instance persists across a
// `framing` change. R3F's `camera={cameraProps}` prop only sets the
// camera's position on Canvas creation - OrbitControls (mounted once) then
// owns the camera every frame afterwards and keeps re-imposing whatever
// distance/target it captured on ITS OWN mount, silently ignoring later
// prop changes. Confirmed by instrumentation: the live camera.position
// stayed frozen at the intro's [0,0,2.4] even after `framing` switched to
// "dashboardPortrait" (intended [0,0,1.15]) - explaining the "mostly
// legs/feet" Dashboard card despite the model itself repositioning
// correctly. Fix: imperatively re-set the camera AND resync OrbitControls'
// own internal state via `.update()` every time `framing` actually changes.
// dashboardPortrait's target Y, per avatar - measured directly from each
// model's own Box3 on a real, working session (male: box.max.y=1.8249,
// female: box.max.y=1.7557, both box.min.y≈0, target = height×0.885), NOT
// a guess. This used to be recomputed live via Box3().setFromObject() on
// every frame, which turned out to be unreliable: on at least one real
// device, that same computation deterministically returned a ~5× smaller
// height (target≈0.32 instead of ≈1.6) for the identical GLB/code/server,
// stable across a full browser restart AND a fresh private window (so not
// caching, not a loading race - a genuine cross-environment difference in
// how that browser/GPU's Three.js build resolves a SkinnedMesh's bounding
// box). A fixed, pre-measured value per avatar sidesteps that inconsistency
// entirely. "bust"/"portrait" don't use this - they keep their own
// existing, untouched mechanism (see AvatarModel below, which shifts the
// model group so the intended point lands at world Y=0, where those two
// presets' camera/target already sit).
const DASHBOARD_PORTRAIT_TARGET_Y: Record<AvatarType, number> = {
  male: 1.615,
  female: 1.554,
};

function CameraSync({
  framing,
  avatarType,
  distance,
  fov,
  controlsRef,
}: {
  framing: AvatarFraming;
  avatarType: AvatarType;
  distance: number;
  fov: number;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const lastFramingRef = useRef<AvatarFraming | null>(null);

  useEffect(() => {
    if ("fov" in camera) {
      // Standard R3F/three.js pattern: mutate the imperative scene graph
      // directly (same as the morph-target writes below) - not React
      // state, so the react-compiler-style "immutability" lint doesn't
      // apply here.
      // oxlint-disable-next-line react/immutability
      (camera as PerspectiveCamera).fov = fov;
      (camera as PerspectiveCamera).updateProjectionMatrix();
    }
  }, [avatarType, fov, camera]);

  // Re-applied every frame (not just once in an effect) purely to keep
  // OrbitControls resynced - see the "own mount, own state" comment above.
  // The target Y itself is now a fixed per-avatar constant (see
  // DASHBOARD_PORTRAIT_TARGET_Y), not computed from a live Box3.
  useFrame(() => {
    const framingChanged = lastFramingRef.current !== framing;
    lastFramingRef.current = framing;

    if (framing === "dashboardPortrait") {
      const targetY = DASHBOARD_PORTRAIT_TARGET_Y[avatarType];
      camera.position.set(0, targetY, distance);
      camera.lookAt(0, targetY, 0);
      controlsRef.current?.target.set(0, targetY, 0);
    } else if (framingChanged) {
      // "bust"/"portrait": unchanged - camera looks at the world origin,
      // where AvatarModel's own existing effect already shifts the
      // intended body part to land. These two don't need per-frame
      // recomputation - only reapplied when `framing` actually changed.
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.target.set(0, 0, 0);
    } else {
      return;
    }
    // Without this, OrbitControls keeps orbiting around whatever it
    // computed on its own first mount - .update() forces it to re-read the
    // camera's (just-set) position/target into its internal spherical state.
    controlsRef.current?.update();
  });

  return null;
}

function AvatarModel({
  avatarType,
  state,
  speechText,
  charIndexRef,
  onReady,
  framing,
}: {
  avatarType: AvatarType;
  state: AvatarState;
  speechText: string | null;
  charIndexRef: MutableRefObject<number | null> | undefined;
  onReady: (() => void) | undefined;
  framing: AvatarFraming;
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
    // looks at the world origin, so we shift the whole model until the part
    // we want centered lands there, computed from the model's own bounding
    // box rather than a hardcoded height (male and female differ slightly).
    // Computed once from the bind pose: the idle clip only sways/breathes
    // (no Hips.position track - see below), so this stays valid throughout.
    // "bust" centers the jaw/neck (unchanged default, used by every existing
    // caller); "portrait" centers the upper torso/chest instead, paired with
    // a pulled-back camera below - roughly head+shoulders+arms down to
    // mid-thigh ends up in frame, feet excluded on purpose.
    // "dashboardPortrait" deliberately does NOT shift the model at all - it
    // leaves it at its natural bind-pose position and instead moves the
    // CAMERA/target up to the face (see CameraSync), per this preset's own
    // camera-driven framing.
    if (framing === "dashboardPortrait") {
      groupRef.current.position.y = 0;
      return;
    }

    const box = new Box3().setFromObject(scene);
    const height = box.max.y - box.min.y;
    const offsetRatio = framing === "portrait" ? 0.71 : 0.8;
    groupRef.current.position.y = -(box.min.y + height * offsetRatio);
  }, [scene, framing]);

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

    if (state === "speaking") {
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
  onReady,
  heightClassName = "h-[280px]",
  framing = "bust",
  transparentBackground = false,
  showStateLabel = true,
}: {
  state: AvatarState;
  avatarType: AvatarType;
  // The line currently being spoken (set when speech starts, cleared to
  // null when it ends) - drives text-based lip-sync. Both optional: pages
  // that don't pass them just get REST/no mouth movement while "speaking".
  speechText?: string | null;
  charIndexRef?: MutableRefObject<number | null>;
  // Fires once the avatar's GLB/FBX assets (~30MB) have actually finished
  // loading and it's mounted - pages should hold off calling speakText/
  // speakEnglishWithAvatar until this fires, otherwise speech can start
  // while the avatar is still just an empty/loading box. Pass a stable
  // (useCallback or ref-backed) function: a new reference every render
  // does not re-fire it, but a stable one avoids any confusion either way.
  onReady?: () => void;
  // Replaces (not appends to) the container's height utility class - kept
  // as a full class rather than a raw pixel number so callers stay in
  // Tailwind's own scale instead of introducing arbitrary values ad hoc.
  heightClassName?: string;
  // "bust" (default) matches every existing caller exactly. "portrait"
  // pulls the camera back and centers the chest instead of the jaw/neck -
  // for the Dashboard intro's "professeur face à l'élève" framing.
  // "dashboardPortrait" frames head-to-upper-chest only (no hips/legs) for
  // the Dashboard's own small avatar card.
  framing?: AvatarFraming;
  // Drops the box's own opaque bg-slate-900 (and swaps the loading overlay
  // for a translucent one) so a composition placed behind this component -
  // e.g. the Dashboard intro's classroom photo - actually shows through
  // instead of being hidden behind a solid rectangle. False (opaque, exactly
  // current look) for every existing caller.
  transparentBackground?: boolean;
  // Hides the idle/thinking/speaking debug label bottom-left. True (shown,
  // exactly current look) for every existing caller - the Dashboard intro is
  // the one place a raw internal state name reads as a debug leftover.
  showStateLabel?: boolean;
}) {
  // Tracks which avatarType last reported ready, rather than a plain
  // boolean - so switching avatarType (AvatarModel remounts below,
  // key={avatarType}) falls back to "not ready" for the new one purely by
  // this comparison no longer matching, with no extra effect needed to
  // reset it.
  const [readyForAvatarType, setReadyForAvatarType] = useState<AvatarType | null>(null);
  const modelReady = readyForAvatarType === avatarType;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  function handleReady() {
    setReadyForAvatarType(avatarType);
    onReady?.();
  }

  // "portrait": pulled back just enough that the chest-centered window above
  // (height*0.71) - head+shoulders+torso to roughly mid-thigh - fills most
  // of the frame's vertical extent, computed from the pinhole-camera
  // relation distance = halfFrameHeight / tan(fov/2) for a ~1.75m model.
  // Same fov as "bust" on purpose, so only distance/vertical-centering
  // changes between the two presets. z=2.4 (down from an earlier 2.8) is a
  // ~15-17% closer framing per a finishing pass on the Dashboard intro.
  // "dashboardPortrait": pulled in much closer (z=1.15) than "bust" (z=1.5).
  // Its position/lookAt Y are NOT [0,0,z] like the other two - CameraSync
  // below overrides both to the model's own computed face/chest height,
  // since this preset leaves the model itself unshifted (see AvatarModel).
  // Only the distance (z) from this object is actually used for it.
  const cameraProps =
    framing === "portrait"
      ? { position: [0, 0, 2.4] as const, fov: 32 }
      : framing === "dashboardPortrait"
        ? { position: [0, 0, 1.15] as const, fov: 32 }
        : { position: [0, 0, 1.5] as const, fov: 32 };

  return (
    <div
      className={`w-full ${heightClassName} ${transparentBackground ? "" : "bg-slate-900"} rounded-xl overflow-hidden relative`}
    >
      {/* alpha:true - three.js/WebGLRenderer defaults to an OPAQUE (black)
          clear color otherwise, which would paint over whatever sits behind
          this component regardless of the wrapper div's own background -
          the actual reason removing bg-slate-900 above wasn't enough on its
          own for the Dashboard intro's classroom photo to show through.
          Harmless for every other caller: their wrapper div still paints
          bg-slate-900 behind the now-transparent canvas, same look as before. */}
      <Canvas camera={cameraProps} gl={{ alpha: true }}>
        <CameraSync
          framing={framing}
          avatarType={avatarType}
          distance={cameraProps.position[2]}
          fov={cameraProps.fov}
          controlsRef={controlsRef}
        />
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
            framing={framing}
          />
        </Suspense>
        {/* None of these avatar displays are meant to be an interactive 3D
            viewer - only zoom was ever disabled, so a plain mouse drag
            (e.g. brushing past the small Dashboard card while scrolling)
            could orbit the camera to any angle, including straight down at
            the legs/feet - confirmed by reproducing it directly. Disabling
            rotate/pan too removes the only way the camera can end up
            anywhere other than where `CameraSync` puts it. */}
        <OrbitControls ref={controlsRef} enableZoom={false} enableRotate={false} enablePan={false} />
      </Canvas>
      {!modelReady && (
        <div
          className={`absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none ${
            transparentBackground ? "bg-slate-950/30 backdrop-blur-sm" : "bg-slate-900"
          }`}
        >
          Chargement de l'avatar...
        </div>
      )}
      {showStateLabel && (
        <span className="absolute bottom-2 left-2 text-xs text-slate-400 uppercase">{STATE_LABEL[state]}</span>
      )}
    </div>
  );
}
