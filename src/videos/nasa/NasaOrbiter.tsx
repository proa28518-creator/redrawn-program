// "NasaOrbiter" — Mars Climate Orbiter (1998–1999)
// 1080x1920, 30 fps, 2027 frames (67.57 s), SILENT picture-only composition.
// Reuses indiana-bell look modules (shade.ts, lights.ts, ink.ts, lensblur.ts, grade.ts)
// and src/videos/common/inkbeat-char/ 3D characters.
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { applyCam, assertCamAppliedThisFrame } from "../common/applyCam";
import { InkPass, noInkFallback, NOINK } from "../indiana-bell/ink";
import { LensBlur } from "../indiana-bell/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor, GradeLight } from "../indiana-bell/grade";
import { LIGHTS } from "../indiana-bell/lights";
import { TONE } from "../indiana-bell/shade";
import {
  evaluateCamera,
  FPS,
  getShotAtFrame,
  LightMode,
  smoothstep,
  TOTAL_FRAMES,
  V3,
} from "./story";
import {
  DataScreenCloseupSet,
  DeepSpaceSet,
  JplControlRoomSet,
  LaunchPadSet,
  LockheedOfficeSet,
  MarsApproachBurnSet,
} from "./world";
import { DualTeamRoomRig, JplRoomCrowd, LockheedTeamRig } from "./cast";

export const NASA_ORBITER_META = {
  id: "NasaOrbiter",
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: TOTAL_FRAMES,
} as const;

type NasaLightRig = {
  lit: V3;
  shade: V3;
  lift: V3;
  sunPos: V3;
  sunCol: string;
  sunI: number;
  sky: string;
  ground: string;
  hemiI: number;
  grade: GradeLight;
};

