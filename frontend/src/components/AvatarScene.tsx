import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useFBX, useGLTF } from "@react-three/drei";
import { AnimationClip, AnimationMixer, Box3, LoopRepeat, type Group, type Mesh, type Object3D } from "three";
import type { AvatarType } from "../types";

export type AvatarState = "idle" | "thinking" | "speaking";

const MODEL_PATHS: Record<AvatarType, string> = {
  male: "/avatar/Male/model-male.glb",
  female: "/avatar/Female/model-female.glb",
};

// Stock Mixamo "Idle" animation, retargeted below onto the GLB skeleton -
// see the retargeting notes on idleClip for why a straight AnimationMixer
// play() doesn't work as-is.
const IDLE_ANIMATION_PATHS: Record<AvatarType, string> = {
  male: "/avatar/Male/Animation/Idle.fbx",
  female: "/avatar/Female/Animation/Idle.fbx",
};

const MIXAMO_BONE_PREFIX = /^mixamorig/;

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "En attente",
  thinking: "Réflexion...",
  speaking: "Parle",
};

// Test rig for facial morph targets ahead of real lip-sync: a plain
// sine-driven mouth open/close while "speaking", nothing phoneme-aware yet.
// Rad/s for the sine phase - fast enough to read as talking, not chattering.
const JAW_OPEN_SPEED = 8;
// jawOpen=1 is a fully gaping mouth; capped well below that for a subtle,
// non-exaggerated movement.
const JAW_OPEN_AMPLITUDE = 0.35;
// How fast jawOpen eases back to 0 once speaking stops (per second).
const JAW_CLOSE_RATE = 8;

type JawOpenTarget = { mesh: Mesh; index: number };

function hasJawOpenMorphTarget(object: Object3D): object is Mesh {
  const mesh = object as Mesh;
  return mesh.isMesh === true && !!mesh.morphTargetDictionary && "jawOpen" in mesh.morphTargetDictionary;
}

function AvatarModel({ avatarType, state }: { avatarType: AvatarType; state: AvatarState }) {
  const { scene } = useGLTF(MODEL_PATHS[avatarType]);
  // Loads the whole FBX (skeleton + Mixamo's own unused "Erika Archer"
  // reference mesh/textures - there's no way to ask FBXLoader for just the
  // animation) purely to read its .animations; the FBX object itself is
  // never added to the scene, so that reference mesh never renders.
  const fbx = useFBX(IDLE_ANIMATION_PATHS[avatarType]);
  const groupRef = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const jawOpenTargetsRef = useRef<JawOpenTarget[]>([]);
  const jawOpenValueRef = useRef(0);
  const speakingTimeRef = useRef(0);

  // Found once per model load, not searched again on every frame: every
  // mesh carrying a "jawOpen" ARKit blendshape (AvatarHead, AvatarTeethLower
  // per the GLB audit - never assume there's exactly one).
  useEffect(() => {
    const targets: JawOpenTarget[] = [];
    scene.traverse((object) => {
      if (hasJawOpenMorphTarget(object)) {
        targets.push({ mesh: object, index: object.morphTargetDictionary!.jawOpen });
      }
    });
    jawOpenTargetsRef.current = targets;

    if (targets.length === 0) {
      console.warn(
        `AvatarScene: no "jawOpen" morph target found on the "${avatarType}" model - mouth movement disabled.`,
      );
    }
  }, [scene, avatarType]);

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

    const jawOpenTargets = jawOpenTargetsRef.current;
    if (jawOpenTargets.length === 0) return;

    let jawOpenValue: number;
    if (state === "speaking") {
      speakingTimeRef.current += delta;
      jawOpenValue = ((Math.sin(speakingTimeRef.current * JAW_OPEN_SPEED) + 1) / 2) * JAW_OPEN_AMPLITUDE;
    } else {
      speakingTimeRef.current = 0;
      jawOpenValue = jawOpenValueRef.current * Math.max(0, 1 - delta * JAW_CLOSE_RATE);
    }
    jawOpenValueRef.current = jawOpenValue;

    for (const { mesh, index } of jawOpenTargets) {
      // Standard R3F/three.js pattern: mutate the imperative scene graph
      // directly inside useFrame, same as mixer.update() above. Not React
      // state, so the react-compiler-style "immutability" lint doesn't
      // apply here - this is the actual intended way to drive it.
      // oxlint-disable-next-line react/immutability
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = jawOpenValue;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

export function AvatarScene({ state, avatarType }: { state: AvatarState; avatarType: AvatarType }) {
  return (
    <div className="w-full h-[280px] bg-slate-900 rounded-xl overflow-hidden relative">
      <Canvas camera={{ position: [0, 0, 1.5], fov: 32 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 2, 2]} />
        <Suspense fallback={null}>
          <AvatarModel key={avatarType} avatarType={avatarType} state={state} />
        </Suspense>
        <OrbitControls enableZoom={false} />
      </Canvas>
      <span className="absolute bottom-2 left-2 text-xs text-slate-400 uppercase">
        {STATE_LABEL[state]}
      </span>
    </div>
  );
}
