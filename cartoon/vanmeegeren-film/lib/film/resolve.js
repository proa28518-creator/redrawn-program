// lab/film/resolve.js: a film file -> the resolved scene the stage draws (2026-11-04, port job). Isomorphic: tools/make_film.mjs runs it in
// node (fs io + puppeteer stages), the app's host page (templates/host/chost.js) runs the SAME code in the page (fetch io + in-page stages).
// It is make_film's resolution moved here unchanged: voice words split into the script lines, every 'line:N...' time, per-character
// timelines (say / listen / blink / settle), hand-overs, sit_on, prop clips, collar tracks, listener gaze, rests, the film end, lowCams,
// autoMove (park drift, push pads, follow + parkAt split), and endFraming.
//
//   const R = await resolveFilm(film, io, opts)  -> { scene, dur, N, fps, W, H, voice, characters, rests, filmProps, END, snaps }
//   io = { log(...a), json(rel, from), text(rel, from), openStage(sceneDef) -> { info, frame(t) -> { views }, close() }, tts?(film),
//          checkVoice?(V), wavOf?(file), rel?(file) }
//        from: 'film' = the film folder (node) / the project root (app), 'root' = the engine root (charsys / the project), 'spec' = a cast
//        spec given as a .json path (charsys root / the project's scenes/)
//   opts = { name, scale (1; .5 = --preview), ownSet: { module, file, label } | null, probe, noDrift, noFacelimit, guardSnaps(characters, props, rests, fps) }
// The resolved.json make_film writes = { ...scene, dur, N, lines: voice.lines }.
import { evalPose } from '../../engine/compose.js';
import { hh, CLIPS } from '../../engine/clips.js';
import { easeFn } from '../../engine/ease.js';
import { follow } from '../../engine/camera_moves.js';
import * as FE from './end.js';

// ---- own voice file: film.voice = { file, words, lines: [{ who, text }] } (see tools/FILM_API.md); words split across the lines IN ORDER
// (2026-11-05, port job: any language's letters. Accents are folded (NFKD, marks dropped: "canción" = "cancion"), so a film in Spanish,
// German, Russian or Japanese matches its words; ASCII text gives the same tokens as before. Keep in step with tools/make_film.mjs and
// the app's src/shared/trim.ts vtok.)
const vtok = s => String(s).normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[’']/g, '').replace(/[-–—/]/g, ' ').replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(Boolean);
const TTS_DROPPED = new Set(['pfft', 'tsk', 'tut']);
const JOIN_MAX = 40;   // a line token written without spaces (Japanese, Chinese, Thai) is several transcript words: join up to this many
export function splitOwnWords(words, lines, cast = {}) {
  const ws = words.filter(w => vtok(w.word).length);
  let j = 0; const outW = [], outL = [];
  lines.forEach((L, i) => {
    const n = i + 1, who = L.who != null && L.who in cast ? L.who : null, toks = vtok(L.text || '');
    const mine = [];
    for (const tk of toks) {
      const w = ws[j];
      const got = w ? vtok(w.word).join('') : null;
      if (got === tk) { mine.push(w); j++; continue; }
      if (TTS_DROPPED.has(tk)) continue;
      // a transcript can split / join a word differently (e.g. "o clock" vs "oclock", or a Japanese clause heard as several words):
      // join the next words while they spell the start of the token (two words = the old rule, unchanged)
      if (w && ws[j + 1] && tk.startsWith(got)) {
        let acc = got, k = j + 1, word = w.word;
        while (ws[k] && k - j < JOIN_MAX && acc.length < tk.length) { const nx = acc + vtok(ws[k].word).join(''); if (!tk.startsWith(nx)) break; acc = nx; word += ws[k].word; k++; }
        if (acc === tk) { mine.push({ ...w, word, end: ws[k - 1].end }); j = k; continue; }
      }
      throw new Error(`MAKE_FILM FAILED: voice file: line ${n} ("${L.text}") expects "${tk}" but words.json has ${w ? `"${w.word}" at ${w.start}s (word ${j + 1})` : 'no more words'}. ${outW.length} words matched before it.`);
    }
    if (!mine.length) throw new Error(`MAKE_FILM FAILED: voice file: line ${n} ("${L.text}") has no words`);
    for (const w of mine) outW.push({ who, line: n, word: w.word, start: +w.start, end: +w.end });
    outL.push({ line: n, who, text: L.text, start: +mine[0].start, end: +mine[mine.length - 1].end, ...(L.loud ? { loud: true } : {}) });
  });
  if (j < ws.length) throw new Error(`MAKE_FILM FAILED: voice file: words.json has ${ws.length - j} words after the last line (from "${ws[j].word}" at ${ws[j].start}s): add the missing line(s)`);
  return { words: outW, lines: outL };
}
export async function voiceOf(film, io, log = () => {}) {
  const V = film.voice || { lines: [] };
  if (!V.lines?.length) return { words: [], lines: [], wav: null };
  if (V.file) {
    if (io.checkVoice) io.checkVoice(V);
    if (!V.words) throw new Error(`MAKE_FILM FAILED: voice.words (word timings json) not found: ${V.words}`);
    let raw = await io.json(V.words, 'film'); if (!Array.isArray(raw)) raw = raw.words || [];
    const { words, lines } = splitOwnWords(raw, V.lines, film.cast || {});
    log(`voice: own file ${io.rel ? io.rel(V.file) : V.file}, ${lines.length} lines, ${words.length} words (${lines.filter(l => !l.who).length} narrator lines)`);
    return { words, lines, wav: io.wavOf ? io.wavOf(V.file) : V.file, own: true };
  }
  if (!io.tts) throw new Error('MAKE_FILM FAILED: the film has no voice.file: give it the recorded voice and its word times (voice: { file, words, lines })');
  return io.tts(film);
}

// ---- 'line:2.word:3+0.1' -> seconds on the film clock (= the voice clock). FX1: any string value starting with 'line:' in acts / props /
// handovers / shots is a time; a time key holding anything else that is not a number is an error naming the film key path.
export const TIME_KEYS = new Set(['t', 't0', 't1', 'parkAt']);
export function resolver(voice) {
  return (ref, where) => {
    if (typeof ref !== 'string') return ref;
    const at = where ? ` at ${where}` : '';
    const m = ref.match(/^line:(\d+)(?:\.(start|end)|\.word:(\d+)(?:\.(start|end))?)?\s*([+-]\s*[\d.]+)?$/);
    if (!m) throw new Error(`MAKE_FILM FAILED: bad time "${ref}"${at} (seconds, or line:N.start | line:N.end | line:N.word:K[.end] [+-s])`);
    const L = voice.lines.find(l => l.line === +m[1]);
    if (!L) throw new Error(`MAKE_FILM FAILED: "${ref}"${at}: no line ${m[1]} (the film has ${voice.lines.length} lines)`);
    let t;
    if (m[3]) { const ws = voice.words.filter(w => w.line === +m[1]); const w = ws[+m[3] - 1]; if (!w) throw new Error(`MAKE_FILM FAILED: "${ref}"${at}: line ${m[1]} has ${ws.length} words`); t = m[4] === 'end' ? w.end : w.start; }
    else t = m[2] === 'end' ? L.end : L.start;
    return +(t + (m[5] ? +m[5].replace(/\s/g, '') : 0)).toFixed(4);
  };
}
const NOTIME = new Set(['text', '_n', '_doc', 'name', 'kind', 'id', 'who', 'owner', 'spec', 'in', 'move', 'ease', 'gait', 'mouth', 'eyes', 'brow']);
export function resolveTimes(x, R, where = '') {
  const isLine = v => typeof v === 'string' && /^\s*line:/.test(v);
  if (Array.isArray(x)) return x.map((v, i) => isLine(v) ? R(v.trim(), `${where}[${i}]`) : resolveTimes(v, R, `${where}[${i}]`));
  if (!x || typeof x !== 'object') return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    const p = where ? `${where}.${k}` : k;
    if (TIME_KEYS.has(k) && typeof v === 'string') o[k] = R(v.trim(), p);
    else if (TIME_KEYS.has(k) && v != null && typeof v !== 'number' && typeof v !== 'function') throw new Error(`MAKE_FILM FAILED: ${p} = ${JSON.stringify(v)} is not a time (seconds or 'line:N...')`);
    else if (k === 'at' && isLine(v)) o.t0 = R(v.trim(), p);
    else if (k === 'clip') o.name = v;
    else if (isLine(v) && !NOTIME.has(k)) o[k] = R(v.trim(), p);
    else o[k] = resolveTimes(v, R, p);
  }
  return o;
}

