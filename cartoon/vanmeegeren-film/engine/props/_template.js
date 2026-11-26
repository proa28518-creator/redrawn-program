// props/_template.js: copy to props/<kind>.js and list it in a spec: "props": [{ "kind": "<kind>", ... }].
// Contract (docs/API.md "Add a prop"):
//   build(params) -> Object3D (may be async), in character space (head centre origin, head diameter 1, +Y up, +Z out of the face,
//     +X the character's left). params = the spec entry minus "kind", plus
//       params.tracks      { head, face, cap, torso, limbs, props: [urls] } every track URL list of this character
//       params.limbsTrack  the character's loaded limbs track (hand positions: keys[f].hands.near / .far, character space)
//     Keep everything on root.userData; no module-level state (two characters may hold this prop in one page).
//   update(frame, ctx): frame = GLOBAL frame. ctx as for every part (root = your Object3D, cam, camera, project, focal, width, height).
// A prop held in a hand: read its pose per frame from your own track (e.g. tracks/<char>/props.json { "<kind>": { "<frame>": { p, q } } })
// or put it on the hand from limbsTrack.keys[f].hands.near. The saw keeps its pose inside the limbs track (keys[f].saw) for history.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const own_track = tracks?.props?.length ? (await loadTrack({ tracks: tracks.props }, 'props'))[kind] || null : null;
  const root = new THREE.Group(); root.name = 'prop.template';
  const box = new THREE.Mesh(new THREE.BoxGeometry(own.w ?? .1, own.h ?? .3, own.d ?? .1), new THREE.MeshBasicMaterial({ color: own.color ?? 0xbc481b }));
  outline(box, { width: .025, color: 0x2d2228 }); root.add(box);
  root.userData = { track: own_track, limbsTrack, kind };
  return root;
}

export function update(frame, ctx) {
  const { track, limbsTrack } = ctx.root.userData;
  const key = track?.[String(frame)];
  if (key) { ctx.root.position.set(...key.p); if (key.q) ctx.root.quaternion.set(...key.q); return; }
  const hand = limbsTrack?.keys?.[String(frame)]?.hands?.near; // fallback: sit on the near hand
  ctx.root.visible = !!hand;
  if (hand) ctx.root.position.set(hand[0], hand[1], hand[2]);
}
