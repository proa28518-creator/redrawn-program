// "Abu Simbel": the two giant temples cut into pieces and moved to escape the rising Nile.
// 187 words, 12 shots, 55.8 s at 3.35 wps = 1674 frames at 30 fps, 1080x1920.
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain (Agent 4):
//   InkPass (world ink lines, own pass) -> lens blur pre + main (thin-lens DOF per shot from dofAt) ->
//   [bloom (emissive only) + NEUTRAL tone mapping + colour grade] (one merged EffectPass), MSAA 4.
// Ink runs before the DOF so lines blur with what they belong to; bloom after the DOF so glows defocus with their
// source; the grade is display-referred, so it comes after tone mapping. Every pixel-sized parameter is specified at
// 1080x1920 and scaled with the output size, so stills at --scale 0.5 and the 1440x2560 final match.
// Place changes crossfade by stacking a second canvas for the fade frames; the hook ends on a 4-frame white flash.
// Shot starts (locked script, 3.35 wps) in frames: 1:0 dawn | 2:90 day | 3:215 day | 4:340 day | 5:582 day |
// 6:761 day | 7:940 day | 8:1110 day | 9:1352 day | 10:1424 day | 11:1487 day | 12:1540 sanctuary | end 1674.
// Light groups (lights.ts / grade.ts): dawn = shot 1, day = shots 2-11, sanctuary = shot 12 (dark inner room,
// single sun shaft; shade/lift and the sanctuary grade are set so the interior never crushes to pure black).
// DOF coverage (~1/3 of screen time, close-ups 12-16 px, wides sharp) comes from the camera plan's dofAt;
// this file only applies it, focused on the shot's focus point (else the camera look target).
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
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { SHOTS, layersAt, dofAt, FLASH_AT } from "./story";
import { flashAt } from "../common/flash";

/** Locked script: 55.8 s x 30 fps. The merged story.ts TOTAL must equal this. */
export const ABU_SIMBEL_FRAMES = 1674;

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, pre: true, bloom: true, grade: true, grain: false, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1).
 *  In this film the only things over threshold 1.0 are the dawn sun glints and the sanctuary sun shaft. */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("abu-simbel kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    // World ink: house #0b0a0c, 5.1 px near (6 m) -> 3.3 px far (90 m) at 1080x1920 (skill target 1).
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera, { color: "#0b0a0c", widthNear: 5.1, widthFar: 3.3 }),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  // NOTE (Redrawn program): EffectComposer types its children as
  // JSX.Element | JSX.Element[] (both @react-three/postprocessing 2.x and
  // 3.x), so conditional `null` children fail `tsc --noEmit`. Build the
  // pass list as an array and filter the disabled passes out — the rendered
  // order and behaviour are identical to the original.
  // Composer stage order (skill, 6 stages): 1. World Ink -> 2. Lens Blur Pre -> 3. Lens Blur Main ->
  // 4. HDR Bloom (emissives only) -> 5. NEUTRAL Tone Mapping -> 6. Colour Grade & Vignette (+ grain, off).
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
    return (
      <EffectComposer multisampling={4}>
        {passes}
      </EffectComposer>
    );
  }, [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  assertCamAppliedThisFrame(f);
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  fx.grain.seed = f; // deterministic per frame
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const AbuSimbel: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = flashAt(f, FLASH_AT);
  return (
    <AbsoluteFill style={{ background: "#e8dcc0" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
