// hats/_template.js: copy to hats/<kind>.js (bowler, top, peaked, ...) and pick it in a spec with "hat": { "kind": "<kind>", ... }.
// Contract (docs/API.md "Add a hat"):
//   build(params) -> Object3D (may be async). Character space: head centre at the origin, head diameter 1 (outer edge of the head's ink),
//     +Y up, +Z out of the face, +X the character's left. params = the spec's "hat" object minus "kind", plus
//     params.tracks = list of URLs of the character's cap track (tracks/<char>/cap.json; may be empty) and params.lookFrame if the spec sets one.
//     Load the track inside build() with loadTrack(params, 'cap', fallbackUrl) and keep it on root.userData: no module-level state,
//     two characters with this hat in one page must not share anything.
//   update(frame, ctx) -> nothing. frame = GLOBAL frame number. ctx: { root (your Object3D), cam {cx cy d roll az el}, camera, project(v3) -> px,
//     focal, width, height, distance, THREE }. Pose and light per frame from your track; a frame missing from it: hold the nearest key.
// Outline with shade.js outline(mesh, { width, color }); colours unlit, measured from his frames (MEASURED.md / STYLE_BIBLE.md).
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

export async function build(params = {}) {
  const { tracks, lookFrame, ...own } = params;
  const track = params.tracks?.length ? await loadTrack(params, 'cap') : null; // optional for a rigid hat
  const root = new THREE.Group(); root.name = 'hat.template';
  const pivot = new THREE.Group(); pivot.position.set(0, own.y ?? .42, 0); root.add(pivot);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.3, .32, .3, 64), new THREE.MeshBasicMaterial({ color: own.color ?? 0x2b2630 }));
  crown.position.y = .15; outline(crown, { width: .03, color: 0x2d2228 }); pivot.add(crown);
  root.userData = { pivot, track };
  return root;
}

export function update(frame, ctx) {
  const { pivot, track } = ctx.root.userData;
  const key = track?.pose?.[String(frame)]; // e.g. { rx, ry, rz, x, y, z } against the head for a lift or a tip of the hat
  if (key) { pivot.rotation.set(key.rx || 0, key.ry || 0, key.rz || 0); }
}