// ENG8: a hand-over ENDS the giver's and the taker's handing-arm holds (timeline armEnds); FIX1: the taker carries what they took.
export function handoverArmEnds(handovers, characters) {
  for (const h of handovers || []) {
    if (h.endHolds === false || typeof h.t !== 'number') continue;
    const H = { hold: .2, back: .35, fromSide: 'L', toSide: 'R', ...h };
    for (const [who, side, role] of [[H.from, H.fromSide, 'from'], [H.to, H.toSide, 'to']]) {
      if (h.endHolds && h.endHolds !== true && h.endHolds !== role) continue;
      const c = characters.find(x => x.name === who); if (!c) continue;
      c.timeline.armEnds = [...(c.timeline.armEnds || []), { side, t: +(H.t + H.hold).toFixed(4), since: H.t, out: Math.max(2, Math.round(H.back * 30)), _handover: H.prop }];
      if (role === 'to' && h.carry !== false) c.timeline.clips = [...(c.timeline.clips || []), { name: 'carry', clip: 'carry', t0: +(H.t + H.hold).toFixed(4), params: { prop: H.prop, side }, keep: false }];
    }
  }
}

async function specOf(id, c, io) {
  const s = c.spec ?? id;
  if (typeof s === 'string' && /\.json$/.test(s)) { const j = await io.json(s, 'spec'); return { ...j, id: j.id || id, ...(c.face ? { face: { ...(j.face || {}), ...c.face } } : {}) }; }
  if (typeof s === 'string') return c.face ? { ...(await io.json('specs/' + s + '.json', 'root')), id: s, face: c.face } : s;
  return { ...s, id: s.id || id };
}

