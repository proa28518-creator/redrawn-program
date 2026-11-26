// engine/facetime.js - faces in time (MOTION_BIBLE section 7, laws 2, 6, 10). Every output is a STEP track (0 in-betweens).
// All functions are pure: lists are built from the inputs + a seed, never from playback.
import { F, FPS, hash, lerp } from './ease.js';
import { EXPR } from './faceset.js';

const fr = t => Math.round(t * FPS);                      // seconds -> nearest frame
const T = n => n / FPS;

/** Step track over sorted [[t, v], ...] (v === undefined = no change). at(t) = last value at or before t, else `dflt`. */
export function steps(list, dflt = null) {
  const ks = list.filter(k => k[1] !== undefined).sort((a, b) => a[0] - b[0]);
  return { keys: ks, at(t) { let v = dflt; for (const k of ks) { if (k[0] <= t + 1e-9) v = k[1]; else break; } return v; } };
}

/** expressions([{ t, eyes, brow, mouth }]) -> { eyes, brow, mouth } step tracks; a missing field carries the previous one. */
// BR (agent C, 2026-11-04): a key may name a preset, `{ t, expr: 'fear' }` -> faceset.js EXPR.fear's eyes/brow/mouth; fields written on
// the key win over the preset's. Note: compose.js's automatic body reactions read the key's own `eyes` / `mouth`, so a preset key alone
// does not recoil / slump: write the fields out (lab/cast/BR_EXPRESSIONS.md) or add `react`.
export function expressions(list = [], dflt = { eyes: 'open', brow: 'on', mouth: 'rest' }) {
  list = list.map(e => (e && e.expr && EXPR[e.expr]) ? { ...EXPR[e.expr], ...Object.fromEntries(Object.entries(e).filter(([k, v]) => k !== 'expr' && v !== undefined)) } : e);
  const out = {};
  for (const f of ['eyes', 'brow', 'mouth']) out[f] = steps(list.map(e => [T(fr(e.t)), e[f]]), dflt[f]);
  out.changes = [...new Set(list.filter(e => e.t > 0 && (e.eyes || e.brow || e.mouth)).map(e => T(fr(e.t))))];
  return out;
}

/** blinks({ seed, every: [min, max] s, frames: 2, until, changes: [t], speaking: [[a, b]], busy: [[a, b, [min, max]]] })
 *  -> sorted list of [t0, t1) blink intervals in seconds, on frames.
 *  Calm gap 33-42 f (default [1.1, 1.4] s), busy 8-16 f. A blink sits right before each expression change (law 10).
 *  No blink while speaking (section 7 "Talking"). */
// MO3 (2026-11-04, lab/timing audit: 3-f blinks in 27 % on one cast, 4-f blinks, double blinks 1-3 f apart): his blinks are 2 f
// (sometimes 1, rarely 3, never 4) and never closer than 7 f. `minGap` = open frames between two blinks (default 7); change blinks
// (law 10) keep priority, but a change blink that would land closer than minGap to the one before is dropped (the earlier one covers it).
// Length per blink from the hash: 1 f ~7 %, 3 f ~7 %, else `frames` (2); never above 3.
export function blinks({ seed = 1, every = [1.1, 1.4], frames = 2, from = 0, until = 60, changes = [], speaking = [], busy = [], minGap = 7 } = {}) {
  const out = [];
  const inSpan = (a, b, spans) => spans.some(s => a < s[1] + T(2) && b > s[0] - T(2));
  const lenOf = (k, s) => { const h = hash(k, s); return Math.min(3, frames === 2 ? (h < .07 ? 1 : h > .93 ? 3 : 2) : frames); };
  const clear = (n0, n1) => out.every(o => n0 >= fr(o[1]) + minGap || n1 + minGap <= fr(o[0]));
  for (const c of [...new Set(changes.map(fr))].sort((a, b) => a - b)) {
    const len = lenOf(c, seed + 13), n0 = c - len;
    if (n0 >= 0 && !inSpan(T(n0), T(c), speaking) && clear(n0, c)) out.push([T(n0), T(c), 'change']);
  }
  let t = from + lerp(every[0], every[1], hash(0, seed)) * .5, i = 1;
  while (t < until) {
    const b = busy.find(s => t >= s[0] && t < s[1]);
    const gap = b ? (b[2] || [10 / 30, 16 / 30]) : every;   // busy: his 8-16 f start to start; 10+ keeps the 7-f open gap
    const n = fr(t), len = lenOf(i * 3 + 1, seed);
    if (clear(n, n + len) && !inSpan(T(n), T(n + len), speaking)) out.push([T(n), T(n + len), 'auto']);
    t += lerp(gap[0], gap[1], hash(i, seed + 7)); i++;
  }
  return out.sort((x, y) => x[0] - y[0]);
}

