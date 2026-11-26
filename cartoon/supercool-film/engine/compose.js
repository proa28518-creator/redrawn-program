// engine/compose.js - evalPose(timeline, t, rest) -> a full CONTRACT Pose. Pure in t (compiled once per timeline, cached).
// Layer order: rest defaults -> base keys -> face (expressions, blinks, talking) -> walk ROOT -> clips (in t0 order; override or
// additive '+', in/out blend, weight, mask; '@' = value underneath at the clip's start; holds after dur) -> walk legs + bob
// (while walking) -> default planted feet -> plants -> look (look.at travels to each new target in 5 f fastIn; rig.js turns the head).
//
// Timeline (all times in seconds; frames via F(n) = n / 30):
// { root: { x, z, ry }, base: { 'body.lean': 5 | [[t, v, ease?], ...] }, clips: [{ name, t0, params, in, out, weight, mask, add }],
//   walk: [{ t0, path: [[x, z], ...], step, stride, face }], face: [{ t, eyes, brow, mouth }], say: [{ t0, words: [{ word, start, end }] }],
//   blink: { seed, every } | false, look: [{ t, at: [x, y, z] | fn(t) | null }], plants: [{ leg: 'R', t0, t1, at: [x, 0, z] }], until,
//   height: [{ t, y, over, legs } | { t, fall, up, to }], place: [{ t, at, ry, y }], root.y, path heights: engine/height.js + MOTION_API "Height and place" }
import { F, fastIn, clamp, lerp } from './ease.js';
import { K, mix, add as addV, blend } from './track.js';
import { CLIPS, hh, REACT, REACT_OF, sitBackDist, seatHem } from './clips.js';
import { walk as makeWalk, footUnder } from './walk.js';
import { faceTracks } from './facetime.js';
import * as HT from './height.js';   // height + place keys (root.y, tl.height, tl.place, path heights): runs only for a timeline that uses them (c.air)

const clone = v => Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v;
const snapT = x => { const f = x * 30, r = Math.round(f); return Math.abs(f - r) < 1e-6 ? r / 30 : x; };

export function restPose(rest, root = { x: 0, z: 0, ry: 0 }) {
  const hang = side => { const o = side === 'L' ? rest.shoulderL : rest.shoulderR; return [o[0] * 1.15, o[1] - rest.armLen * .737, .03]; };   // = rig.js restPose
  return {
    root: { x: root.x ?? 0, z: root.z ?? 0, ry: root.ry ?? 0, ...(root.y != null ? { y: root.y } : {}) },
    body: { hipY: rest.hipY, lean: 0, bend: 0, twist: 0, squash: 1, kneel: 0, sit: 0 },
    head: { yaw: 0, pitch: 0, roll: 0 },
    face: { eyes: 'open', brow: 'on', mouth: 'rest', flip: 'auto', on: 'auto' }, // Q: 'auto' = rules.js turns the face off past offAz
    hat: { on: true, lift: [0, 0, 0], tilt: 0, spin: 0 },
    armR: { hand: hang('R'), in: 'body', bend: [-.45, 0, -1], vis: true, grip: null, temple: 0, clear: 0 },
    armL: { hand: hang('L'), in: 'body', bend: [.45, 0, -1], vis: true, grip: null, temple: 0, clear: 0 },
    legR: { foot: null, in: 'world', bend: [0, 0, 1], toe: 0, vis: true, tone: 'ink' },
    legL: { foot: null, in: 'world', bend: [0, 0, 1], toe: 0, vis: true, tone: 'ink' },
    look: { at: null },
    props: {},
  };
}

export function getPath(o, path) { for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; } return o; }
export function setPath(o, path, v) {
  const ks = path.split('.'); let p = o;
  for (let i = 0; i < ks.length - 1; i++) { if (p[ks[i]] == null || typeof p[ks[i]] !== 'object') p[ks[i]] = {}; p = p[ks[i]]; }
  const last = ks[ks.length - 1];
  if (v && typeof v === 'object' && !Array.isArray(v) && p[last] && typeof p[last] === 'object' && !Array.isArray(p[last])) p[last] = { ...p[last], ...clone(v) };
  else p[last] = clone(v);
}

const cache = new WeakMap();
const LEGROOT = /^(root|legR|legL)\./;
const SEAT = new Set(['sit', 'sit_down', 'kneel', 'sit_back']);
const KEEP = new Set(['carry', 'akimbo']);   // ENG7: lasting arm states a later arm clip does not end (they come back after it)
/** the last timeline face key for a channel at or before t (-Infinity = none) */
const lastFaceKey = (c, k, t) => { let r = -Infinity; for (const x of c.faceKeys[k] || []) { if (x <= t + 1e-9) r = x; else break; } return r; };

// MO2 (FABLE_REVIEW2 item 4): a face key of a strong expression also moves the BODY (his f420-431: eyes snap, head leads +1, body
// leans ~18 deg over 6 f, settles, holds dead still). `react: 'recoil'|'lean_in'|'slump'|'jolt'` (or { kind, deg, hold, back }) picks it,
// `react: false` drops it; unset = the default of the key's eyes (wide recoil, wince jolt, angry lean_in, sad slump) or mouth (o / wide
// recoil, grid jolt), only when that expression is NEW (the previous key had other eyes / mouth). Skipped when an authored body reaction
// clip (shock_pop, shock_jump, wince, lean_*, brace, react) starts within 3 f of the key. The body holds until the next key that changes
// the eyes (max 60 f, else 40 f), then goes home in 10 f.
// a clip entry's start: `t0` (seconds), else a numeric `at` (seconds, MO2: make_film only resolves 'line:' strings into t0, a plain
// number used to be dropped and the clip started already finished on frame 0). Anything else in `at` without a t0 warns loudly once.
const warned = new Set();
function clipT0(s) {
  if (!s || s.t0 != null) return s;
  if (typeof s.at === 'number' && Number.isFinite(s.at)) return { ...s, t0: s.at };
  if (s.at !== undefined) { const k = `${s.name}:${JSON.stringify(s.at)}`;
    if (!warned.has(k)) { warned.add(k); console.warn(`COMPOSE WARNING: clip "${s.name}" has at=${JSON.stringify(s.at)} that is not a time (seconds or 'line:N...'): it starts at 0`); } }
  return s;
}
const BODY_REACT = new Set(['shock_pop', 'shock_jump', 'wince', 'lean_over', 'lean_back', 'brace', 'react', 'stand_up', 'sit_down']);
function reactClips(tl) {
  const keys = (tl.face || []).filter(e => typeof e.t === 'number').map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map(x => x.e);
  const out = []; let eyes = 'open', mouth = 'rest';
  for (let j = 0; j < keys.length; j++) {
    const e = keys[j], pe = eyes, pm = mouth;
    if (e.eyes != null) eyes = e.eyes; if (e.mouth != null) mouth = e.mouth;
    if (e.react === false) continue;
    if (e.t <= 1e-9 && !e.react) continue;                        // the film's opening expression is a state, not an event
    let kind = typeof e.react === 'string' ? e.react : e.react && typeof e.react === 'object' ? e.react.kind : null;
    if (!kind) kind = (e.eyes != null && e.eyes !== pe && REACT_OF.eyes[e.eyes]) || (e.mouth != null && e.mouth !== pm && REACT_OF.mouth[e.mouth]) || null;
    if (!kind || !REACT[kind]) continue;
    if (!e.react && (tl.clips || []).map(clipT0).some(s => BODY_REACT.has(s.name) && Math.abs((s.t0 || 0) - e.t) <= F(3) + 1e-9)) continue;
    const nx = keys.slice(j + 1).find(k => k.eyes != null && k.eyes !== eyes);
    const hold = nx ? Math.max(4, Math.min(60, Math.round((nx.t - e.t) * 30) - 9)) : 40;
    out.push({ name: 'react', t0: e.t, params: { kind, hold, ...(e.react && typeof e.react === 'object' ? e.react : {}) }, _auto: true });
  }
  return out;
}

