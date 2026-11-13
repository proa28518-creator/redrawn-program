// Card material contract (Layla's office report, item 6): ONE factory for all character
// and effect cards, so no card can ghost through opaque geometry. Rule: no effect
// layer may be transparent with depthWrite false where it can sit behind opaque
// geometry — the soft path below is therefore an alphaTest cut-out, not a transparent
// layer (it keeps the hard edge of the cut-out; the see-through soft look is gone by
// design — if Layla's office reports dust/mist looking hard-edged, the alternative is
// transparent + depthWrite true). cardShade()/blobMaterial() stay per-video (./cardshade)
// and keep being applied in cast.ts; this file only builds the raw materials.
import * as THREE from "three";
export const cardMaterial = (map: THREE.Texture) => {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  m.alphaToCoverage = false;
  return m;
};
export const cardDepthMaterial = (map: THREE.Texture) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
export const fxHardMaterial = (map: THREE.Texture) => {
  const m = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  m.alphaToCoverage = false;
  return m;
};
export const fxSoftMaterial = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