// ---- ENG5 / ENG6 (see tools/make_film.mjs history): never a frozen frame. park -> slow dolly; push whose ease stops dead at a shot edge ->
// padded past it; follow + parkAt -> follow, then a park on its parked framing (with the drift). still/park: true or drift: false = as authored.
export async function autoMove(shots, dur, opts = {}) {
  if (opts.rootOf) shots = await splitFollows(shots, dur, opts.rootOf);
  const sub = (a, b) => a.map((v, i) => v - b[i]), addk = (a, d, k) => a.map((v, i) => v + d[i] * k);
  return shots.map((s, i) => {
    const c = s.camera || {}, a = s.t0 ?? 0;
    const b = Math.min(s.t1 ?? Infinity, shots[i + 1]?.t0 ?? Infinity, dur);
    if (s.still === true || c.still === true || s.park === true || c.park === true || c.drift === false || s.drift === false || !(b > a + 1 / 30)) return s;
    const m = c.move || 'park', L = b - a;
    if (m === 'park' && Array.isArray(c.pos) && Array.isArray(c.target)) {
      const rate = c.drift ?? s.drift ?? .02, frac = Math.min(.15, rate * L), dir = sub(c.target, c.pos), e = easeFn('inOutSine');
      const pad = L / 2, k0 = pad / (L + 2 * pad), span = e(1 - k0) - e(k0);
      const P = u => addk(c.pos, dir, frac * (u - e(k0)) / span);
      return { ...s, camera: { ...c, move: 'push', from: { pos: P(0), target: [...c.target], fov: c.fov ?? 26 }, to: { pos: P(1), target: [...c.target], fov: c.fov ?? 26 },
        t0: a - pad, t1: b + pad, ease: 'inOutSine', _auto: 'drift' } };
    }
    if (m === 'push' && c.from?.pos && c.to?.pos && typeof (c.ease ?? 'outCubic') === 'string') {
      const e = easeFn(c.ease || 'outCubic'), p0 = c.t0 ?? a, p1 = c.t1 ?? (s.t1 ?? b);
      if (!(p1 > p0)) return s;
      const slow0 = (e(.03) - e(0)) / .03 < .35, slow1 = (e(1) - e(.97)) / .03 < .35;
      const pad0 = slow0 && p0 <= a + 1 / 30 ? 1 : 0, pad1 = slow1 && Math.abs(p1 - b) <= 1 / 30 ? 1 : 0;
      if (!pad0 && !pad1) return s;
      const PL = p1 - p0, padL = (pad0 && pad1 ? .35 : .6) * PL, q0 = p0 - pad0 * padL, q1 = p1 + pad1 * padL;
      const ka = e((p0 - q0) / (q1 - q0)), kb = e((p1 - q0) / (q1 - q0));
      const fix = (A, B) => { if (!Array.isArray(A) || !Array.isArray(B)) return [A, B]; const D = sub(B, A).map(v => v / (kb - ka)); const F0 = addk(A, D, -ka); return [F0, addk(F0, D, 1)]; };
      const [pf, pt] = fix(c.from.pos, c.to.pos), [tf, tt] = fix(c.from.target ?? c.to.target, c.to.target ?? c.from.target);
      const f0 = c.from.fov ?? 26, f1 = c.to.fov ?? f0, fd = (f1 - f0) / (kb - ka);
      return { ...s, camera: { ...c, from: { ...c.from, pos: pf, target: tf, fov: f0 - fd * ka }, to: { ...c.to, pos: pt, target: tt, fov: f0 - fd * ka + fd }, t0: q0, t1: q1, _auto: 'pad' } };
    }
    return s;
  });
}
async function splitFollows(shots, dur, rootOf) {
  const out = [];
  shots.forEach((s, i) => {
    const c = s.camera || {}, a = s.t0 ?? 0, b = Math.min(s.t1 ?? Infinity, shots[i + 1]?.t0 ?? Infinity, dur), pk = c.parkAt;
    if (c.move !== 'follow' || typeof pk !== 'number' || !c.who || !(pk > a + 1 / 30) || !(b > pk + 1 / 30)
      || s.still === true || c.still === true || s.park === true || c.park === true || c.drift === false || s.drift === false) { out.push(s); return; }
    const off = c.offset || [0, 0, 0];
    const subj = t => { const r = rootOf(c.who, t); return [r[0] + (off[0] || 0), r[1] + (off[1] || 0), r[2] + (off[2] || 0)]; };
    const P = follow(subj, { offset: c.camOffset || [0, 2, 9], lag: c.lag ?? .3, fov: c.fov ?? 26, lookOffset: c.look || [0, 1.4, 0] })(pk);
    let r0 = c.roll, r1 = c.roll;
    if (Array.isArray(c.roll)) { const end = b > 90 ? a + 4 : b, x = Math.min(1, Math.max(0, (pk - a) / Math.max(.01, end - a))), k = x * x * (3 - 2 * x);
      const rm = c.roll[0] + (c.roll[1] - c.roll[0]) * k; r0 = [c.roll[0], rm]; r1 = [rm, c.roll[1]]; }
    out.push({ ...s, t1: pk, camera: { ...c, ...(r0 != null ? { roll: r0 } : {}) } });
    out.push({ ...s, t0: pk, t1: s.t1 ?? b, _parkOf: i, camera: { move: 'park', pos: P.pos, target: P.target, fov: P.fov, ...(r1 != null ? { roll: r1 } : {}), ...(c.drift != null ? { drift: c.drift } : {}) } });
  });
  return out;
}
/** rests of every character from one tiny stage (io.openStage) */
async function restsFrom(characters, openStage) {
  const st = await openStage({ width: 64, height: 64, grid: false, characters: characters.map(c => ({ name: c.name, spec: c.spec, timeline: c.timeline })),
    camera: { keys: [{ t: 0, pos: [0, 2, 10], target: [0, 2, 0], fov: 26 }] } }, {});
  const rests = {}; st.info.chars.forEach((c, i) => { rests[characters[i].name] = c.rest; });
  await st.close();
  return rests;
}
/** rootOf(who, t) -> [x, y, z] from the characters' timelines, for autoMove's follow split */
async function rootsFor(characters, openStage) {
  const rests = await restsFrom(characters, openStage);
  return (who, t) => { const c = characters.find(x => x.name === who || x.spec?.id === who || x.spec === who); if (!c || !rests[c.name]) return [0, 0, 0];
    const p = evalPose(c.timeline, t, rests[c.name]); return [p.root.x || 0, p.root.y || 0, p.root.z || 0]; };
}