export function compile(tl, rest) {
  let byRest = cache.get(tl); if (!byRest) { byRest = new WeakMap(); cache.set(tl, byRest); }
  let c = byRest.get(rest); if (c) return c;
  c = { tl, rest };
  c.base = Object.entries(tl.base || {}).map(([p, v]) => [p, Array.isArray(v) && Array.isArray(v[0]) ? K(v) : K([[0, v]])]);
  const mk = (s, i) => {
    const fn = typeof s.name === 'function' ? s.name : CLIPS[s.name];
    if (!fn) throw new Error(`unknown clip ${s.name}`);
    const clip = fn(rest, s.params || {});
    const rel = new Set(clip.release || []);
    const ch = Object.entries(clip.ch).map(([p, tr]) => { const add = p.endsWith('+') || !!s.add; const path = p.replace(/\+$/, '');
      return { path, tr, add, release: rel.has(path) || (path.startsWith('face.') && path !== 'face.flip') }; })
      .filter(x => !s.mask || s.mask.includes(x.path.split('.')[0]));
    // Q3: `face: false` on the clip entry drops every face channel the clip has (the timeline's face keys / talking show through)
    const ch2 = s.face === false ? ch.filter(x => !x.path.startsWith('face.')) : ch;
    return { i, spec: s, t0: s.t0 || 0, dur: clip.dur, ch: ch2, events: clip.events || [], from: null, settle: tl.settle === true && (s.t0 || 0) <= 0 && s.settled !== false,
      keepRoot: s.name === 'sit_back' };
  };
  const byT = (a, b) => a.t0 - b.t0 || a.i - b.i;
  c.clips = [...(tl.clips || []).map(clipT0), ...reactClips(tl)].map(mk).sort(byT);
  c.walkStarts = (tl.walk || []).map(w => w.t0 || 0).sort((a, b) => a - b);
  // Q3 fix 3: the timeline's own face keys (tl.face, expressions) per channel, so a key AFTER a clip's start wins over that clip
  c.faceKeys = {};
  for (const k of ['eyes', 'brow', 'mouth']) c.faceKeys[k] = (tl.face || []).filter(e => e[k] != null && typeof e.t === 'number').map(e => e.t).sort((a, b) => a - b);
  // ENG8: face key `glasses: 'on'|'lowered'|'off'|'hand:R'|'hand:L'` snaps the glasses channel (under the clips: a glasses clip wins)
  const gk = (tl.face || []).filter(e => e.glasses != null && typeof e.t === 'number').sort((a, b) => a.t - b.t);
  c.glassesKeys = gk.length ? gk.map(e => [e.t, e.glasses]) : null;
  // walks, in order; each starts where the root is at its t0 (the path's first point is prepended if it isn't there). FX1: `sit_on`
  // entries are expanded in the same time order (walk to just in front of the seat, a turn on the camera side, sit back: sitOn below)
  c.walks = [];
  // height + place (engine/height.js): their keys join the walks in time order (at the same time: place, height, then walk)
  c.air = HT.uses(tl); if (c.air) HT.init(c);
  // a walk / seat / reach that starts exactly on a place key starts from the NEW place (older timelines: just before t0, as ever)
  const hereT = t0 => c.air && c.placeTs.some(p => Math.abs(p - t0) < 1e-9) ? t0 : t0 - 1e-6;
  c.hereT = hereT;
  const sits = (Array.isArray(tl.sit_on) ? tl.sit_on : tl.sit_on ? [tl.sit_on] : []).map(x => x.sit_on ?? x);
  const steps = [...(tl.walk || []).map(w => ({ t0: w.t0 || 0, w })), ...sits.map(s => ({ t0: s.t0 || 0, s })), ...(c.air ? HT.steps(tl) : [])].sort((a, b) => a.t0 - b.t0 || (a.o || 0) - (b.o || 0));
  // fix1 (Fable R1): a stand_up from a seat steps forward off it along the facing it has at its start (clips.js stand_up ry + fwd);
  // done in time order with the walks, so a walk after it starts from where he stands. `params.fwd: 0` = stand up in place (old).
  const standFwd = tLim => { for (const cl of c.clips) {
    if (cl._fwd || cl.spec.name !== 'stand_up' || (cl.spec.params?.from ?? 'kneel') !== 'sit' || cl.t0 >= tLim) continue;
    cl._fwd = true; const p = cl.spec.params || {}; if (p.fwd === 0) continue;
    const seatCl = c.clips.filter(o => SEAT.has(o.spec.name) && o.spec.name !== 'kneel' && o.t0 <= cl.t0).pop();
    const seat = typeof seatCl?.spec.params?.seat === 'number' ? seatCl.spec.params.seat : undefined;
    const re = mk({ ...cl.spec, params: { ...p, ry: rootAt(c, cl.t0 - 1e-6).ry, fwd: p.fwd ?? sitBackDist(rest, seat) } }, cl.i);
    cl.ch = re.ch; cl.dur = re.dur; cl.events = re.events; } };
  for (const st of steps) {
    standFwd(st.t0);
    if (st.place) { HT.addPlace(c, st.place, x => rootAt(c, x)); continue; }
    if (st.h) { HT.addHeight(c, st.h, st.first, x => rootAt(c, x)); continue; }
    if (st.s) { sitOn(c, st.s, mk, byT); continue; }
    const w = st.w, t0 = st.t0, here = rootAt(c, hereT(t0));
    const pts = w.path.map(p => [p[0], p[1]]);
    const moved = Math.hypot(pts[0][0] - here.x, pts[0][1] - here.z) > .01;
    if (moved) pts.unshift([here.x, here.z]);
    // path points with a third number = the height of the ground there: footholds land on it, the body rises with it
    const hasY = c.air && HT.pathHasY(w.path), ground = hasY ? HT.groundOf(moved ? [[here.x, here.z, here.y ?? 0], ...w.path] : w.path, here.y ?? 0) : null;
    const wk = makeWalk(pts, rest, { ...w, ryStart: here.ry, ...(ground ? { ground } : {}) });
    c.walks.push({ t0, w: wk, ry0: here.ry, spec: w });
    if (ground) HT.addWalkGround(c, c.walks[c.walks.length - 1]);
  }
  standFwd(Infinity);
  c.walkStarts.sort((a, b) => a - b);
  // ENG7: pick_up / put_down get the root at their start (`_root`): the auto bend that brings the shoulder within reach of the world
  // spot, and the prop's yaw on the spot vs in the hand (no turn pop at contact)
  for (const cl of c.clips) {
    if (cl.spec.name !== 'pick_up' && cl.spec.name !== 'put_down') continue;
    // ENG10 (blind6 stuck point 4): a seated / kneeling character reaches from his SEATED hips (`_root.hipY`), not the standing ones
    const r0 = rootAt(c, hereT(cl.t0)), hy = seatedHipAt(c, cl.t0), re = mk({ ...cl.spec, params: { ...(cl.spec.params || {}), _root: { x: r0.x, z: r0.z, ry: r0.ry, ...(r0.y ? { y: r0.y } : {}), ...(hy != null ? { hipY: hy } : {}) } } }, cl.i);
    cl.ch = re.ch; cl.dur = re.dur; cl.events = re.events;
  }
  // ENG7 (blind4 stuck point 2): an OPEN-ENDED clip (no `out`) holding an arm ENDS on that arm when a later clip moves the same arm's hand
  // (writes armX.hand / armX.reach, not additive): from the later clip's start + its `in` blend, the earlier clip's armX.* channels stop
  // writing, so when the later clip finishes (its `out`) the arm goes back to what is underneath (rest / base), not to the old held
  // pose (a held point came back after a hand-over; a first raise_prop came back after a second one). Seats (sit / kneel / sit_back)
  // are not ended this way (stand_up ends them), nor lasting states (carry, akimbo: 'hold through everything'; clip entry `keep: true|false`
  // overrides for any clip). Timeline `armHoldEnd: false` = the old behaviour (comparison only).
  if (tl.armHoldEnd !== false) for (const cl of c.clips) {
    if (typeof cl.spec.out === 'number' || SEAT.has(cl.spec.name) || cl.spec._auto || (cl.spec.keep ?? KEEP.has(cl.spec.name))) continue;
    for (const g of ['armR', 'armL']) {
      if (!cl.ch.some(x => !x.add && x.path.startsWith(g + '.'))) continue;
      const nx = c.clips.find(o => o !== cl && (o.t0 > cl.t0 + 1e-9 || (Math.abs(o.t0 - cl.t0) <= 1e-9 && o.i > cl.i)) && !o.spec._auto
        && o.ch.some(x => !x.add && (x.path === g + '.hand' || x.path === g + '.reach')));
      if (nx) (cl.armEnd ||= {})[g] = nx.t0 + F(nx.spec.in || 0);
    }
  }
  // ENG8 (blind5 stuck point 2): `armEnds: [{ side: 'R', t, out: frames }]` (make_film writes one per hand-over for the giver's and
  // the taker's handing arm, at t + hold, out = the hand-over's `back`): every clip that started BEFORE `t` and still writes that arm
  // (an open-ended point / offer / reach, a carry of the prop that left, or a clip whose own hold + out lasts past it) fades its armX.*
  // channels out over `out` frames from `t`, so after the hand-over the arm comes down to what is underneath instead of going back to
  // the held offer. Seats and `keep: true` clips are left alone; clips that start at or after `t` (the taker's carry of the new prop)
  // are not touched. Timeline `armHoldEnd: false` switches it off with the ENG7 rule.
  if (tl.armHoldEnd !== false) for (const e of tl.armEnds || []) {
    const g = 'arm' + (e.side === 'L' ? 'L' : 'R'), te = e.t ?? 0, nOut = e.out ?? 10, since = e.since ?? te;
    for (const cl of c.clips) {
      if (cl.t0 >= since - 1e-9 || SEAT.has(cl.spec.name) || cl.spec._auto || cl.spec.keep === true) continue;
      if (!cl.ch.some(x => !x.add && x.path.startsWith(g + '.'))) continue;
      const cur = cl.armFade?.[g]; if (!cur || cur.t > te) (cl.armFade ||= {})[g] = { t: te, out: nOut };
    }
  }
  // Q3 fix 1: a seat (sit / sit_down / kneel holds forever) ENDS when a later stand_up has finished (its released legs then fall back to
  // standing feet, not to the seated ones) or when a later walk starts. Before that the seat stays underneath (stand_up blends from it).
  for (const cl of c.clips) {
    if (!SEAT.has(cl.spec.name)) continue;
    let end = Infinity;
    for (const o of c.clips) if (o !== cl && o.spec.name === 'stand_up' && (o.t0 > cl.t0 || (o.t0 === cl.t0 && o.i > cl.i))) { end = o.t0 + o.dur; break; }
    for (const w of c.walkStarts) if (w > cl.t0) { end = Math.min(end, w); break; }
    cl.endAt = end;
  }
  const until = tl.until ?? Math.max(10, ...c.clips.map(x => x.t0 + x.dur + (x.spec.hold || 0) + 2), ...c.walks.filter(x => x.w).map(x => x.t0 + x.w.dur + 2));
  // law 10: clips that snap the eyes (wave, lean_over, shock_pop...) also get a blink right before, like expression changes
  const clipChanges = c.clips.flatMap(cl => cl.ch.filter(x => x.path === 'face.eyes').flatMap(x => (x.tr.keys || [])
    .filter(k => k[1] !== '@' && k[1] !== 'blink').map(k => cl.t0 + k[0]))).filter(t => t > 0);
  const blinkOpts = tl.blink === false ? false : { ...(tl.blink || {}), changes: [...((tl.blink && tl.blink.changes) || []), ...clipChanges] };
  c.face = faceTracks({ expr: tl.face || [], say: tl.say || [], blink: blinkOpts, until, listen: tl.listen }); // listen: others' line spans (make_film fills it)
  // look keys: tl.look + look_at clips
  c.look = [...(tl.look || []), ...c.clips.filter(x => x.spec.name === 'look_at').map(x => ({ t: x.t0, at: x.spec.params?.at ?? null }))].sort((a, b) => a.t - b.t);
  if (c.air) c.look = HT.placeLooks(c, c.look, x => rootAt(c, x));
  byRest.set(rest, c);
  return c;
}

