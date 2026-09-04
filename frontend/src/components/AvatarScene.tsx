import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";

export type AvatarState = "idle" | "thinking" | "speaking";

const STATE_COLOR: Record<AvatarState, string> = {
  idle: "#2E5FAB",
  thinking: "#F39C12",
  speaking: "#27AE60",
};

function AvatarMesh({ state }: { state: AvatarState }) {
  const meshRef = useRef<Mesh>(null);
  const t = useRef(0);

  useFrame((_frameState, delta) => {
    t.current += delta;
    const mesh = meshRef.current;
    if (!mesh) return;

    // Idle: gentle bob + slow rotation. Thinking: faster rotation (pondering).
    // Speaking: pulsing scale to mimic a talking mouth/energy without real lip-sync.
    mesh.rotation.y = t.current * (state === "thinking" ? 0.8 : 0.3);
    mesh.position.y = Math.sin(t.current * 1.5) * 0.08;

    const pulse = state === "speaking" ? 1 + Math.sin(t.current * 12) * 0.06 : 1;
    mesh.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={STATE_COLOR[state]} />
    </mesh>
  );
}

export function AvatarScene({ state }: { state: AvatarState }) {
  return (
    <div className="w-full h-[280px] bg-slate-900 rounded-xl overflow-hidden relative">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 2, 2]} />
        <AvatarMesh state={state} />
        <OrbitControls enableZoom={false} />
      </Canvas>
      <span className="absolute bottom-2 left-2 text-xs text-slate-400 uppercase">
        {state === "idle" && "En attente"}
        {state === "thinking" && "Réflexion..."}
        {state === "speaking" && "Parle"}
      </span>
    </div>
  );
}
