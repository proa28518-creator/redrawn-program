// props/saw.js: his hacksaw as a prop = src/saw.js as it is. Its pose per frame lives in the limbs track (keys[f].saw { p, q } and
// keys[f].sawTint), so it reads the character's limbs track: params.limbsTrack (the limbs group's own, passed by char.js) or params.tracks.limbs.
// Spec: { "kind": "saw", "scale": 1.05 }   (scale = clamp-to-clamp length in head diameters, measured 1.05)
import * as Saw from '../saw.js';

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const root = await Saw.build({ ...own, ...(limbsTrack ? { track: limbsTrack } : tracks?.limbs ? { tracks: tracks.limbs } : {}) });
  root.name = 'prop.saw';
  return root;
}

export function update(frame, ctx) { Saw.update(frame, ctx); }