/** The root from walks only (+ the timeline's start root), then clip root channels (turns). */
function walkRoot(c, t) {
  let r = { ...(c.tl.root || { x: 0, z: 0, ry: 0 }) }; r.x ??= 0; r.z ??= 0; r.ry ??= 0;
  let active = null;
  for (const wk of c.walks) {
    if (t < wk.t0) break;
    if (wk.place) { r = { ...wk.end }; active = null; continue; }                                            // a place key: a snap, nothing slides
    if (wk.flight) { const f = wk.flight, u = clamp((t - wk.t0) / ((f.t1 - wk.t0) || 1e-9)); r = { x: lerp(f.x0, f.x1, u), z: lerp(f.z0, f.z1, u), ry: f.ry }; active = null; continue; }   // a jump with `to`
    const lt = snapT(t - wk.t0);
    if (lt < wk.w.dur) { const a = wk.w.at(lt); r = { ...a.root }; active = { wk, a, lt };
      // first 10 f (body speed): blend the heading from where he faced (turn into the walk)
      const k = fastIn(clamp(lt / F(10))); const d = ((r.ry - wk.ry0) % 360 + 540) % 360 - 180; r.ry = r.ry - d + d * k;
    } else r = { ...wk.w.end };
  }
  if (c.air) r.y = HT.yAt(c, t).y;
  return { r, active };
}
const lastWalkStart = (c, t) => { let s = -Infinity; for (const w of c.walkStarts) if (w <= t) s = w; return s; };

