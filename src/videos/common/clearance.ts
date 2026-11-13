// src/videos/common/clearance.ts — Item 3 (Layla's office report): camera clearance.
// Set-piece builders REGISTER their solid volumes as Box3s (from known dimensions —
// the builders are Batch-based, there is no THREE.Mesh to measure). The World checks
// the camera against the registry every frame in update():
//   containment — the camera must not sit inside a registered box (margin 0.15 m);
//   occlusion — the look-ray must not hit a registered box before the target
//     (a hit within 0.15 m of the target is the target's own surface, not an occluder).
// Clearing happens at BUILD time (start of buildAbuSimbel etc.), NEVER per frame:
// clearing in update() would wipe the build-time registrations and the check would
// silently pass on an empty registry.
// NOTE: cliffMass is deliberately NOT registered as one solid box — the cliff contains
// carved interior voids (the sanctuary room), so a solid box would false-fail interior
// shots. templeFacade registers THREE boxes (left / right / over-door) matching the
// real notch, so the doorway opening itself is never treated as solid.
import * as THREE from "three";

export interface NamedBox {
  id: string;
  box: THREE.Box3;
}

const registry: NamedBox[] = [];

export function clearOccluders(): void {
  registry.length = 0;
}

export function registerOccluder(id: string, box: THREE.Box3): void {
  registry.push({ id, box });
}

const MARGIN = 0.15;

export function checkClearance(pos: THREE.Vector3, look: THREE.Vector3): void {
  const toTarget = new THREE.Vector3().subVectors(look, pos);
  const targetDist = toTarget.length();
  if (targetDist < 1e-6) return; // degenerate look handled by the numeric camAt audit
  const dir = toTarget.clone().normalize();
  const ray = new THREE.Ray(pos.clone(), dir);
  const hit = new THREE.Vector3();
  for (const { id, box } of registry) {
    if (box.clone().expandByScalar(MARGIN).containsPoint(pos)) {
      throw new Error(
        `Clearance: camera at [${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}] ` +
          `is inside set-piece '${id}' (margin ${MARGIN} m) — the Whale map-board case.`,
      );
    }
    // The look target itself sits inside its own set-piece's box (a point on the
    // temple facade face, local z 0.12, lies inside the box's z range -0.05..0.45) —
    // that box is the SUBJECT, not an occluder. Skip the occlusion test for any box
    // containing the target (with margin); a real occluder between camera and target
    // never contains the target, so it is still caught. (Fixes the f1424 false
    // positive: the wide shot's own facade was flagged as blocking itself.)
    if (box.clone().expandByScalar(MARGIN).containsPoint(look)) {
      continue;
    }
    const p = ray.intersectBox(box, hit);
    if (p !== null) {
      const d = p.distanceTo(pos);
      if (d < targetDist - MARGIN) {
        throw new Error(
          `Clearance: look-ray blocked by set-piece '${id}' at ${d.toFixed(2)} m ` +
            `(target at ${targetDist.toFixed(2)} m) — the BA5390 chair-backs case.`,
        );
      }
    }
  }
}