const LIGHT_RIGS: Record<LightMode, NasaLightRig> = {
  space: {
    lit: [1.62, 1.54, 1.38],
    shade: [0.42, 0.44, 0.56],
    lift: [0.10, 0.12, 0.18],
    sunPos: [-12, 10, 14],
    sunCol: "#fff4d8",
    sunI: 2.9,
    sky: "#98b8f0",
    ground: "#6e5a54",
    hemiI: 1.05,
    grade: "day",
  },
  dawn: {
    lit: LIGHTS.day.lit,
    shade: LIGHTS.day.shade,
    lift: [0.08, 0.08, 0.14],
    sunPos: [14, 16, 12],
    sunCol: "#ffebd0",
    sunI: 2.8,
    sky: "#c8e0ff",
    ground: "#b89c80",
    hemiI: 0.95,
    grade: "day",
  },
  ops: {
    lit: [1.55, 1.50, 1.40],
    shade: [0.48, 0.50, 0.58],
    lift: [0.14, 0.15, 0.20],
    sunPos: [4, 12, 8],
    sunCol: "#fff6e6",
    sunI: 2.4,
    sky: "#d6e4f5",
    ground: "#8c8478",
    hemiI: 1.15,
    grade: "day",
  },
  office: {
    lit: [1.58, 1.50, 1.36],
    shade: [0.46, 0.44, 0.52],
    lift: [0.12, 0.12, 0.16],
    sunPos: [-6, 10, 9],
    sunCol: "#fff2d6",
    sunI: 2.6,
    sky: "#e2edf8",
    ground: "#b89d80",
    hemiI: 1.15,
    grade: "day",
  },
  screen: {
    lit: [1.48, 1.46, 1.40],
    shade: [0.42, 0.44, 0.52],
    lift: [0.10, 0.12, 0.16],
    sunPos: [3, 6, 6],
    sunCol: "#eef4ff",
    sunI: 2.1,
    sky: "#c4d8f0",
    ground: "#7c7468",
    hemiI: 0.95,
    grade: "day",
  },
  mars: {
    lit: [1.62, 1.38, 1.14],
    shade: [0.44, 0.34, 0.42],
    lift: [0.12, 0.08, 0.12],
    sunPos: [-10, 12, 12],
    sunCol: "#ffecd0",
    sunI: 2.8,
    sky: "#d8b4a0",
    ground: "#c26c3a",
    hemiI: 1.05,
    grade: "golden",
  },
  "dark-ops": {
    lit: [0.95, 1.02, 1.18],
    shade: [0.18, 0.21, 0.30],
    lift: [0.04, 0.06, 0.10],
    sunPos: [2, 6, 4],
    sunCol: "#8ab8f0",
    sunI: 0.95,
    sky: "#4b6282",
    ground: "#242b36",
    hemiI: 0.52,
    grade: "dusk",
  },
  "screen-dark": {
    lit: [0.98, 1.00, 1.08],
    shade: [0.20, 0.22, 0.28],
    lift: [0.04, 0.05, 0.08],
    sunPos: [2, 4, 4],
    sunCol: "#d4e2f7",
    sunI: 1.05,
    sky: "#526682",
    ground: "#28303c",
    hemiI: 0.48,
    grade: "dusk",
  },
};

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.45,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
    levels: 6,
    radius: 0.55,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const NasaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { camera, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const sunRef = useRef<THREE.DirectionalLight>(null);

  const { shot, localFrame, u } = getShotAtFrame(frame);
  const camSpec = evaluateCamera(shot, u, frame);

  // Resolve light rig (Shot 22 Stage B switches to darkened control room)
  const effectiveLight: LightMode =
    shot.id === 22 && u >= 0.58 ? "dark-ops" : shot.light;
  const rig = LIGHT_RIGS[effectiveLight];

  // Shot 10 shifts tone gently as the file passes from Lockheed to JPL
  const toneShift = shot.id === 10 ? smoothstep(0.2, 0.85, u) : 0;

  // Apply camera & update twoTone uniforms synchronously every frame
  applyCam(cam, camSpec, frame);
  assertCamAppliedThisFrame(frame);
  cam.layers.enable(NOINK);

  TONE.uLitCol.value.set(
    rig.lit[0] + toneShift * 0.12,
    rig.lit[1] - toneShift * 0.14,
    rig.lit[2] - toneShift * 0.18,
  );
  TONE.uShadeCol.value.set(...rig.shade);
  TONE.uShadeLift.value.set(...rig.lift);
  TONE.uLambert.value = LIGHTS.day.lambert;
  TONE.uSideK.value = LIGHTS.day.sideK;
  TONE.uTerm.value = LIGHTS.day.term;
  TONE.uBounce.value.set(0, 0, 0);
  TONE.uSat.value = 1.06;

  // Post-processing stack (indiana-bell idiom)
  const fx = useMemo(
    () => ({
      ink: new InkPass(scene, cam),
      lens: new LensBlur({ maxCoC: 20, nearScale: 1.1 }),
      bloom: makeBloom(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    }),
    [cam, scene],
  );
  useEffect(() => () => fx.ink.dispose(), [fx]);

  useEffect(() => {
    noInkFallback(scene);
  });

  fx.lens.focus = camSpec.focusDist ?? shot.dofFocusDist;
  fx.lens.cInf = shot.dofCInf;
  gradeFor(fx.grade, rig.grade);

  const post = useMemo(
    () => (
      <EffectComposer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </EffectComposer>
    ),
    [fx],
  );

  // Determine active set (handling Shot 22's continuous Stage A -> Stage B transition)
  const activeSet =
    shot.id === 22 && u >= 0.58 ? "jpl-control" : shot.set;

  // Dynamic ignition / entry plasma point light intensity
  const ignitionLight =
    shot.id === 3
      ? smoothstep(0.0, 0.25, u) * 3.8
      : shot.id >= 20 && shot.id <= 22 && !(shot.id === 22 && u >= 0.58)
        ? 2.8
        : 0;

  return (
    <>
      <hemisphereLight args={[rig.sky, rig.ground, rig.hemiI]} />
      <directionalLight
        ref={sunRef}
        position={rig.sunPos}
        color={rig.sunCol}
        intensity={rig.sunI}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      {ignitionLight > 0 && (
        <pointLight
          position={shot.id === 3 ? [0, 1.5, 1.5] : [0, 0.2, 0.8]}
          color="#ff8c2e"
          intensity={ignitionLight * 8}
          distance={22}
          decay={1.5}
        />
      )}
      {shot.id === 23 && (
        <pointLight
          position={[1.55, 2.4, -2.5]}
          color="#ffae52"
          intensity={10}
          distance={12}
          decay={1.6}
        />
      )}

      {activeSet === "deep-space" && (
        <DeepSpaceSet shotId={shot.id} u={u} frame={frame} />
      )}
      {activeSet === "launch-pad" && <LaunchPadSet u={u} />}
      {activeSet === "jpl-control" && (
        <>
          <JplControlRoomSet shotId={shot.id} u={u} frame={frame} />
          {(shot.id === 7 || shot.id === 10) && (
            <DualTeamRoomRig
              shotId={shot.id}
              frame={frame}
              localFrame={localFrame}
              u={u}
            />
          )}
          <JplRoomCrowd
            shotId={shot.id}
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}
      {activeSet === "lockheed-office" && (
        <>
          <LockheedOfficeSet u={u} />
          <LockheedTeamRig
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}
      {activeSet === "data-screen" && (
        <DataScreenCloseupSet shotId={shot.id} u={u} />
      )}
      {activeSet === "mars-approach" && (
        <MarsApproachBurnSet shotId={shot.id} u={u} frame={frame} />
      )}

      {post}
    </>
  );
};

export const NasaOrbiter: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#304266" }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows
      gl={{
        antialias: false,
        stencil: false,
        powerPreference: "high-performance",
        toneMappingExposure: 1.0,
      }}
      camera={{ fov: 42, near: 0.2, far: 1500 }}
    >
      <NasaScene />
    </ThreeCanvas>
  </AbsoluteFill>
);

export default NasaOrbiter;
