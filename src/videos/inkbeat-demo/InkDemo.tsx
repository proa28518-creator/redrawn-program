import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Character3D } from "../common/inkbeat-char/char/Character3D";
import type { CharacterSpec, Pose } from "../common/inkbeat-char/char/Character3D";
import { holdInFront } from "../common/inkbeat-char/core/ik";
import { ELDER_BUILD, WALK } from "../common/inkbeat-char/char/family";
import type { V3 } from "../common/inkbeat-char/types";
import { PostFX, withPost } from "../common/ink";
import type { PostSettings } from "../common/ink";
import { DEMO_CAST } from "../inkbeat-family-demo/demoCast";
import { CourtyardStage } from "./stage";

export const INK_DEMO_FRAMES = 270;
const FPS = 30;
const SCENE_B_START = 120;

export interface InkDemoProps {
  enableInk?: boolean;
}

/**
 * Locked Section 4 settings with Coordinator Note 2 grade and Note 7 fade distances:
 * - Scene A cast distances: ~4.10 m (frame 119 adult) to ~6.21 m (frame 0 barrel/elder)
 * - Scene B foreground cast distances: ~3.60 m (frame 269 adult) to ~5.54 m (frame 120 adult);
 *   midground framing trio up to ~6.88 m
 * Setting fadeNear = 6.5 / fadeFar = 20.0 gives full-strength ink across the cast while
 * tapering courtyard backdrop architecture cleanly.
 */
