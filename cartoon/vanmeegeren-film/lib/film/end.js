// lab/film/end.js (was tools/film_end.mjs, which re-exports this; isomorphic: node and the page) - FIX1 (items 4 + 5): film-wide decisions make_film takes for EVERY film, no per-film authoring.
//   lowCams(shots, characters, rests)  -> camera height floor: a shot's camera never sits below the subject's chest (legs read 1:1 with
//                                         the torso, as on the cast sheet). The SOP B8.7 low angle (camera below the eyes) is kept.
//   filmEnd(film, voice, characters, rests, handovers, authored) -> { dur, why }: the film ends `endHold` (default .5 s) after the last
//                                         word or action (pose motion, walks, clips, hand-overs), capped by the authored length.
//   closeMouths(characters, voice, dur) -> a held open mouth (o / wide / shout / grid ...) after the last word gets closed.
//   endFraming(scene, dur, fps, openStage) -> when the end frame shows no properly framed head, the last framed shot runs to the end.
import { evalPose } from '../../engine/compose.js';
import { hh } from '../../engine/clips.js';

const num = v => typeof v === 'number' && Number.isFinite(v);

/** rests of every character (one tiny stage) */
export async function restsOf(characters, openStage) {
  const st = await openStage({ width: 64, height: 64, grid: false, characters: characters.map(c => ({ name: c.name, spec: c.spec, timeline: c.timeline })),
    camera: { keys: [{ t: 0, pos: [0, 2, 10], target: [0, 2, 0], fov: 26 }] } }, {});
  const rests = {}; st.info.chars.forEach((c, i) => { rests[characters[i].name] = c.rest; });
  await st.close();
  return rests;
}

const bodyAt = (c, rest, t) => { const P = evalPose(c.timeline, t, rest); const hip = P.body.hipY ?? rest.hipY;
  const y = P.root.y || 0; return { x: P.root.x || 0, z: P.root.z || 0, hip: hip + y, head: hip + y + hh(rest) }; };

// ---- item 5: low cameras. In a 9:16 frame nearly every shot shows the legs; a camera below the subject's chest (blind3: y 1.0-1.3 under
// heads at 2.3-2.7) drew the noodle legs ~1.6x the torso (the 2.5D torso is drawn with damped elevation, the 3D legs are not). Floor =
// the subject's chest (hip + .5 x hip-to-head), never above eyes - .45 (the low-angle feel stays). Subject = `who`, else the character
// nearest the camera target on the ground at the shot middle. `lowCam: true` on a shot/camera (or film `lowCams: false`) keeps it as authored.
export function lowCams(shots, characters, rests, { log = () => {} } = {}) {
  let n = 0;
  const out = shots.map((s, i) => {
    const c = s.camera || {}; if (c.lowCam === true || s.lowCam === true || c.move === 'orbit') return s;
    const a = num(s.t0) ? s.t0 : 0, b = num(s.t1) && s.t1 < 90 ? s.t1 : (num(shots[i + 1]?.t0) ? shots[i + 1].t0 : a + 2), tm = (a + b) / 2;
    const tgt = c.target || c.to?.target || c.from?.target;
    let subj = null;
    const cand = characters.filter(ch => rests[ch.name]).map(ch => ({ ch, B: bodyAt(ch, rests[ch.name], tm) }));
    if (c.who) subj = cand.find(x => x.ch.name === c.who);
    if (!subj && Array.isArray(c.whos)) subj = cand.filter(x => c.whos.includes(x.ch.name)).sort((p, q) => p.B.head - q.B.head)[0];
    if (!subj && Array.isArray(tgt)) subj = cand.sort((p, q) => Math.hypot(p.B.x - tgt[0], p.B.z - tgt[2]) - Math.hypot(q.B.x - tgt[0], q.B.z - tgt[2]))[0];
    if (!subj) return s;
    // everyone standing within 3 D of the subject is in the shot too: the tallest chest sets the floor (a seated subject + a standing one)
    const near = Array.isArray(tgt) ? cand.filter(x => Math.hypot(x.B.x - subj.B.x, x.B.z - subj.B.z) < 3) : [subj];
    const floor = Math.min(Math.max(...near.map(x => x.B.hip + .5 * (x.B.head - x.B.hip))), subj.B.head - .3);   // never above the subject's eyes (B8.7)
    const fix = p => Array.isArray(p) && p[1] < floor - .01 ? [p[0], +floor.toFixed(3), p[2]] : p;
    let cam = c, changed = false;
    if ((c.move || 'park') === 'park' && Array.isArray(c.pos)) { const p = fix(c.pos); if (p !== c.pos) { cam = { ...c, pos: p }; changed = true; } }
    else if (c.move === 'push' && c.from?.pos && c.to?.pos) { const p0 = fix(c.from.pos), p1 = fix(c.to.pos);
      if (p0 !== c.from.pos || p1 !== c.to.pos) { cam = { ...c, from: { ...c.from, pos: p0 }, to: { ...c.to, pos: p1 } }; changed = true; } }
    else if (c.move === 'follow') { const off = c.camOffset || [0, 2, 9]; if (off[1] < floor - .01) { cam = { ...c, camOffset: [off[0], +floor.toFixed(3), off[2]] }; changed = true; } }
    if (!changed) return s;
    n++; log(`camera floor: S${i + 1} camera raised to y ${floor.toFixed(2)} (${subj.ch.name}'s chest; was ${(c.pos || c.from?.pos || c.camOffset || [])[1]})`);
    return { ...s, camera: { ...cam, _floor: +floor.toFixed(3) } };
  });
  return { shots: out, n };
}

