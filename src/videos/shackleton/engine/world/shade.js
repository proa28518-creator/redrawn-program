// World materials: soft two-band toon shading on painted albedo, cool fill from the hemisphere light.
import * as THREE from "three";
import { paint } from "./paint.js";

let ramp = null;
function toonRamp() {
  if (ramp) return ramp;
  // dark band -> soft step -> lit band; linear filter softens the step a little
  const d = new Uint8Array([88, 88, 88, 255, 112, 112, 112, 255, 236, 236, 236, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(d, 4, 1);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
  ramp.needsUpdate = true;
  return ramp;
}

const matCache = new Map();
// mat("plaster", { color, repeat:[u,v], seed }) or mat("#c0603a") for a flat painted colour.
export function mat(kind, o = {}) {
  if (typeof kind === "string" && kind.startsWith("#")) { o = { ...o, color: kind }; kind = "flat"; }
  const key = kind + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  const { repeat = [1, 1], side, emissive, unlit, ...paintOpts } = o;
  let m;
  if (unlit) {
    m = new THREE.MeshBasicMaterial({ color: o.color || "#ffffff" });
  } else {
    const map = paint(kind, paintOpts);
    let tex = map;
    if (repeat[0] !== 1 || repeat[1] !== 1) { tex = map.clone(); tex.repeat.set(repeat[0], repeat[1]); tex.needsUpdate = true; }
    m = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonRamp() });
  }
  if (emissive) { m.emissive = new THREE.Color(...emissive); }
  if (side) m.side = side;
  matCache.set(key, m);
  return m;
}

// HDR glow material (windows at night, lamps, screens). Values above 1.0 bloom.
export function glow(rgb) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), toneMapped: false });
}

// Unlit painted face (signs that must stay readable in side light).
export function signMat(canvasTex) {
  return new THREE.MeshBasicMaterial({ map: canvasTex });
}