// ---- FIX1 PROPS / PROPS2: one owner per prop at every frame, checked before anything renders (see FILM_API "props").
export function propOwners(scene, film, fps = 30) {
  const cast = new Set(Object.keys(film.cast || {})), cuts = (scene.shots || []).map(s => s.t0 ?? 0);
  const onCut = t => cuts.some(c => Math.abs(c - t) <= 1.01 / fps);
  const ownerAt = (p, t) => { let o = p.owner; for (const k of p.keys || []) if (k.t <= t + 1e-6 && k.owner) o = k.owner; return o; };
  const inAt = (p, t) => { let w = p.in || 'world'; for (const k of p.keys || []) if (k.t < t - 1e-6 && k.in) w = k.in; return w; };
  const swapWith = (p, k, dir) => (scene.props || []).some(q => q !== p && (q.keys || []).some(x => Math.abs(x.t - k.t) <= 1.01 / fps &&
    ownerAt(q, x.t) === ownerAt(p, k.t) && (dir === 'hide' ? /^hand:/.test(x.in || '') && inAt(q, x.t) === 'hidden' : x.in === 'hidden' && /^hand:/.test(inAt(q, x.t)))));
  for (const p of scene.props || []) {
    for (const k of p.keys || []) if (k.t >= 0 && /^hand:/.test(k.in || '') && inAt(p, k.t) === 'hidden' && !k.fetch && !onCut(k.t) && !swapWith(p, k, 'show'))
      throw new Error(`MAKE_FILM FAILED: prop "${p.id}" key at t ${(+k.t).toFixed(2)} (f${Math.round(k.t * fps)}) makes the prop APPEAR in ${k.in} inside a shot (it pops into the hand): show it on a cut, swap it for a prop leaving that hand at the same t, or have a hand take it on screen (pick_up / a hand-over) and mark the key fetch: true`);
    const steps = [{ t: -1, owner: p.owner, in: p.in || 'world', at: p.at }, ...(p.keys || []).filter(k => !k.optsOnly && ['in', 'owner', 'at', 'drop'].some(f => f in k))];
    let cur = { owner: p.owner, in: p.in || 'world', at: p.at };
    for (const k of steps) {
      cur = { owner: k.owner ?? cur.owner, in: k.in ?? (k.at && !k.owner ? cur.in : cur.in), at: k.at ?? cur.at };
      const where = `prop "${p.id}"${k.t >= 0 ? ` key at t ${(+k.t).toFixed(2)} (f${Math.round(k.t * fps)})` : ''}`;
      if (k.drop) continue;
      if (/^hand:|^body$/.test(cur.in) && !cast.has(cur.owner)) throw new Error(`MAKE_FILM FAILED: ${where} is in ${cur.in} but has no owner in the cast (owner ${JSON.stringify(cur.owner)}): give it an owner, or a world at`);
      if (cur.in === 'world' && !Array.isArray(cur.at) && !cast.has(cur.owner)) throw new Error(`MAKE_FILM FAILED: ${where} has no owner: not in a hand and no world at [x, y, z]`);
      if (k.t >= 0 && k.in === 'hidden' && !k.stow && !onCut(k.t) && !swapWith(p, k, 'hide'))
        throw new Error(`MAKE_FILM FAILED: ${where} hides the prop inside a shot (it would vanish on screen): hide it on a cut, or put it away with a hand (put_down / pocket) and mark the key stow: true`);
    }
  }
}

