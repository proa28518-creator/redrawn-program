// Phase 3 demo: the ported inkbeat character family, as-is, in a simple street
// set in the Indiana Bell idiom. Two sequences in one composition:
//   Scene A (frames 0–119)   — six family variants in a two-row lineup, idle
//                              breathing + automatic blinks (blinkAt via `t`).
//   Scene B (frames 120–269) — the adult walks toward camera (pose.walk phase,
//                              speed matched to family.ts WALK constants) while
//                              the elder holds a book in front of her chest with
//                              an arm pose solved by the ported core/ik.ts
//                              holdInFront(), and the kid waves.
// No audio, no captions, no post chain (post is a later phase). Every animated
// value is a pure function of the frame number.
import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Character3D } from "../common/inkbeat-char/char/Character3D";
import type { CharacterSpec } from "../common/inkbeat-char/char/Character3D";
import { holdInFront } from "../common/inkbeat-char/core/ik";
import { ELDER_BUILD, WALK } from "../common/inkbeat-char/char/family";
import type { V3 } from "../common/inkbeat-char/types";
import { DEMO_CAST } from "./demoCast";
import { StreetSet } from "./world";

export const FAMILY_DEMO_FRAMES = 270;
const FPS = 30;
const SCENE_B_START = 120;

/* ---------------------------------- Scene A ---------------------------------- */

type RowEntry = { spec: CharacterSpec; position: V3; yaw: number; mouth: "smile" | "grin" | "smirk" | "flat" };
const LINEUP: RowEntry[] = [
  // front row
  { spec: DEMO_CAST.kid, position: [-1.25, 0, 0.55], yaw: -0.2, mouth: "grin" },
  { spec: DEMO_CAST.adult, position: [0.05, 0, 0.55], yaw: 0.25, mouth: "smile" },
  { spec: DEMO_CAST.pear, position: [1.3, 0, 0.55], yaw: 0.35, mouth: "smile" },
  // back row
  { spec: DEMO_CAST.barrel, position: [-1.55, 0, -0.85], yaw: 0.15, mouth: "smirk" },
  { spec: DEMO_CAST.tall, position: [-0.25, 0, -0.85], yaw: -0.28, mouth: "flat" },
  { spec: DEMO_CAST.elder, position: [1.05, 0, -0.85], yaw: 0.42, mouth: "smile" },
];

/* ---------------------------------- Scene B ---------------------------------- */

const WALKER = DEMO_CAST.adult;
const WALK_CYCLE_S = 0.95;
// No-slip speed: the planted foot sweeps 2 * (WALK.stride * height) per half
// cycle, so the body advances 4 * WALK.stride * height per full cycle.
const WALK_SPEED = (4 * WALK.stride * WALKER.height) / WALK_CYCLE_S;

const ELDER_POS: V3 = [0.88, 0, -1.7];
const ELDER_YAW = -0.5;
// Arm pose + hand position for the book, solved by the ported IK (chest height,
// in front, never covering the face). Deterministic: computed once, constant.
export const ELDER_HOLD = holdInFront({
  position: ELDER_POS,
  yaw: ELDER_YAW,
  height: DEMO_CAST.elder.height,
  side: "R",
  build: ELDER_BUILD,
  // forward 0.15 (the function's own parameter): the default 0.20 target sits
  // 0.0478 m out of the elder build's reach; at 0.15 the solver's residual is
  // 0.0027 m, with the hand still at the default chest height (up 0.46 h).
  forward: 0.15,
});

/* ----------------------------------- Scene ----------------------------------- */

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const t = frame / FPS;

  let camPos: V3;
  let camLook: V3;
  let fov: number;
  let body: React.ReactNode;

  if (frame < SCENE_B_START) {
    const u = frame / (SCENE_B_START - 1);
    camPos = lerp3([0.2, 1.75, 8.1], [0.05, 1.6, 7.2], u);
    camLook = [0, 0.98, -0.1];
    fov = 48;
    body = LINEUP.map((r, i) => (
      <Character3D
        key={i}
        {...r.spec}
        position={r.position}
        yaw={r.yaw}
        t={t}
        face={{ eyes: "open", mouth: r.mouth }}
        faceCamera={camPos}
        castShadow
      />
    ));
  } else {
    const local = frame - SCENE_B_START;
    const lt = local / FPS;
    const u = local / (FAMILY_DEMO_FRAMES - SCENE_B_START - 1);
    camPos = lerp3([0.15, 1.5, 3.2], [0.3, 1.42, 2.75], u);
    camLook = [0.05, 0.92, -1.5];
    fov = 50;
    const walkPhase = (lt / WALK_CYCLE_S) * Math.PI * 2;
    body = (
      <>
        <Character3D
          {...WALKER}
          position={[-0.55 + 0.05 * lt, 0, -4.1 + WALK_SPEED * lt]}
          yaw={0.22}
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
          position={[-1.05, 0, -2.7]}
          yaw={0.55}
          t={t}
          face={{ eyes: "open", mouth: "grin" }}
          pose={{ armR: [112 + Math.sin(lt * 5.2) * 14, 18] }}
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
      <hemisphereLight args={["#fff2dd", "#5a4a3a", 0.9]} />
      <directionalLight position={[4.5, 7.5, 5.5]} intensity={1.55} />
      <directionalLight position={[-5, 3.5, -2]} intensity={0.35} />
      <StreetSet />
      {body}
    </>
  );
};

export const InkbeatFamilyDemo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#241c26" }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows
      gl={{ antialias: true, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 48, near: 0.2, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene />
    </ThreeCanvas>
  </AbsoluteFill>
);