// ---- talking ----
// Visemes: v_rest v_A v_E v_O v_M v_F v_L (closed lips = v_M). Spelling -> sounds -> viseme (M2, 2026-11-04):
//   his talking (boss f1367-1435) shows lens / O / line shapes and NO tongue, so v_L is only 'th' when it gets >= 3 f;
//   l t d n s z k g x = the small lens (v_E); m b p closed (v_M); f v ph teeth (v_F); sh ch j w wh qu oo ou ow and long o/u round (v_O);
//   short o (not, boss) and long i (ride, I, fine) open wide (v_A); short u (up, ton) small lens; h and r after a vowel are silent;
//   silent final e makes the vowel before it long (magic e); digits are spoken ("3.5" -> three point five).
const VOWEL = new Set(['v_A', 'v_E', 'v_O']);
// the shape a long hold alternates with (section 7: wide lens <-> small lens, big O <-> lens, small lens <-> line)
const PARTNER = { v_A: 'v_E', v_E: 'v_A', v_O: 'v_A', v_L: 'v_E', v_M: 'v_rest', v_F: 'v_rest' };
const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ' ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
function spellInt(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + spellInt(n % 100) : '');
  return String(n).split('').map(d => ONES[+d]).join(' ');
}
/** "3.5" -> "three point five", "20%" -> "twenty percent"; words without digits pass through. */
export function spoken(word) {
  return String(word).replace(/\d+(\.\d+)?%?/g, m => {
    const pc = m.endsWith('%'), [a, b] = m.replace('%', '').split('.');
    return ' ' + spellInt(+a) + (b ? ' point ' + b.split('').map(d => ONES[+d]).join(' ') : '') + (pc ? ' percent' : '') + ' ';
  }).trim();
}
const isV = c => 'aeiou'.includes(c);
function sounds(s) {
  // magic e: V C e at the end -> long vowel, e silent
  let long = -1;
  const m = s.length > 2 ? s.match(/([aeiou])([bcdfgklmnprstvz])e(s?)$/) : null;
  if (m) { if (m.index === 0 || !isV(s[m.index - 1])) long = m.index; s = s.slice(0, m.index + 2) + m[3]; }
  if (s === 'i') return ['v_A'];
  const out = [];
  for (let i = 0; i < s.length;) {
    const c = s[i], n2 = s.slice(i, i + 2), n3 = s.slice(i, i + 3), next = s[i + 1], after = s[i + 2];
    let v, k = 1;
    if (n3 === 'igh') { v = 'v_A'; k = 3; }
    else if (n3 === 'tch') { v = 'v_O'; k = 3; }
    else if (n2 === 'th') { v = 'v_L'; k = 2; }
    else if (n2 === 'sh' || n2 === 'ch' || n2 === 'wh' || n2 === 'qu') { v = 'v_O'; k = 2; }
    else if (n2 === 'ph') { v = 'v_F'; k = 2; }
    else if (n2 === 'oo' || n2 === 'ou' || n2 === 'ow' || n2 === 'oa' || n2 === 'ew' || n2 === 'ue') { v = 'v_O'; k = 2; }
    else if (n2 === 'ee' || n2 === 'ea' || n2 === 'ei' || n2 === 'ey') { v = 'v_E'; k = 2; }
    else if (n2 === 'ai' || n2 === 'ay' || n2 === 'ie' && i + 2 === s.length || n2 === 'au' || n2 === 'aw') { v = 'v_A'; k = 2; }
    else if (n2 === 'or' || n2 === 'ar') { v = c === 'o' ? 'v_O' : 'v_A'; k = 2; }
    else if (n2 === 'er' || n2 === 'ir' || n2 === 'ur') { v = 'v_E'; k = 2; }
    else if (n2 === 'ng' || n2 === 'ck') { v = 'v_E'; k = 2; }
    else if (c === 'a') v = 'v_A';
    else if (c === 'e') v = 'v_E';
    else if (c === 'i') v = i === long ? 'v_A' : 'v_E';
    else if (c === 'o') v = i === long || i === s.length - 1 ? 'v_O' : 'v_A';
    else if (c === 'u') v = i === long ? 'v_O' : 'v_E';
    else if (c === 'y') v = i === 0 ? 'v_E' : (i === s.length - 1 && s.length <= 3 ? 'v_A' : 'v_E');
    else if ('mbp'.includes(c)) v = 'v_M';
    else if ('fv'.includes(c)) v = 'v_F';
    else if (c === 'w' || c === 'j') v = 'v_O';
    else if (c === 'r') v = i === 0 ? 'v_O' : null;
    else if (c === 'h') v = null;
    else v = 'v_E';                                       // l t d n s z c k g x q: the small lens, no tongue
    if (v) out.push({ v, vowel: 'aeiouy'.includes(c) || k > 1 && /^(oo|ou|ow|oa|ew|ue|ee|ea|ei|ey|ai|ay|ie|au|aw|or|ar|er|ir|ur|igh)$/.test(s.slice(i, i + k)) });
    i += k;
  }
  return out;
}