// ---- AGENT-A: grab_collar needs the TARGET's collar in world at every frame (params._track), + the target's jerk on contact.
export function collarPoint(P, r, toward, hhf) {
  const top = (P.root.y || 0) + P.body.hipY + hhf(r) - .5 - .14;
  const dx = toward[0] - P.root.x, dz = toward[2] - P.root.z, d = Math.hypot(dx, dz) || 1;
  const out = .2;
  return [+(P.root.x + dx / d * out).toFixed(4), +top.toFixed(4), +(P.root.z + dz / d * out).toFixed(4)];
}
async function collarTracks(film, characters, voice, io, log) {
  const isGrab = x => (x.name ?? x.clip) === 'grab_collar';
  const todo = []; for (const c of characters) for (const x of c.timeline.clips || []) if (isGrab(x)) todo.push({ c, x });
  if (!todo.length) return;
  const rests = await FE.restsOf(characters, io.openStage);
  const bare = c => ({ ...c.timeline, clips: (c.timeline.clips || []).filter(x => !isGrab(x)) });
  const horizon = film.duration ?? Math.min(90, (voice.lines.length ? Math.max(...voice.lines.map(l => l.end)) : 0) + (film.tail ?? 1.6) + 2);
  for (const { c, x } of todo) {
    const p = x.params || (x.params = {}), tg = characters.find(o => o.name === p.target);
    if (!tg) throw new Error(`MAKE_FILM FAILED: acts.${c.name} grab_collar: params.target "${p.target}" is not in the cast (${characters.map(o => o.name).join(', ')})`);
    const t0 = x.t0 ?? 0, rT = rests[tg.name], rG = rests[c.name], tlG = bare(c), tr = [];
    const g = evalPose(tlG, t0, rG).root;
    if (p.jerk !== false) {
      const tc = t0 + (p.reach ?? 5) / 30, PT = evalPose(bare(tg), tc, rT), dx = g.x - PT.root.x, dz = g.z - PT.root.z, d = Math.hypot(dx, dz) || 1;
      (tg.timeline.clips ||= []).push({ name: 'collar_jerk', t0: +(tc - 1 / 30).toFixed(4), params: { dx: +(dx / d * .08).toFixed(4), dz: +(dz / d * .08).toFixed(4) }, _auto: true });
    }
    const tlT = bare(tg);
    const end = p.release != null ? t0 + ((p.reach ?? 5) + p.release + 6) / 30 : Math.max(t0 + 1, horizon);
    for (let f = 0; t0 + f / 30 <= end + 1e-9; f++) {
      const t = t0 + f / 30, PT = evalPose(tlT, t, rT), PG = evalPose(tlG, t, rG);
      tr.push([+(f / 30).toFixed(4), collarPoint(PT, rT, [PG.root.x, 0, PG.root.z], hh)]);
    }
    p._track = tr;
    const a = tr[0][1], dist = Math.hypot(a[0] - g.x, a[2] - g.z);
    log(`grab_collar: ${c.name} -> ${tg.name} at ${t0.toFixed(2)} s (${tr.length} frames tracked; collar ${dist.toFixed(2)} D from the grabber's root${dist > 1.3 ? ': FAR, the arm may not reach, stand closer' : ''})`);
  }
}
// ---- ENG4 listener gaze: during every line, each OTHER cast member's pupils go to the speaker's head (timeline base track listenGaze).
async function listenerGaze(film, characters, lines, io, log) {
  const todo = characters.filter(c => c.timeline.gaze !== false && film.cast[c.name]?.gaze !== false && !(c.timeline.base && 'listenGaze' in c.timeline.base));
  if (!todo.length) return;
  const rests = await restsFrom(characters, io.openStage);
  const headAt = (id, t) => { const c = characters.find(x => x.name === id), r = rests[id]; if (!c || !r) return null;
    const P = evalPose(c.timeline, t, r); return [+P.root.x.toFixed(3), +((P.root.y || 0) + P.body.hipY + hh(r)).toFixed(3), +P.root.z.toFixed(3)]; };
  let n = 0;
  for (const c of todo) {
    const looks = [...(c.timeline.look || []), ...(c.timeline.clips || []).filter(x => (x.name ?? x.clip) === 'look_at').map(x => ({ t: x.t0 ?? 0, gaze: x.params?.gaze, at: x.params?.at }))]
      .filter(k => typeof k.t === 'number').sort((a, b) => a.t - b.t);
    const keys = [[0, null, 'snap']];
    for (const L of lines) {
      if (L.who === c.name || !rests[L.who]) continue;
      if (looks.some(k => k.t >= L.start - .3 && k.t <= L.end)) continue;
      const last = looks.filter(k => k.t <= L.start).pop();
      if (last && last.at && last.gaze === 'hold') continue;
      const at = headAt(L.who, (L.start + L.end) / 2); if (!at) continue;
      keys.push([+(L.start + 2 / 30).toFixed(4), at, 'snap'], [+(L.end + .25).toFixed(4), null, 'snap']); n++;
    }
    if (keys.length > 1) c.timeline.base = { ...(c.timeline.base || {}), listenGaze: keys.sort((a, b) => a[0] - b[0]) };
  }
  log(`gaze: ${n} listener spans (pupils to the speaker)`);
}

// ---- ENG7 / ENG10: prop clips (eat / bite, pick_up, put_down) get owner, spots and bite keys (FILM_API "Eating, picking up, putting down").
const PROPCLIP = new Set(['eat', 'bite', 'pick_up', 'put_down']);
export function propClips(props, characters) {
  const byId = new Map((props || []).map(p => [p.id, p]));
  const bites = new Map();
  const puts = characters.flatMap(ch => (ch.timeline.clips || []).filter(s => (s.name ?? s.clip) === 'put_down' && s.params?.prop && Array.isArray(s.params.at))
    .map(s => ({ p: s.params.prop, at: s.params.at, t0: s.t0 ?? (typeof s.at === 'number' ? s.at : 0) }))).sort((a, b) => a.t0 - b.t0);
  for (const ch of characters) {
    const clips = (ch.timeline.clips || []).map(s => ({ s, t0: s.t0 ?? (typeof s.at === 'number' ? s.at : 0) })).sort((a, b) => a.t0 - b.t0);
    for (const { s, t0 } of clips) {
      const name = s.name ?? s.clip, p = s.params?.prop; if (!PROPCLIP.has(name) || !p) continue;
      const def = byId.get(p);
      if (!def) { console.log(`MAKE_FILM WARNING: acts.${ch.name} clip ${name} names prop "${p}" that the film's props list does not have`); continue; }
      if (def.owner == null && !(def.keys || []).some(k => 'owner' in k)) def.owner = ch.name;
      else if (def.owner != null && def.owner !== ch.name && !(def.keys || []).some(k => k.owner === ch.name))
        console.log(`MAKE_FILM WARNING: acts.${ch.name} clip ${name} moves prop "${p}" owned by "${def.owner}": the stage shows the owner's pose of it (hand it over first, or set owner)`);
      if (name === 'pick_up') {
        s.params = { ...s.params };
        const downs = puts.filter(x => x.p === p && x.t0 < t0 - 1e-9), last = downs[downs.length - 1];
        if (!s.params.at && last) s.params.at = [...last.at];
        if (!s.params.at) { if (!Array.isArray(def.at) || (def.in && def.in !== 'world')) throw new Error(`MAKE_FILM FAILED: acts.${ch.name} pick_up of "${p}" has no params.at and the prop has no world at`); s.params.at = [...def.at]; }
        if (!s.params.worldRot && !s.params.rot && Array.isArray(def.rot)) s.params.worldRot = [...def.rot];
      }
      if (name === 'put_down' && !s.params.worldRot && !s.params.rot && Array.isArray(def.rot)) s.params = { ...s.params, worldRot: [...def.rot] };
      if ((name === 'eat' || name === 'bite') && s.params.biteKey !== false) {
        const key = s.params.biteKey || 'bite', n = (bites.get(p) || 0) + 1; bites.set(p, n);
        const f = Math.max((s.params.up ?? 5) + 1, 6);
        def.keys = [...(def.keys || []), { t: +(t0 + f / 30).toFixed(4), [key]: s.params.biteTo ?? n, optsOnly: true }].sort((a, b) => a.t - b.t);
      }
    }
  }
}

