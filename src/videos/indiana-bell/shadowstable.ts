import * as THREE from "three";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _snapped = new THREE.Vector3();

/** Quantize the directional shadow half-extent on a 2 m lattice via Math.ceil so the frustum never shrinks. */
export function quantizeShadowExtent(dist: number, isGolden: boolean): number {
  const minR = isGolden ? 36 : 12; // 36 >= 35 preserves golden-shot floor on the 2 m lattice
  const rawR = Math.max(minR, Math.min(95, dist * 1.15 + 7));
  return Math.ceil(rawR / 2) * 2;
}

/**
 * Snap the shadow-camera focus point to the world-space shadow-texel grid in the light's view plane,
 * without mutating `focus`, and derive both `outTarget` and `outPos` with zero per-frame allocations.
 */
export function snapShadowLight(
  focus: THREE.Vector3,
  sunDir: THREE.Vector3,
  halfExtent: number,
  mapSize: number,
  sunDist: number,
  outTarget: THREE.Vector3,
  outPos: THREE.Vector3,
): void {
  _fwd.copy(sunDir).normalize();
  _right.crossVectors(WORLD_UP, _fwd);
  if (_right.lengthSq() < 1e-8) {
    _right.set(1, 0, 0);
  } else {
    _right.normalize();
  }
  _up.crossVectors(_fwd, _right);

  const texel = (2 * halfExtent) / mapSize;
  const u = focus.dot(_right);
  const v = focus.dot(_up);
  const du = Math.round(u / texel) * texel - u;
  const dv = Math.round(v / texel) * texel - v;

  _snapped.copy(focus).addScaledVector(_right, du).addScaledVector(_up, dv);
  outTarget.copy(_snapped);
  outPos.copy(_snapped).addScaledVector(_fwd, sunDist);
}
