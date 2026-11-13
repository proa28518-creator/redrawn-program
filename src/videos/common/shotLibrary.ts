// Standard shot library (Layla's office report, suggestion A): camera templates with
// hero-relative anchors. story.ts imports from ../common/shotLibrary; esbuild bundles it.
// Opus 5.5 authored; two corrections by رورو (recorded in the record file):
// (a) wideEstablishing: the brief's "[0,6,1]*distance" scaled the 6 m height by the
//     distance (14 -> 84 m up); the offset is 6 m up and `distance` back.
// (b) The templates as drafted returned a STATIC Cam for every frame — the house rule
//     forbids static holds >= 4 frames — so each template takes an optional push factor
//     (f) => number (e.g. pushK(f, f0, rate)) applied to the fov through the zoom()
//     formula from story.ts, mirroring zoom(). Without push the framing is static.
// No story.ts adopts the library yet: S8a (bridge) keeps its dolly + pushK line because
// its push is a dolly factor, not a zoom factor — the library awaits its first adopter.
import { type CamLike } from "./applyCam";

export type V3 = [number, number, number];

/** the zoom() fov formula from story.ts: fov scaled by the push factor k. */
const zoomFov = (fov: number, k: number) =>
  (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k);

type PushOpts = { push?: (f: number) => number };

export function heroCloseUp(
  anchor: V3,
  opts?: { feetY?: number; distance?: number; fov?: number; roll?: number; dir?: V3 } & PushOpts
): (f: number) => CamLike {
  const feetY = opts?.feetY ?? 0;
  const distance = opts?.distance ?? 2.2;
  const fov = opts?.fov ?? 35;
  const roll = opts?.roll ?? 0;
  const dir = opts?.dir ?? [0, 0.15, 1];
  const face: V3 = [anchor[0], feetY + 1.44, anchor[2]];
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const ndir: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const pos: V3 = [
    face[0] + ndir[0] * distance,
    face[1] + ndir[1] * distance,
    face[2] + ndir[2] * distance,
  ];
  return (f: number) => ({ pos, look: face, fov: opts?.push ? zoomFov(fov, opts.push(f)) : fov, roll });
}

export function overShoulder(
  anchor: V3,
  opts?: { feetY?: number; side?: "left" | "right"; fov?: number } & PushOpts
): (f: number) => CamLike {
  const feetY = opts?.feetY ?? 0;
  const side = opts?.side ?? "right";
  const fov = opts?.fov ?? 38;
  const face: V3 = [anchor[0], feetY + 1.44, anchor[2]];
  const xOffset = side === "left" ? -0.8 : 0.8;
  const pos: V3 = [face[0] + xOffset, face[1] + 0.3, face[2] - 1.2];
  return (f: number) => ({ pos, look: face, fov: opts?.push ? zoomFov(fov, opts.push(f)) : fov, roll: 0 });
}

export function wideEstablishing(
  anchor: V3,
  opts?: { feetY?: number; distance?: number; fov?: number } & PushOpts
): (f: number) => CamLike {
  const feetY = opts?.feetY ?? 0;
  const distance = opts?.distance ?? 14;
  const fov = opts?.fov ?? 46;
  const face: V3 = [anchor[0], feetY + 1.44, anchor[2]];
  const pos: V3 = [face[0], face[1] + 6, face[2] + distance];
  return (f: number) => ({ pos, look: face, fov: opts?.push ? zoomFov(fov, opts.push(f)) : fov, roll: 0 });
}

export function macroTopDown(
  anchor: V3,
  opts?: { feetY?: number; height?: number; fov?: number } & PushOpts
): (f: number) => CamLike {
  const feetY = opts?.feetY ?? 0;
  const height = opts?.height ?? 2.5;
  const fov = opts?.fov ?? 40;
  const face: V3 = [anchor[0], feetY + 1.44, anchor[2]];
  const pos: V3 = [face[0], face[1] + height, face[2]];
  return (f: number) => ({ pos, look: face, fov: opts?.push ? zoomFov(fov, opts.push(f)) : fov, roll: 0 });
}