function rootAt(c, t) {
  const { r } = walkRoot(c, t), pose = { root: r }, lw = lastWalkStart(c, t);
  for (const cl of c.clips) applyClip(c, cl, t, pose, lw, /*rootOnly*/ true);
  return pose.root;
}

// FX1 sit_on: { seat: [x, z] (the hip point on the seat; make_film turns a set mark name into it), t0, face: deg (the seated facing,
// default 0 = +Z), seatY: seat height (default .55 = the park bench), from: 'walk' (default) | 'here' (already in front of it), path:
// [[x, z], ...] via points before the front point, speed / gait / step (the walk's), cam: [x, z] the shot camera's ground position
// (make_film fills it from the shot that covers the turn) }. Expands to: a walk to the point `back` D in front of the seat (back = how far
// seated feet sit in front of the hips) -> a turn in place to `face` that swings through the CAMERA side (the shorter of the two ways
// that keep the face to the camera longest; no camera = the shortest turn) -> sit_back 2 f later: the hips go back onto the seat while
// the feet stay planted where he stood. The expansion is recorded in c.sitOns (tests).
const angd = (a, b) => ((a - b) % 360 + 540) % 360 - 180;
// ENG10: the hem height of the seat a character is on at t (sit / sit_down / sit_back / kneel that started before t and was not ended by a
// stand_up that finished or a walk that started before t), or null when standing. Used by pick_up / put_down's reach (bend + warning).
function seatedHipAt(c, t) {
  let hy = null;
  for (const cl of c.clips) {
    if (!SEAT.has(cl.spec.name) || cl.t0 > t + 1e-9) continue;
    let end = Infinity;
    for (const o of c.clips) if (o !== cl && o.spec.name === 'stand_up' && (o.t0 > cl.t0 || (o.t0 === cl.t0 && o.i > cl.i))) { end = o.t0 + o.dur; break; }
    for (const w of c.walkStarts) if (w > cl.t0) { end = Math.min(end, w); break; }
    if (t >= end - 1e-9) continue;
    const p = cl.spec.params || {};
    hy = cl.spec.name === 'kneel' ? c.rest.legLen * .5 : seatHem(c.rest, typeof p.seat === 'number' ? p.seat : c.rest.legLen * .42);   // = clips.js kneelH / seatHem(seatH)
  }
  return hy;
}
function sitOn(c, s, mk, byT) {
  const rest = c.rest;
  if (!Array.isArray(s.seat) || s.seat.length < 2 || !s.seat.every(Number.isFinite))
    throw new Error(`sit_on: seat must be [x, z] (a set mark name is resolved by make_film), got ${JSON.stringify(s.seat)}`);
  const t0 = s.t0 || 0, face = s.face ?? 0, seatY = s.seatY ?? .55, d = sitBackDist(rest, seatY);
  const a = face * D2R, front = [s.seat[0] + Math.sin(a) * d, s.seat[1] + Math.cos(a) * d];
  const here = rootAt(c, c.hereT(t0));
  let tw = t0, ryEnd = here.ry, walked = false;
  if ((s.from ?? 'walk') === 'walk' && Math.hypot(front[0] - here.x, front[1] - here.z) > .05) {
    const pts = [[here.x, here.z], ...(s.path || []).map(p => [p[0], p[1]]), front];
    const wk = makeWalk(pts, rest, { speed: s.speed, gait: s.gait, step: s.step, ryStart: here.ry });
    c.walks.push({ t0, w: wk, ry0: here.ry, spec: { t0, path: pts, sitOn: true } }); c.walkStarts.push(t0);
    tw = t0 + wk.dur; ryEnd = wk.end.ry; walked = true;
  }
  const delta = angd(face, ryEnd);
  let by = 0, frames = 0;
  if (Math.abs(delta) > 6) {
    const cands = [delta]; if (Math.abs(delta) > 45) cands.push(delta - 360 * Math.sign(delta));
    // cam: [x, z], or make_film's per-shot list [{ t0, t1, at: [x, z] }] (the shot that covers the turn decides)
    const camOf = x => Array.isArray(x) && typeof x[0] === 'number' ? x : Array.isArray(x) ? (x.find(k => k && k.at && tw >= k.t0 - 1e-6 && tw < k.t1)?.at ?? null) : null;
    const cam = camOf(s.cam), camAz = cam ? Math.atan2(cam[0] - front[0], cam[1] - front[1]) / D2R : null;
    const backView = b => { if (camAz == null) return 0; let n = 0; for (let u = 0; u <= 1.0001; u += .05) if (Math.abs(angd(ryEnd + b * u, camAz)) > 100) n++; return n; };
    by = cands.map(b => ({ b, k: backView(b) * 1000 + Math.abs(b) })).sort((x, y) => x.k - y.k)[0].b;
    frames = Math.round(clamp(10 + (Math.abs(by) - 90) / 90 * 4, 8, 16));
  }
  const tTurn = tw, tSit = tw + (frames ? F(frames) + F(2) : F(2));
  if (frames) { c.clips.push(mk({ name: 'turn', t0: tTurn, params: { by, frames }, _sitOn: true }, 10000 + c.clips.length)); c.clips.sort(byT); }
  // ENG10 (blind6 stuck point 2): the hips land ON the seat point in every mode. The root where the sit starts (after the walk + turn) is
  // usually the front point (then the move is exactly `back` D against the facing, as before); with from: 'here' (or a walk that ended a
  // touch off) the root slides from where he is to the seat instead (`shift`), the feet still end `back` D in front of the hips.
  const rs = rootAt(c, tSit - 1e-6), sx = s.seat[0] - rs.x, sz = s.seat[1] - rs.z;
  const bx0 = -Math.sin(a) * d, bz0 = -Math.cos(a) * d, exact = Math.hypot(sx - bx0, sz - bz0) < 1e-4;
  c.clips.push(mk({ name: 'sit_back', t0: tSit, params: { seat: seatY, ry: face, back: d, ...(exact ? {} : { shift: [sx, sz] }) }, _sitOn: true }, 10000 + c.clips.length));
  c.clips.sort(byT);
  (c.sitOns ||= []).push({ seat: s.seat, front, walked, walkEnd: tw, ryEnd, by, frames, tSit, seated: tSit + F(16), back: d, start: [rs.x, rs.z], shift: [sx, sz] });
}