/** word -> [{ v, w }] viseme groups with weights (stressed vowel 3, vowel 2, consonant 1), runs collapsed. */
export function visemesOf(word) {
  const parts = spoken(word).toLowerCase().split(/\s+/).map(p => p.replace(/[^a-z]/g, '')).filter(Boolean);
  const g = [];
  for (const s of parts) {
    let first = true;
    for (const x of (s === 'i' ? [{ v: 'v_A', vowel: true }] : sounds(s))) {
      const w = x.vowel ? (first ? 3 : 2) : 1; if (x.vowel) first = false;
      if (g.length && g[g.length - 1].v === x.v) { g[g.length - 1].w = Math.max(g[g.length - 1].w, w); continue; }
      g.push({ v: x.v, w });
    }
  }
  return g.length ? g : [{ v: 'v_E', w: 1 }];
}

/** say(words, opts) -> { mouth: step track, spans: [[a, b]], keys }.
 *  words = [{ word, start, end }] seconds. Mouth leads audio by `lead` (2 f), min hold `minHold` (2 f), about one swap per
 *  `rate` frames (2.3, section 7), 4-6 f holds land on stressed vowels via weights; pauses > `pause` s close to v_rest. */
// W6 2026-11-04 (FABLE_REVIEW4 item 5): talk is SMALL (faceset.js draws plain visemes scaled down: his f0440-49 / f1380-89 line that
// barely opens); a LOUD word gets the big drawings (name + '!': v_A! v_E! v_O! v_L! v_F!) and may get the big O 'o'. Loud = the word
// ends in '!' (or w.loud), or the whole line is loud (`loud: true` on the say line / opts). Quiet lines never get the big O any more.
const LOUD_OK = new Set(['v_A', 'v_E', 'v_O', 'v_L', 'v_F']);
export const isLoud = (w, opts = {}) => !!(opts.loud || w.loud || /!\W*$/.test(String(w.word ?? '')));
export function say(words = [], { lead = 2, minHold = 2, rate = 2.3, pause = .2, tail = 3, offset = 0, flick = .5, stressHold = 5, loud = false } = {}) {
  const keys = [], spans = [], loudR = [];
  const ws = words.map(w => ({ ...w, start: w.start + offset, end: w.end + offset })).sort((a, b) => a.start - b.start);
  let spanStart = null;
  for (let wi = 0; wi < ws.length; wi++) {
    const w = ws[wi], f0 = fr(w.start) - lead, f1 = Math.max(f0 + minHold, fr(w.end) - lead);
    if (isLoud(w, { loud })) loudR.push([f0, f1]);
    if (spanStart === null) spanStart = f0;
    let g = visemesOf(w.word);
    const n = f1 - f0, maxSteps = Math.max(1, Math.min(Math.floor(n / minHold), Math.round(n / rate)));
    if (g.length > maxSteps) {                         // keep the most visible: stressed vowel, vowels, closers, others; in order
      const rank = x => x.w === 3 ? 0 : VOWEL.has(x.v) || x.v === 'v_M' ? 1 : x.v === 'v_F' ? 2 : 3;   // closed lips read as much as vowels
      const keep = new Set(g.map((x, i) => [rank(x), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, maxSteps).map(x => x[1]));
      g = g.filter((x, i) => keep.has(i)).filter((x, i, a) => !i || a[i - 1].v !== x.v);
    }
    const W = g.reduce((s, x) => s + x.w, 0);
    // integer frame lengths, each >= minHold, proportional to weight
    let lens = g.map(x => Math.max(minHold, Math.floor(n * x.w / W)));
    let over = lens.reduce((s, x) => s + x, 0) - n;
    for (let i = lens.length - 1; over > 0 && i >= 0; i--) { const cut = Math.min(over, lens[i] - minHold); lens[i] -= cut; over -= cut; }
    if (over < 0) { const iMax = lens.indexOf(Math.max(...lens)); lens[iMax] -= over; }
    // his talking shows no tongue: th gets v_L only when it is held 3 f or more, else the small lens
    g = g.map((x, i) => x.v === 'v_L' && lens[i] < 3 ? { ...x, v: 'v_E' } : x);
    let f = f0;
    // a hold longer than his (1-3 f, 4-6 on a stressed vowel) alternates with a partner shape (the lens/O opening and closing)
    for (let i = 0; i < g.length; i++) {
      const v = g[i].v, maxH = g[i].w === 3 && v !== 'v_E' ? 5 : lens[i] >= 5 ? 2 : 3, partner = PARTNER[v];
      let left = lens[i], first = true, cur = v;
      while (left > 0) {
        const piece = first ? Math.min(left, maxH) : 2;
        const take = left - piece < minHold ? left : piece;
        keys.push([T(f), cur]); f += take; left -= take; first = false;
        if (partner) cur = cur === v ? partner : v;
      }
    }
    const next = ws[wi + 1];
    const gapF = next ? (fr(next.start) - lead) - f1 : Infinity;
    if (gapF >= Math.min(3, Math.round(pause * FPS))) {   // a gap of 3 f+: lips close (the "line"), the span ends after `tail` on a long pause
      keys.push([T(f1), 'v_rest']);
      if (!next || gapF > Math.round(.6 * FPS)) { spans.push([T(spanStart), T(f1 + tail)]); spanStart = null; }
    }
  }
  if (spanStart !== null) spans.push([T(spanStart), T(keys.length ? fr(keys[keys.length - 1][0]) + tail : spanStart)]);
  // de-dup equal neighbours and same-frame keys (last wins)
  const clean = [];
  for (const k of keys.sort((a, b) => a[0] - b[0])) { if (clean.length && Math.abs(clean[clean.length - 1][0] - k[0]) < 1e-9) clean[clean.length - 1] = k; else if (!clean.length || clean[clean.length - 1][1] !== k[1]) clean.push(k); }
  // runs merged across words can outlast his holds: inside speech a vowel holds at most 6 f, a consonant 3 f, then the partner
  // shape takes 2 f (wide lens <-> small lens, O <-> lens; closed lips relax to the line). Pauses (v_rest) are left alone.
  const split = [];
  for (let i = 0; i < clean.length; i++) {
    const [t, v] = clean[i]; split.push(clean[i]);
    if (v === 'v_rest' || i + 1 >= clean.length) continue;
    const f = fr(t), end = fr(clean[i + 1][0]), maxH = v === 'v_A' || v === 'v_O' ? 5 : 3, p = PARTNER[v];
    if (end - f <= maxH || !p) continue;
    let g = f + Math.min(maxH, 4), cur = p;
    while (end - g >= minHold) { split.push([T(g), cur]); g += cur === v ? 3 : 2; cur = cur === v ? p : v; if (end - g < minHold) break; }
  }
  clean.length = 0;
  for (const k of split) if (!clean.length || clean[clean.length - 1][1] !== k[1]) clean.push(k);
  // P (overnight 2): his talking uses 3-4 FAMILIES per line (line, slanted line, lens, big O), not two. Per phrase:
  //   the longest O hold (>= 3 f) is the loud word -> the big O ('o', his f1399-1402);
  //   every second short closing inside speech is his thin slanted line ('smirk', f1404-05) instead of the flat line.
  //   The first closing of a phrase stays v_rest (lips close on a pause).
  for (const [a, b] of spans) {
    const fa = fr(a), fb = fr(b), idx = [];
    for (let i = 0; i < clean.length; i++) { const f = fr(clean[i][0]); if (f >= fa && f < fb) idx.push(i); }
    const len = i => (i + 1 < clean.length ? fr(clean[i + 1][0]) : fb) - fr(clean[i][0]);
    let bestO = -1;
    const inLoud = i => loudR.some(([a, b]) => fr(clean[i][0]) >= a && fr(clean[i][0]) < b);
    for (const i of idx) if (clean[i][1] === 'v_O' && len(i) >= 3 && inLoud(i) && (bestO < 0 || len(i) > len(bestO))) bestO = i;
    if (bestO >= 0) clean[bestO] = [clean[bestO][0], 'o'];
    let nRest = 0;
    for (const i of idx) {
      if (clean[i][1] !== 'v_rest' || i + 1 >= clean.length || fr(clean[i + 1][0]) > fb - tail) continue;   // the phrase-end close stays flat
      if (len(i) <= 5 && nRest++ % 2 === 1) clean[i] = [clean[i][0], 'smirk'];
    }
  }
  // final hold law inside speech (merges above can rebuild long runs): vowels <= 5 f (his 4-6 on stressed), others <= 3 f, then the
  // partner shape for 2 f; a partner equal to the next key takes the other family (lens <-> line) so a swap always shows
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let i = 0; i + 1 < clean.length; i++) {
      const [t, v] = clean[i]; if (v === 'v_rest' || v === 'smirk') continue;
      const f = fr(t), end = fr(clean[i + 1][0]), maxH = v === 'v_A' || v === 'v_O' || v === 'o' ? 5 : 3;
      if (end - f <= maxH + 1) continue;
      let p = PARTNER[v] || (v === 'o' ? 'v_O' : 'v_E');
      if (p === clean[i + 1][1]) p = p === 'v_rest' ? 'v_E' : 'v_rest';
      const at = f + Math.min(maxH, 4);
      clean.splice(i + 1, 0, [T(at), p]);
      if (end - at > 3) clean.splice(i + 2, 0, [T(at + 2), v]);
      changed = true;
    }
    if (!changed) break;
  }
  // MO2 (FABLE_REVIEW2 item 12, coffee_break "That's... salt": lens <-> wide lens alternation read as ONE oval held 9 f at film size):
  // his talking closes the lips every 2-4 shapes. Inside speech, once 6+ f have passed since the last closed shape (v_rest v_M smirk
  // v_F), the next small-lens / partner key becomes closed lips (v_M) for its hold, so long vowels go wide / small / closed / wide.
  {
    const CLOSED = new Set(['v_rest', 'v_M', 'smirk', 'v_F']);
    let lastClosed = -1e9;
    for (let i = 0; i < clean.length; i++) {
      const f = fr(clean[i][0]), v = clean[i][1];
      if (CLOSED.has(v)) { lastClosed = f; continue; }
      const nf = i + 1 < clean.length ? fr(clean[i + 1][0]) : f + 99;
      if (f - lastClosed >= 6 && (v === 'v_E' || v === 'v_L') && nf - f <= 3 && i > 0 && clean[i - 1][1] !== 'v_rest' && i + 1 < clean.length && clean[i + 1][1] !== 'v_rest') {
        clean[i] = [clean[i][0], 'v_M']; lastClosed = f;
      }
    }
  }
  // stressed words (brows snap up on them): per phrase the longest word, plus any word of 8 f+ (4+ letters) at least 20 f after
  // the last; [t0, t1) = 1 f before the mouth (face first) to 2 f after the word.
  const stress = [];
  for (const [a, b] of spans) {
    const ph = ws.filter(w => w.start >= a - .2 && w.start < b).map(w => ({ w, f0: fr(w.start) - lead, f1: fr(w.end) - lead, n: String(w.word).replace(/[^a-z]/gi, '').length }));
    if (!ph.length) continue;
    const top = ph.reduce((m, x) => (x.f1 - x.f0) * (x.n > 2 ? 1 : .5) > (m.f1 - m.f0) * (m.n > 2 ? 1 : .5) ? x : m, ph[0]);
    let last = -1e9;
    for (const x of ph) if (x === top || (x.f1 - x.f0 >= 8 && x.n >= 4)) {
      if (x.f0 - last < 20 && x !== top) continue;
      if (x.f0 - last < 20) stress.pop();
      stress.push([T(x.f0 - 1), T(Math.min(x.f0 + 8, Math.max(x.f1 + 2, x.f0 + 5)))]); last = x.f0;   // a snap, 5-9 f, then back
    }
  }
  // MO3 (lab/timing audit: 2.6-3.3 f per mouth change vs his 2.3, too few 1-f holds, many 4-5 f holds off the stressed word): his rate.
  // Inside speech (not the lip-closed pauses v_rest), a hold of 4 f+ splits into 2-3 f pieces alternating with a partner shape, except
  // the stressed vowel (inside a stress window, v_A / v_O / o: up to `stressHold` 5 f, his 4-6). Then about `flick` of the 3-f holds
  // followed by another open shape end in a 1-f partner flick (his holds 1-3 f). Pure: the choice is hashed on the frame.
  if (rate < 2.6) {
    const CLOSE = new Set(['v_rest']);
    const inSpeech = f => spans.some(([a, b]) => f >= fr(a) && f < fr(b) - tail);
    const inStress = f => stress.some(([a, b]) => f >= fr(a) && f < fr(b));
    const alt = (v, prev, next) => { for (const c of [PARTNER[v] || (v === 'o' ? 'v_A' : 'v_E'), 'v_E', 'v_A', 'v_M']) if (c !== v && c !== prev && c !== next) return c; return 'v_E'; };
    const out = [];
    for (let i = 0; i < clean.length; i++) {
      const [t, v] = clean[i], f = fr(t), end = i + 1 < clean.length ? fr(clean[i + 1][0]) : null, next = i + 1 < clean.length ? clean[i + 1][1] : null;
      out.push(clean[i]);
      if (end === null || CLOSE.has(v) || !inSpeech(f)) continue;
      const L = end - f, stressed = (v === 'v_A' || v === 'v_O' || v === 'o') && inStress(f);
      if (stressed && L <= stressHold + 1) continue;
      if (L >= 4) {
        let g = f + (stressed ? Math.min(stressHold, L - 2) : (L === 5 || L === 7 ? 3 : 2)), cur = alt(v, out.length > 1 ? out[out.length - 2][1] : null, next);
        while (end - g >= 2) { out.push([T(g), cur]); const step = end - g === 3 ? 3 : 2; g += step; cur = cur === v ? alt(v, null, next) : v; }
        continue;
      }
      if (L === 3 && next !== 'v_rest' && hash(f, 29) < flick) out.push([T(f + 2), alt(v, v, next)]);
    }
    clean.length = 0;
    for (const k of out) if (!clean.length || clean[clean.length - 1][1] !== k[1]) clean.push(k);
  }
  // W6: loud words -> the big drawings ('!' names); everything else stays the small talk mouth
  if (loudR.length) for (let i = 0; i < clean.length; i++) {
    const f = fr(clean[i][0]), v = clean[i][1];
    if (LOUD_OK.has(v) && loudR.some(([a, b]) => f >= a && f < b)) clean[i] = [clean[i][0], v + '!'];
  }
  const st = steps(clean, 'v_rest');
  return { keys: clean, spans, stress, loud: loudR.map(([a, b]) => [T(a), T(b)]), mouth: st, speaking: t => spans.some(s => t >= s[0] && t < s[1]) };
}