// ---- FX1: a kit set's marks + seat height from world/sets.js's KIT table (plain text: no THREE needed), or a film's own set.js `marks: { ... }`
export function parseSetMarks(src, name, own) {
  const out = { marks: {}, seatY: null };
  if (src == null) return out;
  const i = own ? 0 : src.search(new RegExp(`\\n\\s*${name}: \\{`)); if (i < 0) return out;
  const nx = own ? -1 : src.slice(i + 1).search(/\n {2}[a-z_]+: \{\s*\n/); const block = src.slice(i, nx < 0 ? undefined : i + 1 + nx);
  const num = s => s.replace(/^(-?)\./, '$10.');
  const mk = block.match(/marks: \{([^}]*)\}/);
  if (mk) for (const m of mk[1].matchAll(/([A-Za-z_]\w*): \[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]/g)) out.marks[m[1]] = [+num(m[2]), +num(m[3])];
  const sy = block.match(/seatY: (-?[\d.]+)/); if (sy) out.seatY = +num(sy[1]);
  return out;
}
async function setMarksIo(name, ownSet, io) {
  if (typeof name !== 'string' && !ownSet) return { marks: {}, seatY: null };
  let src = null; try { src = ownSet ? await io.text(ownSet.file, 'abs') : await io.text('world/sets.js', 'root'); } catch { src = null; }
  return parseSetMarks(src, name, !!ownSet);
}
/** the shots' camera ground positions [{ t0, t1, at: [x, z] }] (park pos, push mid-way; follow / orbit: none) */
export function shotCams(shots) {
  return shots.map((s, i) => { const c = s.camera || {}, t1 = i + 1 < shots.length ? shots[i + 1].t0 : 1e9;
    const p = c.move === 'push' && c.from?.pos && c.to?.pos ? c.from.pos.map((v, k) => (v + c.to.pos[k]) / 2) : (c.move || 'park') === 'park' ? c.pos : null;
    return Array.isArray(p) ? { t0: s.t0 ?? 0, t1: Math.min(t1, s.t1 ?? 1e9), at: [p[0], p[2]] } : null; }).filter(Boolean);
}
// ---- named sets: world/sets.js's (by name, built in the page), or the old boxes + stripes descriptions
export async function setOf(s, io) {
  if (!s) return {};
  if (typeof s === 'object') return s;
  let src = null; try { src = await io.text('world/sets.js', 'root'); } catch { src = null; }
  if (src != null && new RegExp(`name === '${s}'`).test(src) || s === 'plain') return s;
  if (s === 'path') return { stripes: [{ at: [0, 0], size: [40, 2.4], color: '#b9a37a' }] };
  if (s === 'bread_corner') return {
    stripes: [{ at: [0, 1.2], size: [40, 3], color: '#b6a07a' }, { at: [0, -.6], size: [40, .25], color: '#9c8865' }],
    boxes: [
      { size: [3.4, 1.55, 1.1], at: [0, 0, -2.2], color: '#9a6a43', dark: '#6e4a2e' },
      { size: [3.6, .1, 1.3], at: [0, 1.55, -2.2], color: '#c9a77a', base: false },
      { size: [.12, 3.2, .12], at: [-1.65, 0, -2.75], color: '#6e4a2e' }, { size: [.12, 3.2, .12], at: [1.65, 0, -2.75], color: '#6e4a2e' },
      { size: [3.9, .14, 1.7], at: [0, 3.2, -2.35], color: '#c84a3a', dark: '#93352a', base: false },
      { size: [3.9, .4, .05], at: [0, 2.92, -1.5], color: '#f2e8d8', base: false },
      { size: [5, 4.6, .3], at: [0, 0, -4.2], color: '#d9c3a0', dark: '#b39b78' },
      { size: [1.2, 1.6, .05], at: [-1.4, 1.6, -4.03], color: '#7f9fb3', base: false }, { size: [1.2, 1.6, .05], at: [1.4, 1.6, -4.03], color: '#7f9fb3', base: false },
      { size: [8, 6, .3], at: [-6.5, 0, -5.2], color: '#c7b08c' }, { size: [8, 5.2, .3], at: [6.5, 0, -5.2], color: '#cdb594' },
      { size: [.18, 4.2, .18], at: [4.2, 0, -1.2], color: '#4a4a52', shape: 'cyl' },
      { size: [.55, .4, .55], at: [4.2, 4.2, -1.2], color: '#f2dc8f', base: false },
    ] };
  if (s === 'yard') return { boxes: [{ size: [2.6, .9, .8], at: [0, 0, -1.2], color: '#8a6a4a' }, { size: [9, 5, .3], at: [0, 0, -4], color: '#b9a58a' }] };
  return {};
}

