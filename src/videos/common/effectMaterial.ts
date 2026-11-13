// Effect material contract (Layla's office report, item 7): ONE factory for all
// fog/smoke/cloud/spray/glow effects. It ALWAYS builds an unlit MeshBasicMaterial
// (never Lambert/Standard) and ALWAYS forces fog: false, so no effect can be darkened
// by scene fog the way the Whale fog went dark mud. Kind defaults merge UNDER params.
// Re-review fix (item 7 factory, 2026-11-13): the soft/additive defaults were
// transparent + depthWrite false — the ghosting vector item 6 removed, contradicting
// cardMaterial.ts's rule. The defaults are now the safe cut-out (matching
// fxSoftMaterial); sky/water effects that need true transparency pass
// transparent + depthWrite false EXPLICITLY in params (the clouds/sheen/pour do).
// Opus 5.5 authored; his replacement lines needed two corrections (recorded in the
// record file): invented geometry identifiers (this.ringGeo etc.) and invented cloud
// map names — the applied call sites use the real `new THREE.PlaneGeometry(1, 1)`
// geometry and the real maps (cloudMaps.night/day, stormMaps).
import * as THREE from "three";

export function effectMaterial(
  kind: "hard" | "soft" | "additive",
  params: THREE.MeshBasicMaterialParameters
): THREE.MeshBasicMaterial {
  let defaults: THREE.MeshBasicMaterialParameters = {};
  if (kind === "hard") {
    defaults = { alphaTest: 0.5 };
  } else if (kind === "soft") {
    defaults = { alphaTest: 0.5 };
  } else if (kind === "additive") {
    defaults = { alphaTest: 0.5, blending: THREE.AdditiveBlending };
  }
  return new THREE.MeshBasicMaterial({
    ...defaults,
    ...params,
    fog: false,
  });
}