function applyClip(c, cl, t, pose, lastWalk, rootOnly = false) {
  if (t < cl.t0) return;
  const seatOver = cl.endAt !== undefined && t >= cl.endAt - 1e-9;   // a seat ended by a later stand_up / walk (fix 1)
  if (seatOver && !cl.keepRoot) return;                             // FX1: sit_back's root move stays (he is where the seat is)
  // a clip at t0 <= 0 (the film's first frame) starts SETTLED: its move is already done on frame 0 (a boss already seated, mugs already
  // carried), holds/out still count from the clip's t0. Only when the timeline says `settle: true` (make_film sets it for every film);
  // `settled: false` on a clip plays its move from frame 0 instead.
  const lt0 = snapT(t - cl.t0), s = cl.spec;
  const lt = cl.settle ? Math.max(lt0, cl.dur + 1e-4) : lt0; // +1e-4: a 0-length snap clip (sit) reads its end key
  // hold (seconds, M2): the end pose (face snaps and released channels included) stays dead still that long before `out` blends back
  const hEnd = cl.dur + Math.max(0, s.hold || 0), ended = lt > hEnd + 1e-9;
  const wIn = s.in ? fastIn(clamp(lt / F(s.in))) : 1;
  const wOut = typeof s.out === 'number' && ended ? 1 - fastIn(clamp((lt - hEnd) / (F(s.out) || 1e-9))) : 1;
  const w = wIn * wOut * (s.weight ?? 1);
  if (w <= 0) return;
  for (const x of cl.ch) {
    const isRoot = x.path.startsWith('root.');
    if (rootOnly && !isRoot) continue;
    if (ended && x.release) continue;
    if (seatOver && !isRoot) continue;
    if (cl.armEnd && (x.path.startsWith('armR.') || x.path.startsWith('armL.')) && t > (cl.armEnd[x.path.slice(0, 4)] ?? Infinity) + 1e-9) continue;   // ENG7 (at the later clip's t0 still on: its '@')
    // ENG8: a hand-over ends this arm's hold: fade over `out` frames from the end time (fastIn, like `out`)
    let wx = w;
    if (cl.armFade && (x.path.startsWith('armR.') || x.path.startsWith('armL.'))) { const af = cl.armFade[x.path.slice(0, 4)];
      if (af && t > af.t + 1e-9) { const k = 1 - fastIn(clamp((t - af.t) / (F(af.out) || 1e-9))); if (k <= 0) continue; wx = w * k; } }
    if (LEGROOT.test(x.path) && cl.t0 + cl.dur < lastWalk) continue;    // a walk took over root and legs since
    if (c.air && LEGROOT.test(x.path) && c.placeTs.some(p => cl.t0 < p - 1e-9 && p <= t + 1e-9)) continue;   // a place key ends every earlier clip's hold on root and legs (a turn half way must not push him off the new place)
    const u = getPath(pose, x.path);
    // face channels (fix 3): a timeline face key after the clip's start wins from that key on; '@' on a face channel = the face
    // underneath NOW (talking, blinks, later keys), not a copy of the start value
    const isFace = x.path.startsWith('face.') && x.path !== 'face.flip' && x.path !== 'face.on';
    if (isFace && lastFaceKey(c, x.path.slice(5), t) > cl.t0 + 1e-9) continue;
    if ((x.path === 'glasses' || x.path === 'glassesLow') && c.glassesKeys && c.glassesKeys.some(([kt]) => kt > cl.t0 + 1e-9 && kt <= t + 1e-9)) continue;   // ENG8: a later glasses face key wins
    const from = x.add ? undefined : isFace ? u : fromValue(c, cl, x.path, u);
    const v = x.tr.at(lt, from);
    if (v === undefined) continue;
    setPath(pose, x.path, x.add ? addV(u ?? 0, v, wx) : blend(u, v, wx));
  }
}

