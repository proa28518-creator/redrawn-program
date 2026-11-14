// "Otis" — The Elevator Invention (Elisha Otis, Crystal Palace 1854)
// 55.47 s short (1664 frames @ 30 fps) in the flat-characters-in-a-3D-toon-world style.
// Post chain (house 6-stage composer):
//   1. World Ink (InkPass, #0b0a0c) -> 2. Lens Blur Pre -> 3. Lens Blur Main (thin-lens DOF per
//   shot from dofAt) -> 4. HDR Bloom (emissive only, thr 1.0) -> 5. NEUTRAL tone mapping -> 6. Colour Grade.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { assertCamAppliedThisFrame } from "../common/applyCam";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor, GradeLight } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";
import { CaptionsOverlay } from "./captions";
import { OtisAudio } from "./audio";

export const OTIS_FRAMES = TOTAL;

const gradeKeyFor = (_id: number, light: string): GradeLight =>
  light === "dusk" ? "dusk" : light === "golden" ? "golden" : "day";

type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (): PostToggles => ({
  ink: true,
  lens: true,
  pre: true,
  bloom: true,
  grade: true,
  grain: false,
  ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}),
});

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.5,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
    levels: 6,
    radius: 0.6,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3();
const fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("otis kit"));
  useEffect(() => {
    loadKit().then((k) => {
      setKit(k);
      continueRender(handle);
    });
  }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(
    () => ({
      ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
      lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
      bloom: makeBloom(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
      grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }),
    }),
    [camera, scene],
  );
  useEffect(() => () => fx.ink.dispose(), [fx]);

  const post = useMemo(() => {
    const passes = [
      on.ink ? <primitive object={fx.ink} dispose={null} /> : null,
      on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : null,
      on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null,
      on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null,
      <primitive object={fx.tone} dispose={null} />,
      on.grade ? <primitive object={fx.grade} dispose={null} /> : null,
      on.grain ? <primitive object={fx.grain} dispose={null} /> : null,
    ].filter((e): e is React.ReactElement => e !== null);
    return <EffectComposer multisampling={4}>{passes}</EffectComposer>;
  }, [fx, on]);

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  assertCamAppliedThisFrame(f);
  noInkFallback(world.root);

  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f));
  else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  const shotDef = SHOTS[Math.max(0, Math.min(SHOTS.length - 1, id - 1))];
  gradeFor(fx.grade, gradeKeyFor(id, shotDef.light));
  fx.grain.seed = f;

  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      {...(dprOverride() ? { dpr: dprOverride() } : {})}
      shadows
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}
    >
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const Otis: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 3 ? [0.65, 0.35, 0.15][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => (
        <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />
      ))}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash, pointerEvents: "none" }} />}
      <CaptionsOverlay />
      <OtisAudio />
    </AbsoluteFill>
  );
};
