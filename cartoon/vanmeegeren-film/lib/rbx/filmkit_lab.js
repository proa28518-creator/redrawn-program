// V3 film kit (WP-T, 2026-11-12): turns a Roblox V3 film's tables (places, cast, lines, beats, booms) into the charsys film object
// tools/make_film.mjs reads. Imported by charsys/films/rbx_<name>/film.mjs; nothing in charsys imports it.
//
// Tables (all coordinates in charsys D, film clock = the original audio's clock):
//   PLACES  { id: { origin: [x, 0, z], floor: '#hex', wall: '#hex', v1: 'bedroom', back: zBack } }   previz boxes until the kit sets land
//   CAST    { id: { spec, at: [x, z], ry, y?, heights?: [...], moves?: [...], place? } }   spec = a stand-in charsys spec until WP-C2's rbx specs
//   LINES   [{ who, text }]   the original audio's words split into sentences (who null = narrator)
//   BEATS   [{ n, t0, t1, place, who, from: { pos, target, fov }, to: { pos, target, fov }, boom, word, note }]   one row per V1 shot
//   BOOMS   [{ t, note }]   vine booms (read by v3/tools/booms.mjs, not by make_film)
//   CAPTIONS { max, strip, emph, y, upper }   V1's caption chunking options (read by v3/tools/captions.mjs)
// Acting (clips, faces, looks) goes in ACTS = { id: { clips, face, look, ... } } (MOTION_API); merged over what the kit derives.

const r3 = v => +(+v).toFixed(3);

/** a push that always moves: `to` given = V1's own move, else 4 % of the distance toward the target */
export function camOf(b) {
  const from = { pos: b.from.pos.map(r3), target: b.from.target.map(r3), fov: b.from.fov };
  let to = b.to;
  if (!to) { const k = b.push ?? .04; to = { pos: from.pos.map((p, i) => r3(p + (from.target[i] - p) * k)), target: from.target, fov: from.fov }; }
  return { move: 'push', from, to: { pos: to.pos.map(r3), target: to.target.map(r3), fov: to.fov ?? from.fov }, t0: b.t0, t1: b.t1 };
}

/** previz: a floor stripe + a back wall + two side markers per place (replaced by the kit sets in pass B) */
export function previzSet(places) {
  const boxes = [], stripes = [];
  for (const [id, p] of Object.entries(places)) {
    const [ox, , oz] = p.origin;
    stripes.push({ at: [ox, oz], size: [40, 40], color: p.floor || '#d9cbb0' });
    const zb = p.back ?? oz - 8;
    boxes.push({ size: [30, 6, .6], at: [ox, 0, zb], color: p.wall || '#e8e2d4' });
    boxes.push({ size: [1.2, 2.2, 1.2], at: [ox - 6, 0, zb + 2], color: '#7f93b8' });
    boxes.push({ size: [1.6, 1.2, 1.6], at: [ox + 6, 0, zb + 2.5], color: '#c48b6a' });
  }
  return { boxes, stripes };
}

// voice / post (2026-11-14, the app port, additive: not given = exactly as before): the voice files (the app: audio/clean.wav +
// audio/clean.json) and the export's post (film.rbx.post: sub-frame motion blur + grade, read by the app's host chost.js)
export function build({ name, duration, places, cast, lines, beats, acts = {}, booms = [], captions = {}, sky = '#bfdcf2', ground = '#cfc6b4', voice = null, post = null }) {
  const fcast = {}, facts = {};
  for (const [id, c] of Object.entries(cast)) {
    fcast[id] = { spec: c.spec, at: c.at, ry: c.ry ?? 0, ...(c.y ? { y: c.y } : {}) };
    const a = {};
    if (c.heights?.length) a.height = c.heights;
    if (c.places?.length) a.place = c.places;
    if (c.walks?.length) a.walk = c.walks;
    facts[id] = { ...a, ...(acts[id] || {}) };
  }
  const shots = beats.map((b, i) => ({ t0: i === 0 ? 0 : b.t0, t1: i === beats.length - 1 ? 999 : b.t1, camera: camOf(b) }));
  return {
    _doc: `Roblox V3 ${name}: scaffold from V1's shots (v3/tools/scaffold.mjs). Original audio, V1 cut times, previz boxes, stand-in cast.`,
    fps: 30, size: [1080, 1920], duration, drift: false, endHold: false,
    world: { sky, ground, set: previzSet(places) },
    cast: fcast,
    voice: { file: voice?.file ?? 'voice/vo.wav', words: voice?.words ?? 'voice/words.json', lines },
    acts: facts,
    shots,
    captions: false,
    rbx: { name, booms, captions, beats: beats.map(b => ({ n: b.n, t0: b.t0, t1: b.t1, place: b.place, who: b.who, boom: !!b.boom, word: b.word, note: b.note })), ...(post ? { post } : {}) },
  };
}
