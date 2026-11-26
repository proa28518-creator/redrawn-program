// faceset.js: faces as data. faceState({ eyes, brow, mouth }, specFace) -> the state engine/face.js draws (lid dome brow mouth ms cells
// tongue extras). Parts come from specs/faces/kit.json (tools/faceset.py: his fitted medians + new states in his hand), are composed,
// then varied per character (spacing, size, colour, brow weight, mouth width) within his range. Snap only: a name is a drawing, never a tween.
// Unknown names fall back to the nearest drawing (ALIAS, then the part's default) and log once.
// Node: setKit(json) before use. Browser: await kitReady (face.js build() does).
let KIT = null;
const KIT_URL = new URL('../specs/faces/kit.json', import.meta.url);
export const kitReady = (typeof window !== 'undefined' && typeof fetch === 'function')
  ? fetch(KIT_URL, { cache: 'no-store' }).then(r => r.json()).then(k => (KIT = KIT || derive(k))).catch(e => { console.log('faceset: kit.json not loaded', e.message); return null; })
  : Promise.resolve(null);
export function setKit(k) { KIT = derive(k); CACHE.clear(); return KIT; }

// ---- BR (agent C, 2026-11-04, the backrooms horror short): horror states AS DATA, built from the kit's own drawings (same hand, same
// weights) and merged when the kit loads. A name already in kit.json wins (tools/faceset.py can take any of them over later).
// FACE_API.md "Horror states" + lab/cast/BR_EXPRESSIONS.md. Decal R units: u right, v down; eye centres (+-.227, .024 ring / .064 dome).
const scaleEll = (e, k, kv = k) => ({ ...e, ell: [e.ell[0], e.ell[1], +(e.ell[2] * k).toFixed(4), +(e.ell[3] * kv).toFixed(4), e.ell[4] || 0] });
const DERIVED = {
  eyes: {
    // the unblinking stare: his solid ovals 12 % bigger, nothing else. A name the gaze code ignores (character.js slides only open/smug
    // pupils), so listener gaze / look keys never move them; with `blink: false` on the timeline she never closes them
    stare: k => k.eyes.open && { lid: [null, null], dome: [null, null], extras: k.eyes.open.extras.map(e => scaleEll(e, 1.12)), browLift: -.02,
      src: 'BR: open ovals x1.12, immune to gaze (Maya)' },
    // dawning horror: the shock rings with a pinpoint pupil (ring a bit smaller than `wide`, dot .028 instead of .052)
    pinpoint: k => k.eyes.wide && { lid: [null, null], dome: [null, null], browLift: -.06, src: 'BR: wide rings, pinpoint pupils',
      extras: k.eyes.wide.extras.map((e, i) => scaleEll(e, [.93, .96, .54][i % 3])) },
  },
  brow: {
    // fear / worry: his resting brow raised .035 R and tilted so the INNER ends climb (the knit mirrored): v += .32 (|u| - .2)
    worried: k => k.brow.on && { brow: k.brow.on.brow.map(s => s.map((x, i) => i < 8 && i % 2 ? +(x - .04 + .55 * (Math.abs(s[i - 1]) - .2)).toFixed(4) : x)),
      src: 'BR: brow on, raised, inner ends up' },
    // confusion: one brow up, the other down
    quizzical: k => k.brow.up && k.brow.down && { brow: [k.brow.up.brow[0], k.brow.down.brow[1]], src: 'BR: up (left) + down (right)' },
  },
  mouth: {
    // pressed lips: the straight line at 55 % width, a touch bolder
    tight: k => k.mouth.flat && { ...k.mouth.flat, mouth: k.mouth.flat.mouth.map((x, i) => i < 8 ? (i % 2 ? x : +(x * .55).toFixed(4)) : +(x * 1.1).toFixed(4)), src: 'BR: flat x.55' },
    // a small gasp / gulp: the gasp O at 60 %, no highlight
    gulp: k => k.mouth.o && { ...k.mouth.o, extras: k.mouth.o.extras.filter(e => e.color !== 'white').map(e => ({ ...scaleEll(e, .6), ell: [e.ell[0], +(k.anchor.mouthV + (e.ell[1] - k.anchor.mouthV) * .6).toFixed(4), +(e.ell[2] * .6).toFixed(4), +(e.ell[3] * .6).toFixed(4), 0] })),
      src: 'BR: o x.6' },
  },
};
function derive(k) {
  if (!k || k._derived) return k;
  for (const part of ['eyes', 'brow', 'mouth']) for (const [n, f] of Object.entries(DERIVED[part])) if (!k[part][n]) { const d = f(k); if (d) k[part][n] = d; }
  k._derived = true;
  return k;
}
/** Named expressions (BR, 2026-11-04): a face key may say `expr: 'fear'` (facetime.js expressions() expands it; the key's own fields win). */
export const EXPR = {
  fear:      { eyes: 'wide', brow: 'worried', mouth: 'grid' },     // scared, teeth clenched
  terror:    { eyes: 'wide', brow: 'worried', mouth: 'wide' },     // the scream
  dread:     { eyes: 'open', brow: 'worried', mouth: 'tight' },    // quiet fear, listening
  gulp:      { eyes: 'open', brow: 'worried', mouth: 'gulp' },     // small gasp
  confused:  { eyes: 'open', brow: 'quizzical', mouth: 'flat' },   // "wait, what?"
  relief:    { eyes: 'arc', brow: 'worried', mouth: 'smile', hold: true },   // "phew" (arc held on purpose)
  hope:      { eyes: 'open', brow: 'up', mouth: 'smile' },         // "she's alive"
  dawning:   { eyes: 'pinpoint', brow: 'worried', mouth: 'flat' }, // dawning horror
  horror:    { eyes: 'pinpoint', brow: 'worried', mouth: 'o' },    // full horror
  stare:     { eyes: 'stare', brow: 'down', mouth: 'tight' },      // Maya: calm, intense, unblinking
  blank:     { eyes: 'stare', brow: 'off', mouth: 'rest' },        // Maya: the uncanny last frame
};
export function kit() { return KIT; }

