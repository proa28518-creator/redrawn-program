import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { PostFX, withPost } from "../common/ink";
import type { PostSettings } from "../common/ink";

export const INK_SPIKE_FRAMES = 30;

export interface InkSpikeProps {
  enableInk?: boolean;
}

const SPIKE_POST: PostSettings = withPost({
  outline: {
    enabled: true,
    color: "#1a1424",
    widthPx: 3.6,
    depthThreshold: 0.07,
    normalThreshold: 0.34,
    strength: 0.95,
    fadeNear: 6,
    fadeFar: 20,
    farWidth: 0.6,
    farOpacity: 0.45,
    wobble: 0,
    supersample: 2,
    jumpEdges: 0,
    idEdges: 1,
    minPx: 2.5,
    clothFlat: true,
  },
  dof: {
    enabled: false,
    focusDistance: 8,
    focusRange: 30,
    maxBlurPx: 0,
  },
  bloom: {
    enabled: false,
    threshold: 1.0,
    strength: 0,
    radiusPx: 90,
  },
  grade: {
    exposure: 0.05,
    contrast: 1.15,
    saturation: 1.15,
    lift: "#0d0a12",
    gamma: "#808080",
    gain: "#fffcf6",
    shadowTint: "#4e3a96",
    highlightTint: "#ffdca0",
    splitAmount: 0.08,
    sharpen: 0.22,
  },
  vignette: {
    amount: 0.12,
    softness: 0.8,
    color: "#4a3050",
  },
  grain: 0,
});

const CUSTOM_VERT = /* glsl */ `
varying vec3 vNormalView;
void main() {
  vec3 pos = position;
  pos.y += 0.06 * sin(pos.x * 4.0 + pos.z * 3.0);
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

const CUSTOM_FRAG = /* glsl */ `
uniform vec3 uBaseColor;
varying vec3 vNormalView;
void main() {
  float light = 0.55 + 0.45 * clamp(dot(normalize(vNormalView), normalize(vec3(0.4, 0.8, 0.5))), 0.0, 1.0);
  gl_FragColor = vec4(uBaseColor * light, 1.0);
}`;

const SpikeScene: React.FC<{ enableInk: boolean }> = ({ enableInk }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(0, 2.4, 8.6);
  camera.lookAt(0, 1.1, -0.5);
  camera.fov = 45;
  camera.near = 0.2;
  camera.far = 200;
  camera.updateProjectionMatrix();

  const customMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CUSTOM_VERT,
        fragmentShader: CUSTOM_FRAG,
        uniforms: {
          uBaseColor: { value: new THREE.Color("#6eb0a4") },
        },
      }),
    [],
  );

  useEffect(() => () => customMat.dispose(), [customMat]);

  return (
    <>
      <color attach="background" args={["#cbe4f9"]} />
      <hemisphereLight args={["#e6f2ff", "#b89f7d", 1.0]} />
      <ambientLight color="#fffaf0" intensity={0.4} />
      <directionalLight
        color="#fff6e5"
        intensity={2.4}
        position={[6, 10, 7]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#d4c4aa" roughness={0.95} />
      </mesh>

      {/* Varied-depth primitives */}
      <mesh position={[-1.35, 0.65, 2.2]} rotation={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
        <meshStandardMaterial color="#d98a5f" roughness={0.85} />
      </mesh>

      <mesh position={[1.25, 0.7, 2.5]} castShadow receiveShadow>
        <sphereGeometry args={[0.7, 24, 18]} />
        <meshStandardMaterial color="#e0b86b" roughness={0.75} />
      </mesh>

      <mesh position={[-0.35, 1.1, 0.2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.65, 2.2, 24]} />
        <meshStandardMaterial color="#8ab4c8" roughness={0.8} />
      </mesh>

      <mesh position={[1.65, 0.85, -0.9]} rotation={[0, -0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.7, 1.5]} />
        <meshStandardMaterial color="#c9b48c" roughness={0.9} />
      </mesh>

      <mesh position={[-0.2, 1.5, -3.8]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 3.0, 1.0]} />
        <meshStandardMaterial color="#dfd0b8" roughness={0.9} />
      </mesh>

      {/* Custom ShaderMaterial mesh (exercises flatMatFor replacement) */}
      <mesh position={[-0.1, 2.65, 1.0]} rotation={[0.45, 0.25, 0]} material={customMat} castShadow>
        <torusGeometry args={[0.62, 0.23, 18, 32]} />
      </mesh>

      {/* DoubleSide mesh (exercises clothFlat -> clothMatFor) */}
      <mesh position={[1.45, 2.45, -0.4]} rotation={[0.35, -0.25, 0.12]} castShadow>
        <planeGeometry args={[2.1, 1.35, 8, 6]} />
        <meshStandardMaterial color="#e07b5f" side={THREE.DoubleSide} roughness={0.82} />
      </mesh>

      <PostFX settings={SPIKE_POST} enabled={enableInk} />
    </>
  );
};

export const InkSpike: React.FC<InkSpikeProps> = ({ enableInk = true }) => (
  <AbsoluteFill style={{ backgroundColor: "#cbe4f9" }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows
      gl={{ antialias: true, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 45, near: 0.2, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <SpikeScene enableInk={enableInk} />
    </ThreeCanvas>
  </AbsoluteFill>
);
