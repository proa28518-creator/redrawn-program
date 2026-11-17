// "BangladeshHeist" («غلطة واحدة» — Bangladesh Bank Heist, Feb 2016)
// 1080x1920, 30 fps, 2158 frames (71.93 s), SILENT picture-only composition.
// Reuses indiana-bell look modules (shade.ts, lights.ts, ink.ts, lensblur.ts, grade.ts)
// and src/videos/common/inkbeat-char/ 3D characters. Phase-6 ink engine: OFF.
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
  CentralBankInteriorSet,
  DeutscheBankOfficeSet,
  FedReviewRoomSet,
  HackerHideoutSet,
  MoneyFlowWorldMapSet,
  NightCityDhakaSet,
  PrinterRoomSet,
  SwiftScreenCloseupSet,
} from "./world";
import {
  BankStaffRig,
  DeutscheBankClerkRig,
  FedReviewTeamRig,
  HackerTeamRig,
} from "./cast";

export const BANGLADESH_FRAMES = TOTAL_FRAMES;

export const BANGLADESH_HEIST_META = {
  id: "BangladeshHeist",
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: TOTAL_FRAMES,
} as const;

type BangladeshLightRig = {
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
  charFillPos?: V3;
  charFillCol?: string;
  charFillI?: number;
};

const LIGHT_RIGS: Record<LightMode, BangladeshLightRig> = {
  "swift-screen": {
    lit: [1.62, 1.58, 1.52],
    shade: [0.50, 0.52, 0.60],
    lift: [0.16, 0.17, 0.22],
    sunPos: [3, 6, 7],
    sunCol: "#f5f8ff",
    sunI: 2.55,
    sky: "#d8e8fa",
    ground: "#8e887e",
    hemiI: 1.25,
    grade: "day",
    charFillPos: [-0.8, 1.8, 2.2],
    charFillCol: "#ffe6c2",
    charFillI: 3.5,
  },
  "central-bank": {
    lit: [1.62, 1.54, 1.38],
    shade: [0.48, 0.48, 0.56],
    lift: [0.14, 0.14, 0.18],
    sunPos: [5, 11, 9],
    sunCol: "#fff4dc",
    sunI: 2.55,
    sky: "#dce8f8",
    ground: "#a89a86",
    hemiI: 1.22,
    grade: "day",
    charFillPos: [0, 2.4, 2.5],
    charFillCol: "#ffebc8",
    charFillI: 4.0,
  },
  "hacker-rig": {
    lit: [1.66, 1.60, 1.50],
    shade: [0.54, 0.55, 0.64],
    lift: [0.18, 0.19, 0.24],
    sunPos: [-4, 10, 8],
    sunCol: "#fff3de",
    sunI: 2.65,
    sky: "#d2e4f8",
    ground: "#988c80",
    hemiI: 1.35,
    grade: "day",
    charFillPos: [0, 2.1, 2.2],
    charFillCol: "#e8f4ff",
    charFillI: 5.5,
  },
  "printer-room": {
    lit: [1.58, 1.54, 1.46],
    shade: [0.48, 0.50, 0.58],
    lift: [0.14, 0.14, 0.18],
    sunPos: [4, 10, 7],
    sunCol: "#fff6e5",
    sunI: 2.45,
    sky: "#dde6f0",
    ground: "#9c9284",
    hemiI: 1.22,
    grade: "day",
  },
  "dhaka-night": {
    lit: [1.08, 1.16, 1.38],
    shade: [0.24, 0.28, 0.42],
    lift: [0.06, 0.08, 0.14],
    sunPos: [-8, 14, 10],
    sunCol: "#9bb8f2",
    sunI: 1.65,
    sky: "#4c6494",
    ground: "#2b3242",
    hemiI: 0.96,
    grade: "dusk",
    charFillPos: [-0.8, 2.6, 2.5],
    charFillCol: "#ffae42",
    charFillI: 7.5,
  },
  "world-map": {
    lit: [1.66, 1.62, 1.54],
    shade: [0.54, 0.56, 0.66],
    lift: [0.18, 0.19, 0.24],
    sunPos: [0, 12, 8],
    sunCol: "#fff6e6",
    sunI: 2.68,
    sky: "#dcecfb",
    ground: "#96a2b0",
    hemiI: 1.35,
    grade: "day",
    charFillPos: [0, 2.5, 1.2],
    charFillCol: "#9cd8ff",
    charFillI: 4.5,
  },
  "deutsche-office": {
    lit: [1.62, 1.56, 1.44],
    shade: [0.50, 0.50, 0.58],
    lift: [0.15, 0.15, 0.19],
    sunPos: [-6, 10, 8],
    sunCol: "#fff5e0",
    sunI: 2.65,
    sky: "#e4eef8",
    ground: "#b8a48c",
    hemiI: 1.32,
    grade: "day",
    charFillPos: [-0.4, 2.0, 1.8],
    charFillCol: "#fff0d4",
    charFillI: 4.5,
  },
  "fed-review": {
    lit: [1.56, 1.50, 1.40],
    shade: [0.46, 0.46, 0.55],
    lift: [0.13, 0.13, 0.18],
    sunPos: [3, 11, 8],
    sunCol: "#fff4de",
    sunI: 2.45,
    sky: "#dce6f2",
    ground: "#968676",
    hemiI: 1.22,
    grade: "day",
    charFillPos: [0, 2.2, 2.0],
    charFillCol: "#ffcf78",
    charFillI: 4.8,
  },
  "swift-screen-finale": {
    lit: [1.56, 1.54, 1.52],
    shade: [0.48, 0.50, 0.58],
    lift: [0.15, 0.16, 0.20],
    sunPos: [3, 6, 7],
    sunCol: "#f2f7ff",
    sunI: 2.40,
    sky: "#c8dcf4",
    ground: "#848e9c",
    hemiI: 1.18,
    grade: "day",
    charFillPos: [0, 1.8, 1.8],
    charFillCol: "#ffe8d4",
    charFillI: 3.6,
  },
};

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.44,
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

const BangladeshScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { camera, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const sunRef = useRef<THREE.DirectionalLight>(null);

  const { shot, localFrame, u } = getShotAtFrame(frame);
  const camSpec = evaluateCamera(shot, u, frame);

  // Shot 4 continuously hands off from HackerHideout (Stage A, f < 320) to CentralBankInterior (Stage B, f >= 320)
  const activeSet = shot.id === 4 && frame >= 320 ? "central-bank" : shot.set;
  const effectiveLight: LightMode = shot.id === 4 && frame >= 320 ? "central-bank" : shot.light;
  const rig = LIGHT_RIGS[effectiveLight];

  applyCam(cam, camSpec, frame);
  assertCamAppliedThisFrame(frame);
  cam.layers.enable(NOINK);

  TONE.uLitCol.value.set(...rig.lit);
  TONE.uShadeCol.value.set(...rig.shade);
  TONE.uShadeLift.value.set(...rig.lift);
  TONE.uLambert.value = LIGHTS.day.lambert;
  TONE.uSideK.value = LIGHTS.day.sideK;
  TONE.uTerm.value = LIGHTS.day.term;
  TONE.uBounce.value.set(0, 0, 0);
  TONE.uSat.value = 1.06;

  // 6-stage indiana-bell post-processing stack (Phase-6 ink engine OFF)
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

  // Dynamic set accent lights (Shot 1 crimson wedge flare, Shot 7 printer fault pulse)
  const wedgeGlow =
    shot.id === 1
      ? smoothstep(18, 40, frame) * 5.0
      : shot.id === 15 || shot.id === 22
        ? 3.2
        : 0;
  const printerPulse =
    shot.id === 7 ? 2.0 + 4.0 * (0.5 + 0.5 * Math.sin(frame * 0.45)) : 0;

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
      {rig.charFillPos && (
        <pointLight
          position={rig.charFillPos}
          color={rig.charFillCol}
          intensity={rig.charFillI ?? 4.0}
          distance={16}
          decay={1.6}
        />
      )}
      {wedgeGlow > 0 && (
        <pointLight
          position={[0.0, 1.15, 0.75]}
          color="#ff3b30"
          intensity={wedgeGlow}
          distance={8}
          decay={1.6}
        />
      )}
      {printerPulse > 0 && (
        <pointLight
          position={[-0.36, 1.75, 0.55]}
          color="#ff2e2e"
          intensity={printerPulse}
          distance={10}
          decay={1.6}
        />
      )}

      {activeSet === "swift-screen" && (
        <SwiftScreenCloseupSet shotId={shot.id} u={u} frame={frame} />
      )}
      {activeSet === "central-bank" && (
        <>
          <CentralBankInteriorSet shotId={shot.id} u={u} frame={frame} />
          <BankStaffRig
            shotId={shot.id}
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}
      {activeSet === "hacker-hideout" && (
        <>
          <HackerHideoutSet shotId={shot.id} u={u} frame={frame} />
          <HackerTeamRig
            shotId={shot.id}
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}
      {activeSet === "printer-room" && (
        <>
          <PrinterRoomSet u={u} frame={frame} />
          <BankStaffRig
            shotId={shot.id}
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}
      {activeSet === "dhaka-night" && <NightCityDhakaSet frame={frame} />}
      {activeSet === "world-map" && <MoneyFlowWorldMapSet shotId={shot.id} u={u} />}
      {activeSet === "deutsche-office" && (
        <>
          <DeutscheBankOfficeSet shotId={shot.id} u={u} />
          <DeutscheBankClerkRig
            shotId={shot.id}
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}
      {activeSet === "fed-review" && (
        <>
          <FedReviewRoomSet shotId={shot.id} u={u} />
          <FedReviewTeamRig
            shotId={shot.id}
            frame={frame}
            localFrame={localFrame}
            u={u}
            camPos={camSpec.pos}
          />
        </>
      )}

      {post}
    </>
  );
};

export const BangladeshHeist: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#2c3f6b" }}>
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
      <BangladeshScene />
    </ThreeCanvas>
  </AbsoluteFill>
);

export default BangladeshHeist;