// brow reactions (snap): a stressed word lifts the resting brow; a raised one dips; a scowl gets heavier
const STRESS_BROW = { on: 'up', up: 'on', down: 'on', knit: 'down', off: 'off' };
// eyes swap on some phrase starts (his talking keeps one eye drawing per phrase, so the change lands on the phrase edge)
const PHRASE_EYES = { open: 'smug', smug: 'open', half: 'open', angry: 'angry', sad: 'sad', wide: 'open' };
// the listener's answer after a line ends: a blink, a brow lift (+ blink before), or a look change; chosen by hash, never tweened
const LISTEN_EYES = { open: 'smug', smug: 'open', arc: 'arc', angry: 'angry', sad: 'sad', wide: 'wide' };

/** faceTracks({ expr, say: [{ t0, words }] | words, blink: {...} | false, until }) -> { eyes, brow, mouth, blinks, spans }.
 *  Talking overrides the mouth only while speaking. Blinks override the eyes (not during speech). */
export function faceTracks({ expr = [], say: sayIn = [], blink = {}, until = 60, listen, alive = true } = {}) {
  const ex = expressions(expr);
  const lines = Array.isArray(sayIn) && sayIn.length && sayIn[0].words ? sayIn : (sayIn.length ? [{ t0: 0, words: sayIn }] : []);
  const talks = lines.map(l => say(l.words, { ...(l.opts || {}), ...(l.loud ? { loud: true } : {}), offset: l.t0 || 0 }));
  const spans = talks.flatMap(s => s.spans);
  const seed = (blink && blink.seed) || 1;
  // talking life (P, overnight 2): brows snap with stressed words, eyes may swap on a phrase start (not the first of a line)
  const stress = alive ? talks.flatMap(s => s.stress || []) : [];
  const phraseEyes = [];
  if (alive) for (const s of talks) s.spans.forEach((sp, i) => { if (i > 0 && hash(Math.round(sp[0] * 30), seed + 11) < .6) phraseEyes.push(sp); });
  // listening: the other speakers' lines -> spans [a, b]; after each end the listener answers 3-5 f later (FABLE_REVIEW 2: "the listener's face answers")
  const lsrc = listen ?? (blink && blink.listen) ?? [];
  const lspans = (lsrc || []).map(l => Array.isArray(l) ? l : l.words ? [(l.t0 || 0) + Math.min(...l.words.map(w => w.start)), (l.t0 || 0) + Math.max(...l.words.map(w => w.end))] : null)
    .filter(Boolean).filter(s => !spans.some(m => s[1] + .1 > m[0] && s[1] + .1 < m[1]));
  const reacts = [], extraBlinks = [];
  for (const [, b] of lspans) {
    const f = fr(b) + 3 + Math.floor(hash(fr(b), seed + 5) * 3), h = hash(fr(b), seed + 3), k = h < .4 ? 'blink' : h < .75 ? 'brow' : 'eyes';
    if (k === 'blink') extraBlinks.push(T(f + 2));
    else { reacts.push({ a: T(f), b: T(f + (k === 'brow' ? 8 : 18)), k }); extraBlinks.push(T(f)); }
  }
  const blOpts = blink === false ? null : { ...blink }; if (blOpts) delete blOpts.listen;
  const bl = blink === false ? [] : blinks({ until, speaking: spans, ...blOpts, changes: [...ex.changes, ...(blink.changes || []), ...extraBlinks] });
  const inBlink = t => bl.find(b => t >= b[0] - 1e-9 && t < b[1] - 1e-9);
  const inS = (t, L) => L.find(s => t >= s[0] - 1e-9 && t < s[1] - 1e-9);
  const reactAt = (t, k) => reacts.find(r => r.k === k && t >= r.a - 1e-9 && t < r.b - 1e-9);
  return {
    blinks: bl, spans, stress, reacts,
    eyes: { at: t => { if (inBlink(t)) return 'blink'; const e = ex.eyes.at(t);
      if (inS(t, phraseEyes)) return PHRASE_EYES[e] || e; if (reactAt(t, 'eyes')) return LISTEN_EYES[e] || e; return e; } },
    brow: { at: t => { const b = ex.brow.at(t); return inS(t, stress) || reactAt(t, 'brow') ? (STRESS_BROW[b] ?? b) : b; } },
    mouth: { at: t => { for (const s of talks) if (s.speaking(t)) return s.mouth.at(t); return ex.mouth.at(t); } },
  };
}