/** '@' = the channel's value underneath at the clip's start (evaluated once with the layers below; cached). */
function fromValue(c, cl, path, fallback) {
  cl.from ??= new Map();
  if (cl.from.has(path)) return cl.from.get(path);
  const p = evalLayers(c, cl.t0, cl.i);
  let v = getPath(p, path);
  if (v === undefined || v === null) v = fallback;
  // clips write feet in ROOT space (ground frame): a world / unset foot underneath starts from the standing foot there
  if ((path === 'legR.foot' || path === 'legL.foot') && (v == null || p[`leg${path[3]}`].in !== 'root')) {
    const hip = path[3] === 'L' ? c.rest.hipL : c.rest.hipR; v = [hip[0], c.rest.ankleY ?? 0, hip[2]];
  }
  cl.from.set(path, clone(v));
  return v;
}

function defaultFoot(c, p, side) {
  const hip = side === 'L' ? c.rest.hipL : c.rest.hipR;
  const leg = p[`leg${side}`];
  if (leg?.in === 'root') return [hip[0], c.rest.ankleY ?? 0, hip[2]];
  return footUnder(p.root.x, p.root.z, p.root.ry, hip, (c.rest.ankleY ?? 0) + (p.root.y || 0));
}

/** After a cane walk ends (Q2): the cane hand stays where the walk's stop planted it, expressed in BODY space (relative to the hem, in
 *  the facing frame) so clips on that arm blend from it like from any rest hand (no pop when the walk ends or a point starts). */
function caneHold(c, t, pose) {
  let last = null, away = false;
  for (const wk of c.walks) { if (t < wk.t0) break; if (wk.w || !c.air) { last = wk; away = false; } else away = true; }   // away: a place / jump since that walk (the cane stays in the hand, measured from where the walk ended)
  let a;
  if (last && last.w && t >= last.t0 + last.w.dur) a = (last.endA ??= last.w.at(last.w.dur));
  else if (!last && c.walks[0]?.w) a = (c.walks[0].startA ??= c.walks[0].w.at(0));   // before the first walk: already on the cane
  else return;
  const side = a.cane?.side; if (!side) return;
  const h = a[`arm${side}`]?.hand; if (!h) return;
  const ry = (pose.root.ry || 0) * Math.PI / 180, co = Math.cos(ry), si = Math.sin(ry);
  const O = away ? last.w.end : pose.root, dx = h[0] - O.x, dy = h[1] - pose.body.hipY, dz = h[2] - O.z;
  pose[`arm${side}`].hand = [dx * co - dz * si, dy, dx * si + dz * co]; pose[`arm${side}`].in = 'body';
}

/** Layers up to (excluding) the clip with spec index `upto` (Infinity = all). */
function evalLayers(c, t, upto = Infinity) {
  const { tl, rest } = c;
  const { r, active } = walkRoot(c, t);
  const pose = restPose(rest, r);
  for (const [p, tr] of c.base) setPath(pose, p, tr.at(t, getPath(pose, p)));
  if (!active) caneHold(c, t, pose);
  if (c.air) HT.airBody(c, t, pose);      // off the ground: arms and body under the clips
  pose.face.eyes = c.face.eyes.at(t); pose.face.brow = c.face.brow.at(t); pose.face.mouth = c.face.mouth.at(t);
  if (c.glassesKeys) { let g; for (const [kt, v] of c.glassesKeys) { if (kt <= t + 1e-9) g = v; else break; }
    if (g !== undefined) { pose.glasses = g; pose.glassesLow = g === 'lowered' ? 1 : 0; } }
  const lw = lastWalkStart(c, t);
  for (const cl of c.clips) { if (cl.i === upto) break; applyClip(c, cl, t, pose, lw); }
  pose._walk = active;
  return pose;
}