// ---- item 4: where the film ends. Pose motion (root, body, limbs, props; NOT the face) sampled every frame: the last moving frame is the
// last action. Words: voice words / lines. Hand-overs: t + hold + back.
const sig = P => { const o = []; const walk = (x, k) => { if (k === 'face' || k === 'listenGaze' || k === 'look') return;
  if (typeof x === 'number') o.push(x); else if (Array.isArray(x)) x.forEach(v => walk(v)); else if (x && typeof x === 'object') for (const [kk, v] of Object.entries(x)) walk(v, kk); };
  walk(P); return o; };
export function lastAction(characters, rests, t1, fps = 30) {
  let last = 0, who = null;
  for (const ch of characters) { const r = rests[ch.name]; if (!r) continue;
    let prev = null;
    for (let f = 0; f <= Math.round(t1 * fps); f++) {
      const s = sig(evalPose(ch.timeline, f / fps, r));
      if (prev && s.length === prev.length) { let m = 0; for (let i = 0; i < s.length; i++) m = Math.max(m, Math.abs(s[i] - prev[i]));
        if (m > .004 && (f - 1) / fps >= last) { last = f / fps; who = ch.name; } }
      prev = s;
    }
  }
  return { t: last, who };
}

export function filmEnd(film, voice, characters, rests, handovers, fps = 30) {
  const authored = film.duration ?? ((voice.lines.length ? Math.max(...voice.lines.map(l => l.end)) : 0) + (film.tail ?? 1.6));
  const lastWord = Math.max(0, ...voice.words.map(w => w.end), ...voice.lines.map(l => l.end));
  const ho = Math.max(0, ...(handovers || []).filter(h => num(h.t)).map(h => h.t + (h.hold ?? .2) + (h.back ?? .35)));
  const act = lastAction(characters, rests, authored, fps);
  const lastAct = Math.max(lastWord, act.t, ho);
  const hold = film.endHold ?? .5;
  let dur = num(film.endHold) ? lastAct + hold : Math.min(authored, lastAct + hold);
  if (film.endHold === false) dur = authored;
  dur = Math.max(dur, lastWord + .3, 1);
  const why = `last word ${lastWord.toFixed(2)} s, last action ${act.t.toFixed(2)} s${act.who ? ` (${act.who})` : ''}${ho ? `, last hand-over ${ho.toFixed(2)} s` : ''}`;
  return { dur: +dur.toFixed(4), authored, lastWord, lastAct, why };
}

