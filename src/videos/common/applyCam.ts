// src/videos/common/applyCam.ts — Item 1 (Layla's office report): the camera block is MANDATORY.
// Every World.update must apply the camera through applyCam(); the component asserts
// after update() that it ran for THIS frame (assertCamAppliedThisFrame(f)).
// If a future World forgets the camera block, the render throws on the first frame
// instead of silently producing empty stills (the BA5390N failure: a full copy passed
// typecheck and rendered 10 empty frames with the camera stuck at the default (0,0,5)).
// The guard is frame-numbered, not flag-reset, so a double render of the same frame
// cannot false-trip it. The (0,0,5) exact-position check was deliberately NOT used:
// a shot may legitimately sit at (0,0,5).
import * as THREE from "three";

export type CamLike = {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  roll: number;
};

let appliedFrame = -1;

export function applyCam(cam: THREE.PerspectiveCamera, c: CamLike, f: number): void {
  cam.position.set(...c.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(...c.look);
  cam.rotateZ(c.roll);
  cam.fov = c.fov;
  cam.near = 0.2;
  cam.far = 1500;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  appliedFrame = f;
}

export function assertCamAppliedThisFrame(f: number): void {
  if (appliedFrame !== f) {
    throw new Error(
      `CameraGuard: World.update did not apply the camera for frame ${f} ` +
        `(last applied frame: ${appliedFrame}). A World that never calls applyCam ` +
        `renders empty stills — see BA5390N.`,
    );
  }
}