// ---- ENG5 (FABLE_REVIEW3 items 3, 8): the face rhythm limiter. The combined face (expression keys + talking + listener answers +
// body-react clips + blinks + stress brows + phrase eyes) is re-timed ONCE per compiled timeline on the frame grid, forward, so the
// result is deterministic and pure in t. His rhythm (MOTION_BIBLE 7, ref f1400-1409, side f18-24):
//   eyes:  a new eye state holds >= `eyes` f (default 8) before the next one; blinks (2 f) pass through and don't reset the clock;
//          a change that comes too early waits until the hold is over (if it still stands then; a flicker shorter than that vanishes).
//          In dialog (his line, or a line he listens to: tl.listen) the closed-eye smile `arc` is an ACCENT: after `arc` f (default 8,
//          6-10 his) the eyes go back to `open`, unless the author's face key that set it says `hold: true` (held until that key's next
//          eyes key). Outside dialog an arc key holds as authored. A `half` of <= 2 f leading into another state is an in-between.
//   brows: same min hold; while the character speaks they are LOCKED to the value at the line's start, except one raise on the line's
//          main stressed word (the longest stress window of the span) and the author's own brow keys inside the line.
//   mouth: talking (visemes) passes untouched; outside speech an expression mouth holds >= `mouth` f (default 6).
// timeline `faceLimit: false` turns it off; `faceLimit: { eyes, brow, mouth, arc }` sets the holds (frames).
const FL = { eyes: 8, brow: 8, mouth: 6, arc: 8 };
function faceLimiter(c) {
  if (c.faceLim !== undefined) return c.faceLim;
  c.faceLim = null;
  const tl = c.tl; if (tl.faceLimit === false) return null;
  const o = { ...FL, ...(typeof tl.faceLimit === 'object' ? tl.faceLimit : {}) };
  const until = tl.until ?? Math.max(10, ...c.clips.map(x => x.t0 + x.dur + (x.spec.hold || 0) + 2), ...c.walks.filter(x => x.w).map(x => x.t0 + x.w.dur + 2),
    ...(c.face.spans || []).map(s => s[1] + 1));
  const N = Math.min(30 * 600, Math.ceil(until * 30) + 1);
  const fr = t => Math.round(t * 30);
  const spans = (c.face.spans || []).map(s => [fr(s[0]), fr(s[1])]);
  const inSpan = n => spans.find(s => n >= s[0] && n < s[1]);
  // dialog = his own lines + the other speakers' lines he listens to (tl.listen, make_film fills it): the arc accent rule applies there
  const lsp = (Array.isArray(tl.listen) ? tl.listen : []).filter(l => Array.isArray(l)).map(l => [fr(l[0]), fr(l[1]) + 9]);
  // ENG7 (timing audit c): the listener's answer (facetime: 3-5 f after the other line ends) passes the min hold: in the 8 f after a listened
  // line ends an eyes / brow change needs only 2 f of the old state (his answers land 1-3 f after the line; the 8 f hold delayed them 4-13 f)
  const ansEnds = (Array.isArray(tl.listen) ? tl.listen : []).filter(l => Array.isArray(l)).map(l => fr(l[1]));
  const answering = n => !inSpan(n) && ansEnds.some(e => n >= e && n < e + 8);
  const inDialog = n => lsp.find(s => n >= s[0] && n < s[1]);
  // the main stressed word of each span: the longest stress window starting inside it
  const mains = spans.map(s => { let best = null;
    for (const w of c.face.stress || []) { const a = fr(w[0]), b = fr(w[1]); if (a >= s[0] - 1 && a < s[1] && (!best || b - a > best[1] - best[0])) best = [a, b]; }
    return best; });
  const mainAt = n => { const i = spans.findIndex(s => n >= s[0] && n < s[1]); const m = i >= 0 ? mains[i] : null; return m && n >= m[0] && n < m[1]; };
  const keys = (tl.face || []).filter(e => typeof e.t === 'number');
  const browKey = new Set(keys.filter(e => e.brow != null).map(e => fr(e.t)));
  // arc holds the author asked for: [from, to) frames
  const eyeKeys = keys.filter(e => e.eyes != null).sort((a, b) => a.t - b.t);
  const arcHold = eyeKeys.map((e, i) => e.eyes === 'arc' && e.hold === true ? [fr(e.t), i + 1 < eyeKeys.length ? fr(eyeKeys[i + 1].t) : Infinity] : null).filter(Boolean);
  const held = n => arcHold.some(h => n >= h[0] && n < h[1]);
  const E = [], B = [], M = [];
  let arcDone = false, eCur = null, eAt = -1e9, bCur = null, bAt = -1e9, mCur = null, mAt = -1e9, lock = null, lockSpan = null;
  const RAW = []; for (let n = 0; n < N; n++) RAW.push(evalLayers(c, n / 30).face);
  // in-betweens: a blink, or a `half` squint of <= 2 f that leads into another state (a clip's anticipation, wince f15): shown as is,
  // they don't count as a change
  const runLen = n => { let k = n; while (k < N && RAW[k].eyes === RAW[n].eyes) k++; return k - n; };
  for (let n = 0; n < N; n++) {
    const raw = RAW[n];
    // eyes
    let e = raw.eyes;
    const sp0 = inSpan(n) || inDialog(n);
    if (eCur !== null && (e === 'blink' || (e === 'half' && eCur !== 'half' && (n > 0 && RAW[n - 1].eyes === 'half' ? runLen(n - 1) + 1 : runLen(n)) <= 2))) { E.push(e); }
    else {
      if (e === 'blink' || e === 'half' && eCur === null) e = e === 'blink' ? 'open' : e;
      // the closed-eye smile while SPEAKING is an accent (item 8: his lines are said with open eyes): spent after `arc` f
      if (e !== 'arc') arcDone = false; else if (arcDone && sp0 && !held(n)) e = 'open';
      if (eCur === null) { eCur = e; eAt = n; }
      else if (e !== eCur && n - eAt >= (answering(n) ? 2 : o.eyes)) { eCur = e; eAt = n; }
      if (eCur === 'arc' && sp0 && n - Math.max(eAt, sp0[0]) >= o.arc && !held(n)) { eCur = e === 'arc' ? 'open' : e; eAt = n; arcDone = e === 'arc'; }
      E.push(eCur);
    }
    // brows
    const sp = inSpan(n);
    if (sp !== lockSpan) { lockSpan = sp; lock = sp ? (bCur ?? raw.brow) : null; }
    let b = raw.brow;
    if (sp && !mainAt(n) && !browKey.has(n)) b = lock;
    if (sp && browKey.has(n)) lock = raw.brow;
    if (bCur === null) { bCur = b; bAt = n; }
    else if (b !== bCur && (n - bAt >= (answering(n) ? 2 : o.brow) || (sp && b === lock && mainAt(n - 1)))) { bCur = b; bAt = n; }
    else if (b !== bCur && sp && mainAt(n) && !mainAt(n - 1)) { bCur = b; bAt = n; }   // the one raise lands on its word
    B.push(bCur);
    // mouth
    let m = raw.mouth;
    if (sp || (mCur !== null && inSpan(n - 1))) { mCur = m; mAt = n; }
    else if (mCur === null || (m !== mCur && n - mAt >= o.mouth)) { if (m !== mCur) mAt = n; mCur = m; }
    M.push(mCur);
  }
  c.faceLim = { E, B, M, N };
  return c.faceLim;
}