// ---- ENG9: loud words (a script word ending in '!') -> facetime.js big mouths
const LOUD_TOK = /!["'”’)\]]*$/;
const normW = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function loudWords(words = [], text = '') {
  const toks = String(text).split(/\s+/).filter(s => /[\p{L}\p{N}]/u.test(s)).map(s => ({ n: normW(s), loud: LOUD_TOK.test(s) }));
  let j = 0;
  return words.map((w, i) => {
    const n = normW(w.word);
    let k = -1;
    for (let q = j; q < Math.min(toks.length, j + 4); q++) if (toks[q].n === n) { k = q; break; }
    if (k < 0 && toks.length === words.length) k = i;
    if (k >= 0) j = k + 1;
    const loud = !!w.loud || (k >= 0 && toks[k].loud);
    return loud ? { ...w, loud: true } : { ...w };
  });
}
// ---- caption beats (his "words" style): one word, or two when they run together; never across a sentence end
const SENT_END = /[.?!]["'”’)]*$/;
const SPACELESS = /[฀-๿぀-ヿ㐀-鿿豈-﫿]/;
export function wordChunks(words, lines = []) {
  const out = [], endsSentence = new Set();
  const byLine = new Map(); words.forEach((w, i) => { if (!byLine.has(w.line)) byLine.set(w.line, []); byLine.get(w.line).push(i); });
  for (const [ln, idx] of byLine) {
    const L = lines.find(l => l.line === ln), toks = L ? L.text.split(/\s+/).filter(s => /[\p{L}\p{N}]/u.test(s)) : null;
    idx.forEach((wi, k) => { const tok = toks && toks.length === idx.length ? toks[k] : words[wi].word; if (SENT_END.test(tok)) endsSentence.add(wi); });
  }
  for (let i = 0; i < words.length;) {
    const a = words[i], b = words[i + 1];
    const two = b && !endsSentence.has(i) && b.line === a.line && (b.start - a.end < .2) && (a.word.length + b.word.length <= 11) && (a.word.length <= 4 || b.word.length <= 3);
    const ws = two ? [a, b] : [a];
    // (two Thai / Japanese / Chinese words join without a space: those languages write none between words)
    out.push({ t0: a.start, end: ws[ws.length - 1].end, line: a.line, who: a.who, text: ws.map(w => w.word).join(ws.every(w => SPACELESS.test(w.word)) ? '' : ' ').toUpperCase() });
    i += ws.length;
  }
  out.forEach((c, i) => { const n = out[i + 1]; c.t1 = n && n.line === c.line && n.t0 - c.end < .5 ? n.t0 : c.end + .3; });
  return out;
}
/** the caption at t (stage frame opts.caption): film.captions true | "line" = the spoken line, "words" = his big words; undefined = none */
export function captionFn(film, voice) {
  const chunks = film.captions === 'words' ? wordChunks(voice.words, voice.lines) : null;
  return t => {
    if (!film.captions) return undefined;
    if (chunks) { const c = chunks.find(c => t >= c.t0 - 1e-6 && t < c.t1); return c ? { text: c.text, style: 'words', age: t - c.t0, who: c.who } : ''; }
    const L = voice.lines.find(l => t >= l.start - .05 && t <= l.end + .25); return L ? L.text : '';
  };
}

// ---- the whole resolution (tools/make_film.mjs main(), up to resolved.json)
export async function resolveFilm(film, io, opts = {}) {
  const log = io.log || (() => {});
  const fps = film.fps || 30, [FW, FH] = film.size || [1080, 1920];
  const voice = await voiceOf(film, io, log), R = resolver(voice);
  if (opts.voiceOnly) return { voice };
  // acts: resolve times, add the voice's say tracks, the cast's start position, blinks
  const characters = [];
  let k = 0;
  for (const [id, c] of Object.entries(film.cast)) {
    const tl = resolveTimes(JSON.parse(JSON.stringify(film.acts?.[id] || {})), R, `acts.${id}`);
    tl.root = tl.root || { x: c.at?.[0] ?? 0, z: c.at?.[1] ?? 0, ry: c.ry ?? 0 };
    if (tl.root.y == null && (c.y ?? c.at?.[2]) != null) tl.root.y = c.y ?? c.at[2];
    const mine = voice.lines.filter(l => l.who === id);
    tl.say = [...(tl.say || []), ...mine.map(L => { const src = film.voice?.lines?.[L.line - 1] || {};
      const ws = loudWords(voice.words.filter(w => w.line === L.line), L.text ?? src.text ?? '');
      return { t0: L.start, ...(src.loud === true ? { loud: true } : {}),
        words: ws.map(w => ({ word: w.word, start: +(w.start - L.start).toFixed(3), end: +(w.end - L.start).toFixed(3), ...(w.loud ? { loud: true } : {}) })) }; })];
    if (tl.blink === undefined) tl.blink = { seed: 3 + 7 * k };
    if (tl.listen === undefined) tl.listen = voice.lines.filter(l => l.who && l.who !== id && l.who in film.cast).map(l => [l.start, l.end]);
    const cane = (film.props || []).find(p => p.kind === 'cane' && p.owner === id);
    for (const w of tl.walk || []) if (w.cane && w.caneLen == null && cane) w.caneLen = cane.length ?? 1.25;
    if (tl.settle === undefined) tl.settle = true;
    characters.push({ name: id, spec: await specOf(id, c, io), timeline: tl });
    k++;
  }
  handoverArmEnds(resolveTimes(film.handovers || [], R, 'handovers'), characters);
  const shots = resolveTimes(film.shots || [], R, 'shots');
  for (const ch of characters) {
    const so = ch.timeline.sit_on; if (!so) continue;
    const list = Array.isArray(so) ? so : [so];
    for (let i = 0; i < list.length; i++) { const s0 = list[i], s = s0.sit_on ?? s0, where = `acts.${ch.name}.sit_on${Array.isArray(so) ? `[${i}]` : ''}`;
      if (typeof s.seat === 'string') { const m = await setMarksIo(film.world?.set, opts.ownSet, io); const p = m.marks[s.seat];
        if (!p) throw new Error(`MAKE_FILM FAILED: ${where}.seat = "${s.seat}" is not a mark of set ${JSON.stringify(film.world?.set)} (marks: ${Object.keys(m.marks).join(', ') || 'none found'})`);
        s.seat = [p[0], p[1]]; if (s.seatY == null && m.seatY != null) s.seatY = m.seatY; }
      if (!Array.isArray(s.seat)) throw new Error(`MAKE_FILM FAILED: ${where}.seat must be [x, z] or a set mark name`);
      if (s.cam == null) s.cam = shotCams(shots);
    }
  }
  const filmProps = resolveTimes(film.props || [], R, 'props');
  propClips(filmProps, characters);
  await collarTracks(film, characters, voice, io, log);
  if (film.gaze !== false && voice.lines.length && characters.length > 1) await listenerGaze(film, characters, voice.lines, io, log);
  const rests = await FE.restsOf(characters, io.openStage);
  const END = FE.filmEnd(film, voice, characters, rests, resolveTimes(film.handovers || [], R, 'handovers'), fps);
  const dur = END.dur;
  log(`END: film ends at ${dur.toFixed(2)} s (${END.why}; authored ${END.authored.toFixed(2)} s${film.endHold != null ? `, endHold ${film.endHold}` : ''})`);
  for (const m of FE.closeMouths(characters, voice, dur)) log('END: mouth', m);
  const snaps = opts.guardSnaps ? await opts.guardSnaps(characters, filmProps, rests, fps) : null;
  const shotsLow = film.lowCams === false ? shots : FE.lowCams(shots, characters, rests, { log }).shots;
  const N = Math.round(dur * fps);
  const scale = opts.scale ?? 1;
  const W = Math.round(FW * scale / 2) * 2, H = Math.round(FH * scale / 2) * 2;
  const world = film.world || {};
  if (opts.noFacelimit) for (const ch of characters) ch.timeline.faceLimit = false;
  const parks = shotsLow.some(s => s.camera?.move === 'follow' && typeof s.camera.parkAt === 'number');
  const shotsMoved = opts.noDrift || film.drift === false ? shotsLow : await autoMove(shotsLow, dur, parks ? { rootOf: await rootsFor(characters, io.openStage) } : {});
  const nAuto = shotsMoved.filter(s => s.camera?._auto).length;
  if (nAuto) log(`camera: ${shotsMoved.filter(s => s.camera?._auto === 'drift').length} parked shots get a slow drift, ${shotsMoved.filter(s => s.camera?._auto === 'pad').length} pushes keep moving at the cut (still:true to park)`);
  const ownSet = opts.ownSet || null;
  if (ownSet) log(`set: the film's own ${ownSet.label || ownSet.module}`);
  const scene = { width: W, height: H, sky: world.sky, ground: world.ground, shadow: world.shadow, grid: world.grid, set: ownSet ? 'own' : await setOf(world.set, io), setOpts: world.setOpts, ...(ownSet ? { setModule: ownSet.module } : {}), characters,
    props: filmProps, handovers: resolveTimes(film.handovers || [], R, 'handovers'), shots: shotsMoved, film: opts.name,
    ...(film.language ? { lang: String(film.language) } : {}) };   // (the captions' language: lab/stage.js capFaces; the app's host passes the project's)
  for (const h of scene.handovers) {
    const p = scene.props.find(p => p.id === h.prop); if (!p) throw new Error(`MAKE_FILM FAILED: handover of unknown prop "${h.prop}"`);
    p.keys = [...(p.keys || []), { t: h.t, owner: h.to, in: 'hand:' + (h.toSide || 'R'), rot: h.rot ?? p.rot, at: h.offset }].sort((a, b) => a.t - b.t);
  }
  propOwners(scene, film, fps);
  if (film.endFrame !== false && !opts.probe) { const ef = await FE.endFraming(scene, dur, fps, io.openStage, { log });
    if (ef) scene.shots = scene.shots.slice(0, ef.keep + 1).map((s, i) => i === ef.keep ? { ...s, t1: 99 } : s); }
  return { scene, dur, N, fps, W, H, voice, characters, rests, filmProps, END, snaps };
}

// ---- PROP GUARD's allowed snaps (tools/make_film.mjs guardSnaps, line for line; the app's host page passes it as opts.guardSnaps so its
// film_probe tool judges teleports exactly as make_film does). A clip returning `hitFrame`, a clip entry `snap`, a prop key `{ t, snap: true }`:
// any size, one frame either side; the rest of a hitFrame clip's span up to .3 D a frame; a placement key's travel up to 1 D a frame.
export function guardSnaps(characters, props, CLIPS, rests, fps = 30) {
  const out = new Map(), put = (id, f, lim) => { const s = out.get(id) || new Map(); out.set(id, s); if (!(s.get(f) >= lim)) s.set(f, lim); };
  const add = (id, f) => { for (const d of [-1, 0, 1]) put(id, f + d, Infinity); };
  for (const c of characters) for (const x of c.timeline.clips || []) {
    const hits = [], name = x.name ?? x.clip, t0 = x.t0 ?? 0; let span = 0;
    try { const R = CLIPS[name]?.(rests[c.name], x.params || {}); if (R?.hitFrame != null) { hits.push(R.hitFrame); span = R.dur || 0; } } catch {}
    if (x.snap != null && x.snap !== true) hits.push(...[].concat(x.snap));
    if (!hits.length) continue;
    const ids = x.params?.prop ? [x.params.prop] : (props || []).filter(p => p.owner === c.name).map(p => p.id);
    for (const id of ids) { for (const h of hits) add(id, Math.round((t0 + h / 30) * fps));
      for (let f = Math.round(t0 * fps), e = Math.round((t0 + span) * fps); span && f <= e; f++) put(id, f, .3); }
  }
  for (const p of props || []) for (const k of p.keys || []) { if (k.snap) add(p.id, Math.round(k.t * fps));
    if (!k.optsOnly && ['in', 'owner', 'at'].some(f => f in k) && (k.pass ?? .1) > .02) for (let f = Math.floor((k.t - (k.pass ?? .1)) * fps), e = Math.ceil((k.t + (k.pass ?? .1)) * fps); f <= e; f++) put(p.id, f, 1); }
  return out;
}