// ---- item 4: mouths closed at the end. The face's mouth from the last face key (the voice's talk ends on its own): an open one
// (OPEN below, or anything not in CLOSED) still showing .4 s before the end gets a `rest` key after the last word.
const CLOSED = new Set(['rest', 'flat', 'frown', 'smile', 'smirk', 'grin', 'pout', 'line', 'closed', 'sad', 'tight', 'wry', 'neutral', 'content', 'press']);
export function closeMouths(characters, voice, dur) {
  const done = [];
  for (const ch of characters) {
    const keys = (ch.timeline.face || []).filter(k => num(k.t) && k.mouth != null && k.t < dur).sort((a, b) => a.t - b.t);
    const k = keys[keys.length - 1]; if (!k || CLOSED.has(String(k.mouth))) continue;
    const mine = voice.words.filter(w => w.who === ch.name), lw = Math.max(0, ...voice.words.map(w => w.end));
    const t = Math.min(dur - .3, Math.max(lw + .15, k.t + .5, mine.length ? mine[mine.length - 1].end + .15 : 0));
    if (t <= k.t) continue;
    ch.timeline.face = [...(ch.timeline.face || []), { t: +t.toFixed(4), mouth: 'rest', react: false, _fix1: 'end' }];
    done.push(`${ch.name} "${k.mouth}" closed at ${t.toFixed(2)} s`);
  }
  return done;
}

// ---- item 4: the end frame must be framed. A head counts as framed when it is inside the frame with >= 150 px (short side 1080) diameter.
// When the last frame has none, the latest earlier shot whose own last frame (inside the film) is framed runs on to the end.
export async function endFraming(scene, dur, fps, openStage, { minPx = 150, minLast = 1.0, log = () => {} } = {}) {
  const shots = scene.shots || []; if (shots.length < 2) return null;
  const wide = scene.width > scene.height, fw = wide ? 192 : 108, fh = wide ? 108 : 192;   // (the film's own frame shape: a tenth of 1080x1920 or 1920x1080)
  const st = await openStage({ ...scene, width: fw, height: fh }, {});
  const framed = async t => { const r = await st.frame(t); const s = (wide ? 1920 : 1080) / 108;   // (one camera, one verdict: a head is the same share of the frame height)
    return r.views.some(v => v.d * s >= minPx && v.cx > 0 && v.cx < fw && v.cy > 0 && v.cy < fh); };
  const tEnd = Math.max(0, dur - 1 / fps);
  let res = null;
  const idx = shots.reduce((k, s, i) => (tEnd >= (s.t0 ?? 0) ? i : k), 0);
  try {
    // a cut in the last `minLast` s (the film was shortened to the last action: coffee_break cut to a new wide 0.5 s before the end)
    // is a flash, not a shot: the shot before runs on to the end when its own last frame is framed
    const short = idx > 0 && dur - (shots[idx].t0 ?? 0) < minLast;
    if (short) { const a = shots[idx - 1].t0 ?? 0, b = Math.min(shots[idx].t0, dur);
      if (await framed(Math.max(a, b - 1 / fps))) res = { keep: idx - 1, from: idx, why: `the last shot S${idx + 1} would last only ${(dur - shots[idx].t0).toFixed(2)} s` }; }
    if (!res && await framed(tEnd)) return null;
    if (!res) for (let i = idx - 1; i >= 0; i--) {
      const a = shots[i].t0 ?? 0, b = Math.min(shots[i + 1].t0, dur);
      if (await framed(Math.max(a, b - 1 / fps))) { res = { keep: i, from: idx, why: `the last frame shows no head of ${minPx}+ px (shot S${idx + 1})` }; break; }
    }
  } finally { await st.close(); }
  if (!res) return null;
  log(`END: ${res.why}: shot S${res.keep + 1} runs to the end`);
  return res;
}