export function evalPose(tl, t, rest) {
  const c = compile(tl, rest);
  t = snapT(t);
  const pose = evalLayers(c, t);
  const lim = faceLimiter(c), n = Math.round(t * 30);
  if (lim && n >= 0 && n < lim.N && Math.abs(t * 30 - n) < 1e-6) { pose.face.eyes = lim.E[n]; pose.face.brow = lim.B[n]; pose.face.mouth = lim.M[n]; }
  const act = pose._walk; delete pose._walk;
  if (act && act.wk.w.gait === 'run') pose.running = true;   // ENG8: character.js lets running noodle legs stretch more (level head, no hip dips)
  // height (engine/height.js): how far the walk's frame sits under his real ground (walk feet are world), and how much he is off the ground
  const nk = c.air ? 1 - (HT.airMode(c, t)) : 1, gy = c.air && act ? (pose.root.y || 0) - (act.a.rootY || 0) : 0;
  const upY = p => gy ? [p[0], p[1] + gy, p[2]] : p;
  if (nk < 1) pose.running = false;
  // walk legs + bob + arm swing, only while walking
  if (act) {
    const a = act.a;
    for (const s of ['R', 'L']) { const w = a[`leg${s}`], leg = pose[`leg${s}`]; if (!w.foot) continue;
      leg.foot = upY(w.foot); leg.in = 'world'; if (w.bend) leg.bend = w.bend; if (w.toe != null) leg.toe = w.toe; }
    pose.body.hipY += a.hipDY * nk;
    pose.body.bend += (a.bend || 0) * nk;                       // run lean / old-man stoop (walk.js `lean`)
    // MO2 (item 14): a cane walk places the cane prop itself (id = walk `caneProp`, default 'cane'): in the world, from the hand to the
    // PLANTED tip (character.js moves its top onto the drawn hand and aims it at `tip`), so the tip never travels with the body
    if (a.cane && a.cane.tip && !(pose.props[act.wk.spec?.caneProp ?? 'cane']?.in?.startsWith?.('hand:') && clipWritesProp(c, act.wk.spec?.caneProp ?? 'cane', t)))
      pose.props[act.wk.spec?.caneProp ?? 'cane'] = { in: 'world', at: upY([...a.cane.hand]), rot: [0, 0, 0], tip: upY([...a.cane.tip]), caneHand: a.cane.side };
    for (const [s, sg] of [['R', -1], ['L', 1]]) {
      const arm = pose[`arm${s}`], fix = a[`arm${s}`];
      if (fix && fix.hand) { arm.hand = upY([...fix.hand]); arm.in = fix.in || 'world'; continue; }   // the cane hand: world target, no swing
      if (arm.in === 'body' && !arm.grip) {
        const o = a.armOff?.[s] || [0, 0, 0];                     // running: pumping elbows (hands come up as they swing forward)
        arm.hand = [arm.hand[0] + o[0] * nk, arm.hand[1] + o[1] * nk, arm.hand[2] + sg * a.armDZ * nk + o[2] * nk];
      }
    }
  }
  // default feet: planted under the hips
  for (const s of ['R', 'L']) if (!pose[`leg${s}`].foot) { pose[`leg${s}`].foot = defaultFoot(c, pose, s); pose[`leg${s}`].in = pose[`leg${s}`].in || 'world'; }
  // off the ground: landing / take-off bends, then the legs do what the mode says instead of standing on nothing
  if (c.air) {
    HT.dips(c, t, pose); const k = HT.airLegs(c, t, pose);
    // the stage reads walkK from the root's speed: a place key is not speed, and legs in the air don't walk
    const nearPlace = c.placeTs.some(p => Math.abs(p - t) <= F(1) + 1e-6);
    if (k > 0 || nearPlace) pose.walkK = nearPlace && !k ? (act ? 1 : 0) : (act ? 1 - k : 0);
  }
  // plants
  for (const p of tl.plants || []) if (t >= p.t0 && t < p.t1) { const leg = pose[`leg${p.leg}`]; leg.foot = [...p.at]; leg.in = 'world'; }
  // look: head yaw / pitch toward a world point, 5 f fastIn on every change of target
  applyLook(c, pose, t);
  return pose;
}

// look: the rig (rig.js) turns the head toward look.at exactly and instantly. Motion supplies the TIMING: on every change of
// target, look.at travels from the old target to the new one around the head (yaw, pitch, distance interpolated, 5 f fastIn),
// so the head turns at gesture speed. null = straight ahead (look.at becomes null once the head is home).
const D2R = Math.PI / 180;
function lookPolar(c, at, t, H, ry) {
  if (!at) return [ry, 0, 3];
  const p = typeof at === 'function' ? at(t) : at;
  const dx = p[0] - H[0], dy = (p[1] ?? H[1]) - H[1], dz = p[2] - H[2], dh = Math.hypot(dx, dz);
  return [Math.atan2(dx, dz) / D2R, Math.atan2(dy, dh) / D2R, Math.max(.5, Math.hypot(dh, dy))];
}
function applyLook(c, pose, t) {
  const L = c.look; let k = -1;
  for (let i = 0; i < L.length; i++) if (L[i].t <= t) k = i;
  if (k < 0) return;
  const H = [pose.root.x, pose.body.hipY + hh(c.rest) + (pose.root.y || 0), pose.root.z];
  // MO2 (item 9): face first: the pupils snap to the new target on the key's frame (look.gaze, character.js draws look_l / look_r),
  // the head starts one frame later (5 f fastIn); the pupils stay on the target while the look holds. `gaze: false` on a key = no pupils.
  const w = L[k].instant ? 1 : fastIn(clamp((t - L[k].t - F(1)) / F(5)));   // instant: a look key on a place key (no swing from the old place)
  const cur = L[k].at;
  // the pupils hold on the target for `gazeHold` s after the key (key, else timeline, else 2 s: the reaction moment), then centre again
  // (a held side-eye reads as suspicious); `gaze: 'hold'` keeps them on it as long as the look lasts
  const gh = L[k].gaze === 'hold' ? Infinity : (L[k].gazeHold ?? c.tl.gazeHold ?? 2);
  const gz = cur && L[k].gaze !== false && t - L[k].t < gh - 1e-9 ? (typeof cur === 'function' ? cur(t) : [...cur]) : null;
  if (w >= 1) { pose.look = { at: cur ? (typeof cur === 'function' ? cur(t) : [...cur]) : null, gaze: gz }; return; }
  const b = lookPolar(c, cur, t, H, pose.root.ry), a = k > 0 ? lookPolar(c, L[k - 1].at, t, H, pose.root.ry) : [pose.root.ry, 0, b[2]];
  const dy = ((b[0] - a[0]) % 360 + 540) % 360 - 180;
  const yaw = (a[0] + dy * w) * D2R, pit = lerp(a[1], b[1], w) * D2R, d = lerp(a[2], b[2], w);
  pose.look = { at: [H[0] + d * Math.sin(yaw) * Math.cos(pit), H[1] + d * Math.sin(pit), H[2] + d * Math.cos(yaw) * Math.cos(pit)], gaze: gz };
}

/** true when a clip running at t writes props.<id> (then that clip owns the prop, not the cane walk) */
function clipWritesProp(c, id, t) {
  return c.clips.some(cl => t >= cl.t0 && t < cl.t0 + cl.dur + 1e-9 && cl.ch.some(x => x.path === `props.${id}` || x.path.startsWith(`props.${id}.`)));
}

/** The times this timeline changes place (place keys): a camera's lag must not average across them. [] for nearly every film. */
export const placeTimes = (tl, rest) => (compile(tl, rest).places || []).map(p => p.t);

/** Events (impact, sparks, release) from clips in [t0, t1). */
export function events(tl, rest, t0, t1) {
  const c = compile(tl, rest), out = [];
  for (const cl of c.clips) for (const e of cl.events) { const t = cl.t0 + e.t; if (t >= t0 && t < t1) out.push({ ...e, t, clip: cl.spec.name }); }
  for (const L of c.lands || []) if (L.t >= t0 && L.t < t1) out.push({ t: L.t, name: 'land', h: L.h, clip: 'height' });   // a fall's landing (h = D fallen)
  return out.sort((a, b) => a.t - b.t);
}