export const DEFAULTS = { eyes: 'open', brow: 'on', mouth: 'rest' };
// other vocabularies (tracks/boss face_states, guideState, older scripts) -> the nearest kit drawing
export const ALIAS = {
  eyes: { closedArc: 'arc', happy: 'arc', rings: 'wide', shock: 'wide', manicRinged: 'wide', shockPinpoint: 'wide', oval: 'open', buttonOval: 'open',
    squeeze: 'wince', squint: 'wince', squintL: 'angry', scowl: 'angry', downArc: 'arc', closed: 'blink', bars: 'blink', left: 'look_l', right: 'look_r', wink: 'blink', shout: 'angry' },
  brow: { shout: 'knit', flat: 'down', angry: 'knit', raisedBoth: 'up', raisedOne: 'up', raised: 'up', none: 'off', hidden: 'off', lens: 'on' },
  mouth: { open: 'v_A', openThin: 'v_E', gaspO: 'o', gasp: 'o', line: 'flat', dot: 'o', wavy: 'frown', grin: 'crescent', teeth: 'crescent',
    clenched: 'grid', scream: 'wide', yell: 'wide', shout: 'wide', aweU: 'smile', v_B: 'v_M', v_P: 'v_M', v_I: 'v_E', v_U: 'v_O', v_W: 'v_O', closed: 'v_M', hidden: 'rest' },
};
const warned = new Set();
// W6 2026-11-04 (FABLE_REVIEW4 item 5: "ours shouts every line"): his talk mouth is SMALL (f0440-49 a short line that barely opens,
// f1380-89 a thin lens ~.27 D wide); the big open lens / O is for shouts. The kit's viseme drawings are the big (loud) ones; plain
// viseme names now draw them scaled down per shape: [width, opening] factors (u about the mouth centre; stroke widths, v offsets and
// extras' ry by the opening). A name ending in '!' (v_A! v_E! v_O! v_L! v_F!) is the loud drawing as in the kit (facetime.js say()
// writes them for words ending in '!' / loud lines). kit.params.talk = { v_A: [w, h], ... } overrides these; { off: true } = old look.
// engineer units (R, x spec mouthSize): line v_rest .6 wide x .125; small lens v_E .37 x .122; stressed v_A .45 x .141 (loud v_A! .64 x
// .235); O .16 x .17 (loud .36 x .38). Measured against his f1380-89 boss lens ~.28 D x .065 D and engineer's short dash (talk_vs_his.png).
export const TALK = { v_E: [.62, .66], v_A: [.7, .6], v_O: [.45, .45], v_L: [.62, .62], v_F: [.7, .85] };
const talkOf = name => { const T = KIT.params?.talk; if (T?.off) return null; return T?.[name] || TALK[name] || null; };
function resolve(part, name) {
  const P = KIT[part];
  if (name == null || name === '') return DEFAULTS[part];
  if (P[name]) return name;
  if (part === 'mouth' && name.endsWith('!') && name.length > 1) { const b = resolve(part, name.slice(0, -1)); return b in TALK ? b + '!' : b; }
  const a = ALIAS[part][name];
  const pick = a && P[a] ? a : name.startsWith('v_') && P.v_rest ? 'v_rest' : DEFAULTS[part];
  const key = part + ':' + name;
  if (!warned.has(key)) { warned.add(key); console.log(`faceset: no ${part} "${name}", using "${pick}"`); }
  return pick;
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export function paramsOf(specFace = {}) {
  // P (overnight 2): values a spec writes are clamped to kit.params.specRange (his cast: eyes the SAME size on everyone, bold brows,
  // STYLE_BIBLE "Face"); values fitted from his frames (kit.cast) only to the wider range. A character with no kit.cast entry gets
  // kit.params.newCast (bold brows) under its spec.
  const id = specFace.id, castIn = id && KIT.cast?.[id], cast = castIn || KIT.params?.newCast || {}, R = KIT.params?.range || {}, SR = KIT.params?.specRange || {};
  const p = { eyeSpacing: 1, eyeSize: 1, eyeV: 0, browThick: 1, browV: 0, mouthWidth: 1, mouthSize: 1, mouthV: 0, ...cast };
  for (const k in specFace) {
    let v = specFace[k];
    if (typeof v === 'number' && SR[k]) v = clamp(v, SR[k][0], SR[k][1]);
    p[k] = v;
  }
  for (const k in R) if (typeof p[k] === 'number') p[k] = clamp(p[k], R[k][0], R[k][1]);
  return p;
}

// ---- transforms (decal R, u right, v down)
const r4 = x => Math.round(x * 1e4) / 1e4;
function mapStroke(s, f, wmul) {
  if (!s) return null;
  const o = [];
  for (let i = 0; i < 8; i += 2) { const [u, v] = f(s[i], s[i + 1]); o.push(r4(u), r4(v)); }
  for (let i = 8; i < s.length; i++) o.push(r4(s[i] * wmul));
  return o;
}
function compose(names, p) {
  const loud = names.mouth.endsWith('!'), mName = loud ? names.mouth.slice(0, -1) : names.mouth;
  const A = KIT.anchor, E = KIT.eyes[names.eyes], B = KIT.brow[names.brow], M = KIT.mouth[mName];
  const tk = loud ? null : talkOf(mName), kw = tk ? tk[0] : 1, kh = tk ? tk[1] : 1;
  const eyeMap = side => (u, v) => {
    const s = side ? 1 : -1, au = s * A.eyeU, av = A.eyeV;
    return [s * A.eyeU * p.eyeSpacing + (u - au) * p.eyeSize, av + p.eyeV + (v - av) * p.eyeSize];
  };
  const lift = E.browLift || 0; // big eyes (wide rings) push the brows up so they never sit on the ring
  const browMap = side => (u, v) => { const s = side ? 1 : -1; return [u + s * A.eyeU * (p.eyeSpacing - 1), v + p.eyeV + p.browV + lift]; };
  const ms = p.mouthSize, mw = p.mouthWidth * ms;
  const mouthMap = (u, v) => [A.mouthU + (u - A.mouthU) * mw * kw, A.mouthV + (v - A.mouthV) * ms * kh + p.mouthV];
  const lw = p.eyeSize ** .35;
  const st = { pose: [0, 0, 0], flip: 1, lid: [null, null], dome: [null, null], brow: [null, null], mouth: null, ms: 'smirk', cells: [], tongue: null, extras: [] };
  for (const i of [0, 1]) {
    st.lid[i] = mapStroke(E.lid?.[i], eyeMap(i), lw);
    const d = E.dome?.[i];
    if (d) { const [u, v] = eyeMap(i)(d[0], d[1]); st.dome[i] = [r4(u), r4(v), r4(d[2] * p.eyeSize), r4(d[3] * p.eyeSize), d[4], d[5]]; }
    st.brow[i] = mapStroke(B.brow?.[i], browMap(i), p.browThick);
  }
  for (const e of E.extras || []) {
    const [cu, cv, rx, ry, tilt = 0] = e.ell, [u, v] = eyeMap(cu > 0 ? 1 : 0)(cu, cv);
    st.extras.push({ ell: [r4(u), r4(v), r4(rx * p.eyeSize), r4(ry * p.eyeSize), tilt], color: e.color });
  }
  st.ms = M.ms;
  if (M.inset !== undefined) st.inset = r4(M.inset * ms * kh);
  if (M.ms === 'grid' && M.mouth) {
    const g = M.mouth.slice(), [u, v] = mouthMap(g[0], g[1]);
    g[0] = r4(u); g[1] = r4(v); g[2] = r4(g[2] * mw); g[3] = r4(g[3] * ms);
    for (const k of [8, 9, 10]) g[k] = r4(g[k] * mw);
    st.mouth = g;
  } else st.mouth = mapStroke(M.mouth, mouthMap, ms * kh);
  st.cells = (M.cells || []).map(c => c.slice());
  if (M.tongue) { const t = M.tongue, [u, v] = mouthMap(t[0], t[1]); st.tongue = [r4(u), r4(v), r4(t[2] * mw * kw), r4(t[3] * ms * kh), t[4] || 0]; }
  for (const e of M.extras || []) {
    if (tk && e.color === 'white') continue; // W6: the small talk lens has no highlight (it read as a fleck)
    const [cu, cv, rx, ry, tilt = 0] = e.ell, [u, v] = mouthMap(cu, cv);
    st.extras.push({ ell: [r4(u), r4(v), r4(rx * mw * kw), r4(ry * ms * kh), tilt], color: e.color });
  }
  if (p.eyeColor) st.eyeColor = p.eyeColor;
  // FC (FABLE_REVIEW2 item 2): an open talking mouth in his hand is an ink rim round a MAROON inside (his f1400 boss). The default palette's
  // maroon (#3a1f26) is ink-dark, so on everyone but the Boss (whose fitted palette is redder) an open mouth read as a black blob. Characters
  // outside the original six get his maroon inside as an ellipse fitted to the mouth lens (the original six stay pixel-identical).
  if (!ORIGINAL.has(p.id)) for (const e of st.extras) if (e.color === 'maroon') e.color = KIT.params?.mouthMaroon ?? '#55202f'; // the gasp O's inside
  if (!ORIGINAL.has(p.id) && (st.ms === 'D') && !st.tongue && st.mouth && st.mouth.length >= 15) {
    const m = st.mouth, bz = t => [0, 1].map(c => (1 - t) ** 3 * m[c] + 3 * (1 - t) ** 2 * t * m[2 + c] + 3 * (1 - t) * t * t * m[4 + c] + t ** 3 * m[6 + c]);
    const [cu, cv] = bz(.5), chord = Math.hypot(m[6] - m[0], m[7] - m[1]), wmax = Math.max(...m.slice(8)), tilt = Math.atan2(m[7] - m[1], m[6] - m[0]);
    const ry = wmax / 2 - (KIT.params?.mouthRim ?? .045);
    if (ry > .02) st.extras.push({ ell: [r4(cu), r4(cv), r4(chord * .5 * .66), r4(ry), r4(tilt)], color: KIT.params?.mouthMaroon ?? '#55202f' });
  }
  return st;
}

const CACHE = new Map();
const ORIGINAL = new Set(['engineer', 'boss', 'tycoon', 'inspector', 'passenger', 'townsperson']); // fitted from his frames: never restyled
/** faceState({ eyes, brow, mouth }, specFace) -> face.js state (pose [0,0,0], flip 1: the caller places it). Cached per name combination. */
export function faceState(names = {}, specFace = {}) {
  if (!KIT) throw new Error('faceset: kit not loaded (await kitReady, or setKit(json) in node)');
  const n = { eyes: resolve('eyes', names.eyes), brow: resolve('brow', names.brow), mouth: resolve('mouth', names.mouth) };
  const p = paramsOf(specFace);
  const key = `${n.eyes}|${n.brow}|${n.mouth}|${p.id || ''}|${p.eyeSpacing}|${p.eyeSize}|${p.eyeV}|${p.browThick}|${p.browV}|${p.mouthWidth}|${p.mouthSize}|${p.mouthV}|${p.eyeColor || ''}`;
  let s = CACHE.get(key);
  if (!s) { s = compose(n, p); s.names = n; CACHE.set(key, s); if (CACHE.size > 4000) CACHE.delete(CACHE.keys().next().value); }
  return s;
}
/** every name the kit draws, per part */
export function names() { return { eyes: Object.keys(KIT.eyes), brow: Object.keys(KIT.brow), mouth: Object.keys(KIT.mouth) }; }
export default { faceState, kitReady, setKit, names, paramsOf, ALIAS, DEFAULTS, EXPR };
