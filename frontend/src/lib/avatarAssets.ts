import { useFBX, useGLTF } from "@react-three/drei";
import type { AvatarType } from "../types";

export const MODEL_PATHS: Record<AvatarType, string> = {
  male: "/avatar/Male/model-male.glb",
  female: "/avatar/Female/model-female.glb",
};

// Stock Mixamo "Idle" animation, retargeted in AvatarScene onto the GLB
// skeleton.
export const IDLE_ANIMATION_PATHS: Record<AvatarType, string> = {
  male: "/avatar/Male/Animation/Idle.fbx",
  female: "/avatar/Female/Animation/Idle.fbx",
};

export const SITTING_IDLE_ANIMATION_PATHS: Record<AvatarType, string> = {
  male: "/avatar/Male/Animation/Sitting Idle.fbx",
  female: "/avatar/Female/Animation/Sitting Idle.fbx",
};

/**
 * Warms three.js's loader cache for one avatar's GLB + FBX (~30MB combined)
 * ahead of time, so that by the time a page actually mounts AvatarScene,
 * useGLTF/useFBX resolve instantly instead of leaving the avatar blank
 * under Suspense for a couple of seconds while speech - an entirely
 * separate pipeline with no awareness of the avatar's loading state -
 * has already started talking. Called as soon as the learner's avatarType
 * is known (see authStore.fetchMe), well before they reach any page that
 * actually renders the avatar.
 */
export function preloadAvatarAssets(avatarType: AvatarType): void {
  useGLTF.preload(MODEL_PATHS[avatarType]);
  useFBX.preload(IDLE_ANIMATION_PATHS[avatarType]);
}
