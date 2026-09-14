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
import { IDLE_ANIMATION_PATHS, MODEL_PATHS, SITTING_IDLE_ANIMATION_PATHS } from "../lib/avatarAssets";
import { createBlinkState, updateBlink } from "../lib/avatarBlink";
import {
  DASHBOARD_PORTRAIT_TARGET_Y,
  FRAMING_CAMERA,
  FRAMING_MODEL_OFFSET_RATIO,
  type AvatarFraming,
} from "../lib/avatarFramingConfig";
import type { AvatarType } from "../types";

export type { AvatarFraming } from "../lib/avatarFramingConfig";

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
// The target Y itself (DASHBOARD_PORTRAIT_TARGET_Y, imported above) is a
// fixed, pre-measured per-avatar constant, not computed from a live Box3 -
// see avatarFramingConfig.ts for why.

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
  const fbx = useFBX(
    framing === "placementTestPortrait" ? SITTING_IDLE_ANIMATION_PATHS[avatarType] : IDLE_ANIMATION_PATHS[avatarType],
  );
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
    const offsetRatio = FRAMING_MODEL_OFFSET_RATIO[framing] ?? 0.8;
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

  // Per-framing camera position/fov - see avatarFramingConfig.ts for the
  // values and the pinhole-camera/CameraSync reasoning behind each.
  const cameraProps = FRAMING_CAMERA[framing];

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
        {framing === "placementTestPortrait" ? (
          <>
            <ambientLight intensity={0.5} color="#e4eaf5" />
            <directionalLight position={[-2.4, 1.6, 2.2]} intensity={1.1} color="#ffe6c2" />
            <directionalLight position={[2.2, 1, 1.4]} intensity={0.3} color="#bcd0f0" />
          </>
        ) : (
          <>
            <ambientLight intensity={1} />
            <directionalLight position={[2, 2, 2]} />
          </>
        )}
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