export const DEMO_POST: PostSettings = withPost({
  outline: {
    enabled: true,
    color: "#1a1424",
    widthPx: 3.6,
    depthThreshold: 0.07,
    normalThreshold: 0.34,
    strength: 0.95,
    fadeNear: 6.5,
    fadeFar: 20.0,
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

/* ---------------------------------- Scene A ---------------------------------- */

type LineupEntry = {
  spec: CharacterSpec;
  position: V3;
  yaw: number;
  mouth: "smile" | "grin" | "smirk" | "flat";
};

const LINEUP: LineupEntry[] = [
  // Front arc
  { spec: DEMO_CAST.kid, position: [-0.82, 0, 0.25], yaw: 0.15, mouth: "grin" },
  { spec: DEMO_CAST.adult, position: [0.04, 0, 0.3], yaw: -0.08, mouth: "smile" },
  { spec: DEMO_CAST.pear, position: [0.88, 0, 0.2], yaw: -0.22, mouth: "smile" },
  // Back arc
  { spec: DEMO_CAST.barrel, position: [-1.08, 0, -0.55], yaw: 0.25, mouth: "smirk" },
  { spec: DEMO_CAST.tall, position: [-0.12, 0, -0.65], yaw: -0.1, mouth: "flat" },
  { spec: DEMO_CAST.elder, position: [1.02, 0, -0.55], yaw: -0.28, mouth: "smile" },
];

/* ---------------------------------- Scene B ---------------------------------- */

const WALKER = DEMO_CAST.adult;
const WALK_CYCLE_S = 0.95;
// No-slip speed from family.ts WALK constants
const WALK_SPEED = (4 * WALK.stride * WALKER.height) / WALK_CYCLE_S;

const ELDER_POS: V3 = [0.65, 0, -0.2];
const ELDER_YAW = -0.45;
export const ELDER_HOLD = holdInFront({
  position: ELDER_POS,
  yaw: ELDER_YAW,
  height: DEMO_CAST.elder.height,
  side: "R",
  build: ELDER_BUILD,
  forward: 0.15,
});

/* ----------------------------------- Scene ----------------------------------- */

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

const DemoScene: React.FC<{ enableInk: boolean }> = ({ enableInk }) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const t = frame / FPS;

  let camPos: V3;
  let camLook: V3;
  let fov: number;
  let body: React.ReactNode;

  if (frame < SCENE_B_START) {
    const u = frame / (SCENE_B_START - 1);
    camPos = lerp3([0.55, 1.55, 5.4], [-0.35, 1.4, 4.35], u);
    camLook = [0.0, 1.05, -0.8];
    fov = 54;
    body = LINEUP.map((entry, i) => {
      let pose: Pose | undefined;
      if (i === 0) {
        pose = { armR: [34 + Math.sin(t * 3.1) * 14, 18], headYaw: Math.sin(t * 1.6) * 5 };
      } else if (i === 1) {
        pose = { armL: [24 + Math.cos(t * 2.5) * 9, 14], headNod: Math.sin(t * 1.8) * 3 };
      } else {
        pose = { headYaw: Math.sin(t * 1.2 + i * 0.9) * 4 };
      }
      return (
        <Character3D
          key={i}
          {...entry.spec}
          position={entry.position}
          yaw={entry.yaw}
          t={t}
          face={{ eyes: "open", mouth: entry.mouth }}
          pose={pose}
          faceCamera={camPos}
          castShadow
        />
      );
    });
  } else {
    const local = frame - SCENE_B_START;
    const lt = local / FPS;
    const u = local / (INK_DEMO_FRAMES - SCENE_B_START - 1);
    camPos = lerp3([-0.3, 1.32, 3.65], [0.45, 1.52, 4.75], u);
    camLook = lerp3([0.05, 1.02, -0.3], [-0.1, 1.08, 0.25], u);
    fov = 52;
    const walkPhase = (lt / WALK_CYCLE_S) * Math.PI * 2;

    body = (
      <>
        <Character3D
          {...WALKER}
          position={[-0.3, 0, -1.8 + WALK_SPEED * lt]}
          yaw={0.12}
          t={t}
          face={{ eyes: "open", mouth: "smile" }}
          pose={{ walk: walkPhase }}
          castShadow
        />
        <Character3D
          {...DEMO_CAST.elder}
          position={ELDER_POS}
          yaw={ELDER_YAW}
          t={t}
          face={{ eyes: "open", mouth: "smile" }}
          pose={ELDER_HOLD.pose}
          hold="book"
          castShadow
        />
        <Character3D
          {...DEMO_CAST.kid}
          position={[-0.82, 0, -0.25]}
          yaw={0.45}
          t={t}
          face={{ eyes: "open", mouth: "grin" }}
          pose={{ armR: [112 + Math.sin(lt * 5.2) * 14, 18] }}
          castShadow
        />
        <Character3D
          {...DEMO_CAST.pear}
          position={[1.32, 0, -1.65]}
          yaw={-0.4}
          t={t}
          face={{ eyes: "open", mouth: "smile" }}
          faceCamera={camPos}
          castShadow
        />
        <Character3D
          {...DEMO_CAST.barrel}
          position={[-1.25, 0, -1.75]}
          yaw={0.3}
          t={t}
          face={{ eyes: "open", mouth: "smirk" }}
          faceCamera={camPos}
          castShadow
        />
        <Character3D
          {...DEMO_CAST.tall}
          position={[0.2, 0, -2.1]}
          yaw={-0.12}
          t={t}
          face={{ eyes: "open", mouth: "flat" }}
          faceCamera={camPos}
          castShadow
        />
      </>
    );
  }

  camera.position.set(...camPos);
  camera.lookAt(...camLook);
  camera.fov = fov;
  camera.near = 0.2;
  camera.far = 200;
  camera.updateProjectionMatrix();

  return (
    <>
      <color attach="background" args={["#bfe0f5"]} />
      <CourtyardStage />
      {body}
      <PostFX settings={DEMO_POST} enabled={enableInk} />
    </>
  );
};

export const InkDemo: React.FC<InkDemoProps> = ({ enableInk = true }) => (
  <AbsoluteFill style={{ backgroundColor: "#bfe0f5" }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows
      gl={{ antialias: true, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 54, near: 0.2, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <DemoScene enableInk={enableInk} />
    </ThreeCanvas>
  </AbsoluteFill>
);
