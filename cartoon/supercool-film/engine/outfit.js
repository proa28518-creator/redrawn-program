// outfit.js: any body + outfit from data, no video (agent E, 2026-11-04). Pure JS (no THREE): torso.js builds the meshes from what this returns.
//   shapeOf(body)            -> the body's profile in torso units (D): { top, bottom, hw(y), pelvis: { hw(y), bottom } | null, sockets, legLen, armLen, depthRatio, power, ysTorso, ysPelvis }
//   compileOutfit(outfit, S) -> { decl, torso, skirt, skirtDef, trousers }: GLSL for torso.js's CUSTOM block + the skirt mesh's definition
// Torso space: origin on the body axis at the hem, +Y up, +X the character's left. (s, y): s = arc length from the front centre, + = viewer
// right on a front view; b = arc length from the back centre, + = viewer right on a back view. Layer coordinates: y = fraction of the torso's
// top (0 hem .. 1 top; the chin hides everything above ~.80), x = fraction of the local half width (0 centre .. 1 the side).
// Shading (STYLE_BIBLE 6): every cloth colour is painted flat, then lit viewer left -> dark viewer right (dark = srgb^1.25 * .78), a pale rim
// streak inside the lit contour on darks and mids (none on bright colours), then the inked details on top, unshaded.

// ---- body shapes. Normalised profiles: [u, w] with u 0 bottom .. 1 top of the torso part, w = fraction of the widest half width.
const n = (T, y0, y1, w) => T.map(([y, h]) => [(y - y0) / (y1 - y0), h / w]);
const PROFILES = {
  // the Tycoon's tall pill (torso.js TYC_W): widest low, rounded bottom, no pelvis band
  pill: n([[-.10, 0], [-.095, .10], [-.08, .19], [-.055, .27], [-.02, .33], [.03, .365], [.10, .39], [.20, .398], [.32, .392], [.45, .378], [.58, .355], [.68, .33], [.76, .30], [.83, .265], [.89, .22], [.94, .16], [.98, .08], [1.0, 0]], -.10, 1.0, .398),
  // the Boss's egg (torso.js BOSS_W), with a pelvis band
  egg: n([[0, .33], [.015, .362], [.04, .395], [.08, .42], [.15, .437], [.25, .446], [.36, .447], [.50, .44], [.62, .428], [.72, .415], [.80, .403], [.86, .388], [.90, .362], [.94, .318], [.97, .24], [.99, .12], [1.0, 0]], 0, 1.0, .447),
  // the engineer's slim vest (torso.js vestWidth sampled), with a pelvis band
  slim: n([[0, .2637], [.02, .2685], [.06, .2768], [.12, .2779], [.2, .2766], [.3, .2734], [.4, .2679], [.5, .2601], [.6, .2497], [.66, .2304], [.70, .2213], [.74, .1990], [.77, .1567], [.79, .0960], [.80, 0]], 0, .80, .279),
  // a pear for women's bodies: fuller low and at the bust, no waist (bible rule 4), rounded bottom
  curvy: [[0, 0], [.01, .3], [.03, .55], [.06, .75], [.1, .88], [.16, .96], [.25, 1], [.36, .98], [.48, .93], [.58, .91], [.66, .89], [.74, .84], [.81, .76], [.87, .64], [.92, .5], [.96, .33], [.99, .14], [1, 0]],
  // a rounder egg for kids: widest at the middle
  round: [[0, .80], [.04, .9], [.1, .97], [.2, 1], [.35, 1], [.5, .97], [.62, .92], [.72, .85], [.80, .76], [.87, .64], [.93, .47], [.97, .28], [1, 0]],
};
// pelvis bands, normalised: u = y / band depth (+.2 above the hem .. -1 bottom), w as above
const BANDS = {
  slim: [[.22, .914], [0, .914], [-.296, .878], [-.519, .796], [-.741, .663], [-.889, .502], [-.963, .358], [-1, 0]],
  egg: [[.33, .76], [0, .75], [-.28, .70], [-.56, .615], [-.78, .47], [-.92, .29], [-1, 0]],
};
// build classes (STYLE_BIBLE 7): W outer torso width (D), H chin to bottom (D), legs crotch to sole (D)
export const BUILDS = {
  slim: { shape: 'slim', W: .64, H: .90, legLen: 1.25, armLen: .95, band: .13 },
  medium: { shape: 'pill', W: .80, H: .92, legLen: 1.25, armLen: .95, band: 0 },
  stout: { shape: 'egg', W: .96, H: .95, legLen: 1.18, armLen: .95, band: .09 },
  egg: { shape: 'egg', W: .94, H: .98, legLen: 1.27, armLen: .95, band: .09 },
  pill: { shape: 'pill', W: .87, H: 1.0, legLen: 1.44, armLen: .95, band: 0 },
  curvy: { shape: 'curvy', W: .82, H: .92, legLen: 1.2, armLen: .92, band: 0 },
  kid: { shape: 'round', W: .64, H: .56, legLen: .72, armLen: .62, band: .08 },
};
const INK_OUT = .035; // the hull's ink outside the inner width

function interp(T) { // smooth piecewise table, ascending u
  return u => {
    if (u <= T[0][0]) return T[0][1];
    if (u >= T[T.length - 1][0]) return T[T.length - 1][1];
    for (let i = 0; i < T.length - 1; i++) if (u >= T[i][0] && u <= T[i + 1][0]) { const t = (u - T[i][0]) / (T[i + 1][0] - T[i][0]), s = t * t * (3 - 2 * t) * .35 + t * .65; return T[i][1] + (T[i + 1][1] - T[i][1]) * s; }
    return 0;
  };
}
function ringYs(yb, yt, roundBottom) { // top -> bottom, dense at the cap and the hem
  const ys = [], L = yt - yb, cap = Math.min(.2, L * .2);
  for (let i = 0; i <= 40; i++) ys.push(yt - cap * (1 - Math.cos(i / 40 * Math.PI / 2)));
  const mid = roundBottom ? yb + L * .15 : yb + Math.min(.10, L * .12);
  for (let i = 1; i <= 60; i++) ys.push(yt - cap - (yt - cap - mid) * i / 60);
  for (let i = 1; i <= 40; i++) ys.push(roundBottom ? mid - (mid - yb) * Math.sin(i / 40 * Math.PI / 2) : mid - (mid - yb) * i / 40);
  return ys;
}

export function shapeOf(body = {}) {
  const B = { ...BUILDS[body.build || 'medium'] || BUILDS.medium, ...body };
  const shape = B.profile ? 'custom' : B.shape;
  const prof = interp(B.profile || PROFILES[shape] || PROFILES.pill);
  const band = B.profile ? (B.band ?? 0) : (B.band ?? 0);
  const maxHW = B.W / 2 - INK_OUT;
  const L = B.H + .12; // mesh span: the top hides behind the head
  const S = { build: body.build, shape, W: B.W, H: B.H, depthRatio: B.depthRatio ?? (shape === 'egg' ? .84 : shape === 'slim' ? .974 : .88), power: B.power ?? (shape === 'slim' ? 2.1 : 2.2) };
  if (band > 0) {
    S.bottom = -band; S.top = L - band;
    S.hw = y => maxHW * prof(Math.max(0, y) / S.top);
    const bandT = interp((BANDS[shape] || BANDS.egg).slice().reverse());
    S.pelvis = { bottom: -band, top: band * .25, hw: y => maxHW * bandT(y / band) };
    S.ysTorso = ringYs(0, S.top, false);
    S.ysPelvis = (() => { const ys = []; for (let i = 0; i <= 12; i++) ys.push(band * .25 - band * .25 * i / 12); for (let i = 1; i <= 48; i++) ys.push(-band * Math.sin(i / 48 * Math.PI / 2)); return ys; })();
  } else {
    S.bottom = -.10; S.top = L - .10;
    S.hw = y => maxHW * prof((y - S.bottom) / (S.top - S.bottom));
    S.pelvis = null;
    S.ysTorso = ringYs(S.bottom, S.top, true);
  }
  // sockets from the shape (torso.js SOCKETS format)
  const shY = S.bottom + (S.top - S.bottom) * .76, shX = S.hw(shY) * .92;
  const hipX = band > 0 ? S.pelvis.hw(0) * .47 : maxHW * .34, hipY = band > 0 ? -band * .55 : -.05;
  S.sockets = { neck: [0, S.top - .05, 0], shoulderR: [-shX, shY, .12], shoulderL: [shX, shY, .12], hipR: [-hipX, hipY, .08], hipL: [hipX, hipY, .08] };
  // legs: body.legLen, or from body.height (standing, hat off: head .95 + torso H + legs)
  S.legLen = B.height ? Math.max(.5, Math.min(1.5, B.height - .95 - B.H)) : B.legLen;
  S.armLen = B.armLen;
  S.maxHW = maxHW;
  return S;
}

// ---- colours: sRGB hex -> linear GLSL literal
const lin = c => (c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
const rgb = h => { const s = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255); };
const f = v => (Math.abs(v) < 1e-6 ? '0.' : (+v).toFixed(4));
export const vec = h => { const [r, g, b] = rgb(h).map(lin); return `vec3(${f(r)}, ${f(g)}, ${f(b)})`; };
export const darkOf = h => '#' + rgb(h).map(c => Math.round(Math.pow(c, 1.25) * .78 * 255).toString(16).padStart(2, '0')).join('');
const shadeHex = (h, k) => '#' + rgb(h).map(c => Math.round(Math.min(1, c * k) * 255).toString(16).padStart(2, '0')).join('');
const luma = h => { const [r, g, b] = rgb(h); return .299 * r + .587 * g + .114 * b; };

// GLSL helpers (spliced before main() in torso.js's custom shader). fill/over/box/rbox/seg/tri/hash1 are torso.js's.
export const DECL = /* glsl */`
varying float vB;
// the engineer's vest model (torso.js k0 -.40 soft0 .17, k1 .70 soft1 .10): a flat fill over the front (col * .93 -> col, 7 %), one
// short shade edge to the dark tone near the dark contour, a narrow lit band at the lit contour. Was one wide ramp (-.50 .. .35) across
// the whole body: measured (lab/look/MEASURE.md) the front 8 L* darker than the engineer's in the same colour and half as flat.
vec3 SH(vec3 col, float kb) {
  vec3 dk = col * .45; // the engineer's dark / mid = .70 in sRGB (#1e7b77 / #2bafa8; his cast's median .67-.70, STYLE_BIBLE 6)
  vec3 c = mix(dk, mix(col * .93, col, smoothstep(-.40, .10, kb)), smoothstep(-.57, -.23, kb));
  return mix(c, mix(col, vec3(1.), .12), smoothstep(.60, .80, kb));
}
float RIMK(vec3 col) { return 1. - smoothstep(.20, .40, dot(col, vec3(.2126, .7152, .0722))); }
float vOpen(vec2 p, float tip, float w, float top) { return max(abs(p.x) - w * clamp((p.y - tip) / (top - tip), 0., 1.), tip - p.y); }
float speck(vec2 p, float sc, float seed) {
  vec2 sq = p / sc, si = floor(sq);
  float h0 = hash1(si.x * 7.13 + si.y * 31.7 + seed), h1 = hash1(si.x * 3.31 + si.y * 11.9 + seed), h2 = hash1(si.x * 5.7 + si.y * 2.3 + seed);
  vec2 sc2 = (si + .2 + .6 * vec2(h0, h1)) * sc;
  return fill(length(p - sc2) - sc * .13 * (.6 + .8 * h2)) * step(.35, h2);
}
float bandY(float y, float c, float h) { return abs(y - c) - h; }
void btn(inout vec3 c, vec2 p, vec2 m, float r, vec3 col, vec3 ink) { over(c, ink, fill(length(p - m) - r * 1.45)); over(c, col, fill(length(p - m) - r)); }
`;

// pattern code: modifies `cl` (cloth) at q (vec2), inside the region already chosen
function pattern(P, q = 'p') {
  if (!P) return '';
  const C = vec(P.color || '#3a2a33'), sc = P.scale ?? 1;
  switch (P.type) {
    case 'stripes': { const per = (P.every ?? .10) * sc, w = (P.width ?? .045) * sc, off = P.offset ?? 0; // horizontal bands
      return `over(cl, ${C}, fill(abs(mod(${q}.y - ${f(off)}, ${f(per)}) - ${f(per / 2)}) - ${f(w / 2)}) * step(${f(P.from ?? -9)}, ${q}.y) * step(${q}.y, ${f(P.to ?? 9)}));`; }
    case 'vstripes': case 'pinstripe': { const per = (P.every ?? (P.type === 'pinstripe' ? .06 : .10)) * sc, w = (P.width ?? (P.type === 'pinstripe' ? .006 : .04)) * sc;
      return `over(cl, ${C}, ${f(P.strength ?? 1)} * fill(abs(mod(${q}.x, ${f(per)}) - ${f(per / 2)}) - ${f(w / 2)}));`; }
    case 'lines': { const per = (P.every ?? .036) * sc; return `over(cl, mix(cl, ${C}, .55), ${f(P.strength ?? 1)} * fill(abs(mod(${q}.y, ${f(per)}) - ${f(per / 2)}) - .0035));`; }
    case 'tartan': { const per = (P.every ?? .16) * sc, w = (P.width ?? .05) * sc, C2 = vec(P.line || '#f2e8d8');
      return `{ float tx = fill(abs(mod(${q}.x, ${f(per)}) - ${f(per / 2)}) - ${f(w / 2)}), ty = fill(abs(mod(${q}.y, ${f(per)}) - ${f(per / 2)}) - ${f(w / 2)});
        over(cl, ${C}, .45 * tx); over(cl, ${C}, .45 * ty);
        over(cl, ${C2}, .7 * fill(abs(mod(${q}.x + ${f(per * .25)}, ${f(per)}) - ${f(per / 2)}) - .004)); over(cl, ${C2}, .7 * fill(abs(mod(${q}.y + ${f(per * .25)}, ${f(per)}) - ${f(per / 2)}) - .004)); }`; }
    case 'speckle': case 'tweed': { const s = (P.every ?? .034) * sc, C2 = P.light ? vec(P.light) : `mix(cl, vec3(1.), .35)`;
      return `over(cl, mix(cl, ${C}, ${f(P.strength ?? .45)}), speck(${q}, ${f(s)}, 1.)); ${P.type === 'tweed' ? `over(cl, mix(cl, ${C2}, .5), .6 * speck(${q} + vec2(.011, .017), ${f(s * .8)}, 9.)); over(cl, mix(cl, ${C}, .35), .5 * fill(abs(mod(${q}.x + ${q}.y * (step(.5, fract(${q}.y / ${f(s * 2)})) * 2. - 1.), ${f(s * .7)}) - ${f(s * .35)}) - ${f(s * .08)}));` : ''}`; }
    case 'dots': { const s = (P.every ?? .06) * sc; return `{ vec2 dq = mod(${q} + vec2(0., step(.5, fract(${q}.x / ${f(2 * s)})) * ${f(s / 2)}), ${f(s)}) - ${f(s / 2)}; over(cl, ${C}, fill(length(dq) - ${f(s * .14)})); }`; }
  }
  return '';
}

// ---- validation (FX2, 2026-11-04; blind3: `"buckle": true` painted the whole torso ink with no message). Wrong types never reach the
// shader: a colour key that is not "#rgb" / "#rrggbb" falls back to its default (true -> the default colour, e.g. the gold buckle), a
// number key that is not a number falls back to its default, unknown layer types / keys are named. One console.warn line per problem,
// naming the layer (index + type) and the key. The spec objects are never changed (sanitised copies).
const COLOUR_KEYS = new Set(['color', 'buckle', 'buttonColor', 'collarColor', 'dash', 'dots', 'stripes', 'line', 'light', 'trousers', 'ink']);
const ON_COLOUR = { dots: '#f4eeec', stripes: '#f4eeec' };           // colour keys where true means "on, in a default colour"
const NUM_KEYS = new Set(['y', 'h', 'x', 'w', 'tip', 'openW', 'buttons', 'buttonGap', 'collarW', 'neckW', 'neckD', 'waist', 'width', 'bibW', 'to', 'from', 'n', 'r', 'tail',
  'every', 'scale', 'offset', 'strength', 'flare', 'pleats', 'depthRatio', 'power', 'zOff', 'rim']);
const LAYER_KEYS = {
  shirt: ['color', 'pattern', 'collar', 'collarW', 'collarColor', 'placket'], blouse: ['color', 'pattern', 'collar', 'collarW', 'collarColor', 'placket'],
  jumper: ['color', 'pattern', 'neckW', 'neckD'], sweater: ['color', 'pattern', 'neckW', 'neckD'],
  vest: ['color', 'pattern', 'tip', 'openW', 'lapels', 'buttons', 'buttonColor', 'buttonGap', 'welts', 'belt'],
  jacket: ['color', 'pattern', 'tip', 'openW', 'lapels', 'buttons', 'buttonColor', 'buttonGap', 'welts', 'belt'],
  coat: ['color', 'pattern', 'tip', 'openW', 'lapels', 'buttons', 'buttonColor', 'buttonGap', 'welts', 'belt'],
  apron: ['color', 'pattern', 'bib', 'bibW', 'waist', 'width', 'to', 'pocket'],
  tie: ['color', 'dots', 'stripes'], bowtie: ['color', 'y', 'dots'],
  scarf: ['color', 'pattern', 'stripes', 'tail'], belt: ['color', 'y', 'h', 'buckle'],
  buttons: ['n', 'from', 'to', 'x', 'color', 'r'], pocket: ['x', 'y', 'w', 'h', 'color', 'flap'], welt: ['x', 'y', 'w', 'color'],
  placket: ['x', 'to'], suspenders: ['color', 'x', 'dash'],
  pattern: ['type', 'color', 'scale', 'every', 'width', 'offset', 'from', 'to', 'strength', 'line', 'light'],
};
const SKIRT_KEYS = ['color', 'length', 'shape', 'flare', 'pleats', 'pattern', 'depthRatio', 'power', 'zOff'];
const OUTFIT_KEYS = ['color', 'trousers', 'skirt', 'layers', 'ink', 'rim', '_legLen'];
export const isColour = v => typeof v === 'string' && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
const normColour = v => { const s = v.trim().replace('#', ''); return '#' + (s.length === 3 ? s.split('').map(c => c + c).join('') : s); };
function cleanKeys(src, known, where, warn) {
  const out = {};
  for (const [k, v] of Object.entries(src || {})) {
    if (k === 't') { out[k] = v; continue; }
    if (k.startsWith('_')) { out[k] = v; continue; }
    if (known && !known.includes(k)) { warn(`${where}: unknown key "${k}" (ignored; known: ${known.join(' ')})`); continue; }
    if (COLOUR_KEYS.has(k)) {
      if (v === false || v == null) { if (v === false && !(k in ON_COLOUR)) warn(`${where} key "${k}": false is not a colour -> the default`); continue; }
      if (isColour(v)) { out[k] = normColour(v); continue; }
      if (v === true && ON_COLOUR[k]) { out[k] = ON_COLOUR[k]; continue; }
      warn(`${where} key "${k}": ${JSON.stringify(v)} is not a colour ("#rrggbb") -> the default`);
      continue;
    }
    if (NUM_KEYS.has(k) && typeof v !== 'number') {
      if (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) { out[k] = +v; warn(`${where} key "${k}": the string ${JSON.stringify(v)} read as the number ${+v}`); continue; }
      warn(`${where} key "${k}": ${JSON.stringify(v)} is not a number -> the default`);
      continue;
    }
    if (k === 'pattern' && v && typeof v === 'object') { out[k] = cleanKeys(v, LAYER_KEYS.pattern, `${where} pattern`, warn); continue; }
    out[k] = v;
  }
  return out;
}
export function validateOutfit(O = {}, warn = m => console.warn('outfit: ' + m)) {
  const out = cleanKeys(O, OUTFIT_KEYS, 'top level', warn);
  if (O.skirt != null && O.skirt !== false) {
    if (typeof O.skirt !== 'object') { warn(`outfit key "skirt": ${JSON.stringify(O.skirt)} is not an object -> the default skirt`); out.skirt = {}; }
    else out.skirt = cleanKeys(O.skirt, SKIRT_KEYS, 'outfit skirt', warn);
    const L = out.skirt.length;
    if (L != null && typeof L !== 'number' && L !== 'knee' && L !== 'ankle') { warn(`outfit skirt key "length": ${JSON.stringify(L)} is not "knee", "ankle" or a number (D) -> "ankle"`); delete out.skirt.length; }
  }
  if (O.layers != null && !Array.isArray(O.layers)) { warn(`outfit key "layers" is not a list -> no layers`); out.layers = []; }
  else out.layers = (O.layers || []).map((L, i) => {
    if (!L || typeof L !== 'object') { warn(`layer ${i}: ${JSON.stringify(L)} is not an object (skipped)`); return null; }
    const known = LAYER_KEYS[L.t];
    if (!known) { warn(`layer ${i}: unknown layer type "${L.t}" (skipped; types: ${Object.keys(LAYER_KEYS).join(' ')})`); return null; }
    if (L.t === 'pattern') return { t: 'pattern', ...cleanKeys(Object.fromEntries(Object.entries(L).filter(([k]) => k !== 't')), known, `layer ${i} (pattern)`, warn) };
    return cleanKeys(L, known, `layer ${i} (${L.t})`, warn);
  }).filter(Boolean);
  return out;
}

// ---- compile. outfit = { color (innermost colour, default the shirt's), trousers, skirt: {...}, layers: [...] }
export function compileOutfit(O0 = {}, S) {
  const O = validateOutfit(O0);
  const top = S.top, INK = vec(O.ink || '#3a2a33');
  const Y = fr => fr * top;                      // layer y (fraction) -> torso units
  const X = (fr, yf) => fr * S.hw(Y(yf));        // layer x (fraction of the local half width) -> arc units (front ~ flat)
  const tc = [], td = [], sc = [], sd = [];      // torso cloth, torso detail, skirt cloth, skirt detail
  const base = O.color || (O.layers || []).find(l => l.t === 'shirt' || l.t === 'blouse')?.color || '#f4eeec';
  tc.push(`cl = ${vec(base)};`);
  const sk = O.skirt ? { color: '#8a3b32', length: 'ankle', shape: 'aline', flare: 1.35, pleats: 0, ...O.skirt } : null;
  let open = null; // the last garment's neck opening, for ties
  const visTop = .80; // fraction: above it the chin covers the body
  // a layer's details are hidden where a LATER garment covers it (an apron hides the blouse's placket): spans + covers
  const spans = [], tdTop = [];
  for (const Lr of O.layers || []) {
    const L = { ...Lr }, t0 = td.length;
    let cover = null;
    switch (L.t) {
      case 'shirt': case 'blouse': {
        // the whole torso in the shirt colour (garments over it leave only their opening); collar at the neck
        tc.push(`cl = ${vec(L.color || '#f4eeec')}; ${pattern(L.pattern)}`);
        const cy = Y(visTop - .02), cw = X(L.collarW ?? .42, visTop);
        if ((L.collar ?? (L.t === 'blouse' ? 'round' : 'point')) === 'point') {
          for (const sg of [-1, 1]) tdTop.push(`{ float d = tri(p, vec2(${f(sg * .012)}, ${f(cy + .03)}), vec2(${f(sg * cw)}, ${f(cy + .03)}), vec2(${f(sg * cw * .55)}, ${f(cy - .09)})); over(c, ${INK}, fill(d - .006)); over(c, SH(${vec(L.color || '#f4eeec')}, kb), fill(d)); }`);
        } else if (L.collar === 'round' || (L.t === 'blouse' && L.collar !== 'none')) {
          // two round flaps hanging from the neckline, each side of the centre
          const rx = cw * .5, ry = .07;
          for (const sg of [-1, 1]) tdTop.push(`{ vec2 m = vec2(${f(sg * rx)}, ${f(cy + .01)}); float d = max(length((p - m) / vec2(${f(rx)}, ${f(ry)})) - 1., (p.y - ${f(cy + .01)}) / ${f(ry)}) * ${f(Math.min(rx, ry))}; over(c, ${INK}, fill(d - .0045)); over(c, SH(${vec(L.collarColor || L.color || '#f4eeec')}, kb), fill(d)); }`);
        }
        if (L.placket ?? (L.t === 'blouse')) td.push(`over(c, ${INK}, .55 * fill(abs(p.x) - .0035) * step(p.y, ${f(Y(visTop - .05))}) * step(${f(Y(.05))}, p.y));`);
        break;
      }
      case 'jumper': case 'sweater': {
        const nw = X(L.neckW ?? .36, visTop), nd = L.neckD ?? .10, ny = Y(visTop + .02);
        open = { tip: ny - nd, kind: 'round' };
        cover = `step(1., length((p - vec2(0., ${f(ny)})) / vec2(${f(nw)}, ${f(nd)})))`;
        const C = L.color || '#d2662a';
        tc.push(`if (length((p - vec2(0., ${f(ny)})) / vec2(${f(nw)}, ${f(nd)})) > 1.) { cl = ${vec(C)}; ${pattern(L.pattern)} }`);
        // ribbed hem and neck: a darker band, short vertical ribs
        td.push(`{ float rn = (length((p - vec2(0., ${f(ny)})) / vec2(${f(nw)}, ${f(nd)})) - 1.) * ${f(nd)}; over(c, ${INK}, fill(abs(rn) - .006)); over(c, SH(${vec(shadeHex(C, .82))}, kb), fill(abs(rn - .025) - .018)); }`);
        td.push(`over(c, SH(${vec(shadeHex(C, .82))}, kb), fill(p.y - ${f(S.bottom + .07)})); over(c, mix(c, ${INK}, .35), fill(abs(mod(p.x, .03) - .015) - .003) * fill(p.y - ${f(S.bottom + .065)})); over(c, ${INK}, .8 * fill(abs(p.y - ${f(S.bottom + .072)}) - .004));`);
        break;
      }
      case 'vest': case 'jacket': case 'coat': {
        const tip = Y(L.tip ?? (L.t === 'vest' ? .45 : .48)), w = X(L.openW ?? (L.t === 'vest' ? .55 : .45), visTop), vt = Y(visTop + .06);
        open = { tip, w, vt, kind: 'v' };
        cover = `step(0., vOpen(p, ${f(tip)}, ${f(w)}, ${f(vt)}))`;
        const C = L.color || (L.t === 'vest' ? '#6a5a50' : '#7b5d4c');
        const lapel = luma(C) < .18 ? shadeHex(C, 1.45) : shadeHex(C, .84);
        tc.push(`if (vOpen(p, ${f(tip)}, ${f(w)}, ${f(vt)}) > 0.) { cl = ${vec(C)}; ${pattern(L.pattern)}`);
        if (L.t !== 'vest' && L.lapels !== false) tc.push(`  { float lw = mix(.03, .085, clamp((p.y - ${f(tip)}) / ${f(vt - tip)}, 0., 1.)); if (vOpen(p, ${f(tip)}, ${f(w)}, ${f(vt)}) < lw && p.y > ${f(tip)}) cl = ${vec(lapel)}; }`);
        tc.push(`}`);
        td.push(`over(c, ${INK}, fill(abs(vOpen(p, ${f(tip)}, ${f(w)}, ${f(vt)})) - .0065) * step(${f(tip - .02)}, p.y));`);
        if (L.t !== 'vest' && L.lapels !== false) td.push(`{ float lw = mix(.03, .085, clamp((p.y - ${f(tip)}) / ${f(vt - tip)}, 0., 1.)); over(c, ${INK}, fill(abs(vOpen(p, ${f(tip)}, ${f(w)}, ${f(vt)}) - lw) - .0055) * smoothstep(${f(tip)}, ${f(tip + .04)}, p.y)); }`);
        // centre line below the opening (the closure) and, on the back, a centre seam (+ a vent on jackets/coats)
        td.push(`over(c, ${INK}, .6 * fill(abs(p.x) - .0035) * step(p.y, ${f(tip)}));`);
        td.push(`over(c, ${INK}, .45 * fill(abs(b.x) - .003) * step(p.y, ${f(Y(.78))}));`);
        if (L.t !== 'vest') td.push(`over(c, ${INK}, .8 * fill(abs(b.x) - .0045) * step(p.y, ${f(Y(.22))}));`);
        // buttons
        const nb = L.buttons ?? (L.t === 'vest' ? 4 : 1), bc = vec(L.buttonColor || shadeHex(C, .55));
        for (let i = 0; i < nb; i++) { const yy = tip - .06 - i * (L.buttonGap ?? .09); if (yy > S.bottom + .04) td.push(`btn(c, p, vec2(0., ${f(yy)}), .017, ${bc}, ${INK});`); }
        // pockets: welts (jacket) or a chest welt + two lower welts
        if (L.welts !== false) {
          const wy = Y(.28), ww = X(.22, .28);
          for (const sg of [-1, 1]) td.push(`{ float d = box(p, vec2(${f(sg * X(.55, .28))}, ${f(wy)}), vec2(${f(ww)}, .012)); over(c, SH(${vec(shadeHex(C, .7))}, kb), fill(d)); over(c, ${INK}, .85 * fill(abs(d) - .0035)); }`);
          if (L.t !== 'vest') td.push(`{ float d = box(p, vec2(${f(X(.55, .62))}, ${f(Y(.62))}), vec2(${f(X(.18, .62))}, .009)); over(c, ${INK}, .9 * fill(d)); }`);
        }
        if (L.belt) td.push(`over(c, SH(${vec(shadeHex(C, .8))}, kb), fill(abs(b.x) - .08) * fill(abs(p.y - ${f(Y(.30))}) - .025)); over(c, ${INK}, .7 * fill(abs(abs(p.y - ${f(Y(.30))}) - .025) - .003) * fill(abs(b.x) - .08));`);
        break;
      }
      case 'apron': {
        const C = L.color || '#efe2c4', bib = L.bib ?? .62, waist = Y(L.waist ?? .16), aw = X(L.width ?? .62, .3), bibW = X(L.bibW ?? .45, bib);
        // torso: the bib (narrower) and the waist band all the way round (the ties)
        const bibD = `max(abs(p.x) - mix(${f(aw)}, ${f(bibW)}, clamp((p.y - ${f(waist)}) / ${f(Y(bib) - waist)}, 0., 1.)), p.y - ${f(Y(bib))})`;
        if (L.bib !== false) tc.push(`if (${bibD} < 0.) { cl = ${vec(C)}; ${pattern(L.pattern)} }`);
        tc.push(`if (abs(p.y - ${f(waist)}) < .022) cl = ${vec(C)};`);
        cover = `step(abs(p.y - ${f(waist)}), .022)${L.bib !== false ? ` + step(${bibD}, 0.)` : ''}${!sk ? ` + step(abs(p.x), ${f(aw)}) * step(p.y, ${f(waist)})` : ''}`;
        if (L.bib !== false) {
          td.push(`over(c, ${INK}, fill(abs(${bibD}) - .0055) * step(${f(S.pelvis ? 0 : S.bottom + .02)}, p.y));`);
          // neck strap: two straps from the bib corners up behind the head; on the back they cross down to the waist
          for (const sg of [-1, 1]) {
            td.push(`{ float d = seg(p, vec2(${f(sg * bibW * .85)}, ${f(Y(bib))}), vec2(${f(sg * bibW * .55)}, ${f(Y(.95))})) - .016; over(c, ${INK}, fill(d - .005)); over(c, SH(${vec(C)}, kb), fill(d)); }`);
            td.push(`{ float d = seg(b, vec2(${f(sg * X(.5, .85))}, ${f(Y(.85))}), vec2(${f(-sg * X(.35, .2))}, ${f(waist)})) - .016; over(c, ${INK}, fill(d - .005)); over(c, SH(${vec(C)}, kb), fill(d)); }`);
          }
        }
        td.push(`over(c, ${INK}, .8 * fill(abs(abs(p.y - ${f(waist)}) - .022) - .0035));`);
        // the bow at the back of the waist: two loops and a knot
        td.push(`{ for (int i = 0; i < 2; i++) { float sg = float(i) * 2. - 1.; float d = (length((b - vec2(sg * .065, ${f(waist + .005)})) / vec2(.06, .035)) - 1.) * .035; over(c, ${INK}, fill(d - .005)); over(c, SH(${vec(C)}, kb), fill(d)); over(c, ${INK}, .6 * fill(abs(d + .014) - .003)); }
          float k = length(b - vec2(0., ${f(waist)})) - .022; over(c, ${INK}, fill(k - .005)); over(c, SH(${vec(C)}, kb), fill(k)); }`);
        if (!sk) { // no skirt: the panel hangs to the hem of the torso
          tc.push(`if (abs(p.x) < ${f(aw)} && p.y < ${f(waist)}) cl = ${vec(C)};`);
          td.push(`over(c, ${INK}, fill(abs(abs(p.x) - ${f(aw)}) - .0055) * step(p.y, ${f(waist)}));`);
        } else {
          // on the skirt: the panel widens a little to its hem at `to` of the skirt's length; a pocket; the bow's tails at the back
          const to = L.to ?? .82;
          sk.apron = { C, aw, to, waist };
        }
        if (L.pocket && !sk) td.push(`{ float d = box(p, vec2(0., ${f(S.bottom + .12)}), vec2(.09, .06)); over(c, ${INK}, fill(abs(d) - .004)); }`);
        break;
      }
      case 'tie': {
        const C = L.color || '#2e2530', t0 = open?.tip ?? Y(.55), ty = Y(visTop - .02);
        const wid = `(.028 + .014 * clamp((${f(ty)} - p.y) / ${f(ty - t0)}, 0., 1.))`;
        td.push(`{ float d = max(abs(p.x) - ${wid}, max(p.y - ${f(ty)}, ${f(t0 - .02)} - p.y)); over(c, ${INK}, fill(d - .005)); over(c, SH(${vec(C)}, kb), fill(d));
          ${L.dots ? `{ vec2 dq = vec2(p.x, mod(p.y, .05) - .025); over(c, ${vec(L.dots)}, fill(length(dq) - .0065) * fill(d + .006)); }` : ''}
          ${L.stripes ? `over(c, ${vec(L.stripes)}, fill(abs(mod(p.y + p.x, .05) - .025) - .006) * fill(d + .004));` : ''}
          float k = max(abs(p.x) - .032, abs(p.y - ${f(ty + .005)}) - .024); over(c, ${INK}, fill(k - .005)); over(c, SH(${vec(C)}, kb), fill(k)); }`);
        break;
      }
      case 'bowtie': {
        const C = L.color || '#1c171d', y = Y(L.y ?? .70);
        td.push(`{ vec2 q = p - vec2(0., ${f(y)}); q.y *= 1.25; float wing = max(abs(q.y) - (.010 + .55 * abs(q.x)), abs(q.x) - .085); float d = min(wing, length(q) - .022);
          over(c, ${INK}, fill(d - .006)); over(c, SH(${vec(C)}, kb), fill(d)); over(c, ${INK}, fill(abs(length(q) - .022) - .004)); ${L.dots ? `over(c, ${vec(L.dots)}, fill(length(mod(q, .035) - .0175) - .005) * fill(d + .004));` : ''} }`);
        break;
      }
      case 'scarf': {
        const C = L.color || '#b8303b', y0 = Y(visTop - .06);
        // a band round the neck (all the way round) and one tail hanging on the viewer-left chest
        const tail = `max(abs(p.x + .10 + (p.y - ${f(y0)}) * .12) - .045, max(p.y - ${f(y0)}, ${f(Y(L.tail ?? .38))} - p.y))`;
        cover = `step(${f(y0)}, p.y) + step(${tail}, 0.)`;
        tc.push(`if (p.y > ${f(y0)} || ${tail} < 0.) { cl = ${vec(C)}; ${pattern(L.pattern || (L.stripes ? { type: 'stripes', color: L.stripes, every: .07, width: .022 } : null))} }`);
        td.push(`over(c, ${INK}, fill(abs(p.y - ${f(y0)}) - .005) * step(.06, abs(p.x + .10)));`);
        td.push(`over(c, ${INK}, fill(abs(${tail}) - .005) * step(p.y, ${f(y0)}));`);
        td.push(`over(c, ${INK}, .7 * fill(abs(mod(p.x + .10, .03) - .015) - .003) * step(p.y, ${f(Y(L.tail ?? .38) + .03)}) * step(${f(Y(L.tail ?? .38))}, p.y) * step(abs(p.x + .10), .045));`);
        break;
      }
      case 'belt': {
        const C = L.color || '#2b2024', y = Y(L.y ?? .18), h = L.h ?? .028, G = vec(L.buckle || '#e3c25a');
        tc.push(`if (abs(p.y - ${f(y)}) < ${f(h)}) cl = ${vec(C)};`);
        cover = `step(abs(p.y - ${f(y)}), ${f(h)})`;
        td.push(`over(c, ${INK}, .9 * fill(abs(abs(p.y - ${f(y)}) - ${f(h)}) - .0035));`);
        td.push(`{ vec2 m = vec2(0., ${f(y)}); over(c, ${INK}, fill(rbox(p, m, vec2(${f(h * 1.45)}, ${f(h * 1.15)}), .008))); over(c, ${G}, fill(rbox(p, m, vec2(${f(h * 1.15)}, ${f(h * .85)}), .006))); over(c, ${vec(C)}, fill(rbox(p, m, vec2(${f(h * .55)}, ${f(h * .35)}), .003))); }`);
        break;
      }
      case 'buttons': {
        const nB = L.n ?? 3, y0 = Y(L.from ?? .62), y1 = Y(L.to ?? .2), x = L.x ?? 0, col = vec(L.color || '#f4eeec');
        for (let i = 0; i < nB; i++) { const yy = nB === 1 ? y0 : y0 + (y1 - y0) * i / (nB - 1); td.push(`btn(c, p, vec2(${f(X(x, yy / top))}, ${f(yy)}), ${f(L.r ?? .017)}, ${col}, ${INK});`); }
        break;
      }
      case 'pocket': case 'welt': {
        const yy = Y(L.y ?? .3), x = X(L.x ?? .5, L.y ?? .3), hw = X(L.w ?? .2, L.y ?? .3), hh = L.t === 'welt' ? .012 : (L.h ?? .07);
        const C = L.color ? vec(L.color) : 'cl';
        if (L.t === 'welt') td.push(`{ float d = box(p, vec2(${f(x)}, ${f(yy)}), vec2(${f(hw)}, ${f(hh)})); over(c, ${INK}, .9 * fill(d)); }`);
        else td.push(`{ float d = box(p, vec2(${f(x)}, ${f(yy)}), vec2(${f(hw)}, ${f(hh)})); ${L.color ? `over(c, SH(${C}, kb), fill(d));` : ''} over(c, ${INK}, fill(abs(d) - .0042)); ${L.flap ? `over(c, ${INK}, fill(box(p, vec2(${f(x)}, ${f(yy + hh * .45)}), vec2(${f(hw)}, .0035))));` : ''} }`);
        break;
      }
      case 'placket': td.push(`over(c, ${INK}, .6 * fill(abs(p.x - ${f(L.x ?? 0)}) - .0035) * step(p.y, ${f(Y(L.to ?? .75))}));`); break;
      case 'suspenders': {
        const C = L.color || '#33262c', x = X(L.x ?? .45, .4), D = vec(L.dash || '#b9aca8');
        tc.push(`if (abs(abs(p.x) - ${f(x)}) < .0375 || abs(abs(b.x) - ${f(x * .8)}) < .0375) cl = ${vec(C)};`);
        cover = `step(abs(abs(p.x) - ${f(x)}), .0375) + step(abs(abs(b.x) - ${f(x * .8)}), .0375)`;
        td.push(`over(c, ${D}, .85 * fill(abs(abs(p.x) - ${f(x)}) - .003) * step(.4, fract(p.y / .05)));`);
        break;
      }
      case 'pattern': tc.push(pattern(L)); break; // over the whole torso as painted so far
      default: console.warn('outfit: unknown layer', L.t);
    }
    spans.push({ from: t0, to: td.length, cover });
  }
  {
    const out = [];
    spans.forEach((sp, i) => {
      const later = spans.slice(i + 1).map(s => s.cover).filter(Boolean);
      const lines = td.slice(sp.from, sp.to).join('\n');
      if (!lines) return;
      out.push(later.length ? `if (${later.map(c => `(${c})`).join(' + ')} < .5) {\n${lines}\n}` : lines);
    });
    out.push(...td.slice(spans.length ? spans[spans.length - 1].to : 0), ...tdTop);
    td.length = 0; td.push(...out);
  }
  // hem line: a dark line along the cut edge of a garment over a pelvis band
  if (S.pelvis) td.push(`over(c, ${INK}, .8 * fill(p.y - .009));`);

  // ---- skirt
  let skirtDef = null;
  if (sk) {
    const len = typeof sk.length === 'number' ? sk.length : sk.length === 'knee' ? (O._legLen ?? 1.2) * .52 : (O._legLen ?? 1.2) * .86;
    const yTop = S.pelvis ? .02 : Math.max(S.bottom + .12, .06), yb = yTop - len;
    const r0 = (S.pelvis ? S.pelvis.hw(0) : S.hw(yTop)) + .012, r1 = r0 * (sk.flare ?? 1.35), e = sk.shape === 'bell' ? .55 : 1;
    skirtDef = { yTop, yb, r0, r1, e, depthRatio: sk.depthRatio ?? 1.05, power: sk.power ?? 2.2, zOff: sk.zOff ?? .07 };
    const C = sk.color;
    sc.push(`cl = ${vec(C)}; ${pattern(sk.pattern)}`);
    if (sk.pleats) { // pleats: thin darker lines that fan out with the bell; spacing = circumference / n
      const rr = `(${f(r0)} + ${f(r1 - r0)} * pow(clamp((${f(yTop)} - p.y) / ${f(len)}, 0., 1.), ${f(e)}))`;
      sc.push(`{ float per = 6.2832 * ${rr} / ${f(sk.pleats)}; over(cl, ${vec(shadeHex(C, .72))}, .8 * fill(abs(mod(p.x, per) - per * .5) - .0035) * smoothstep(${f(yTop - .05)}, ${f(yTop - .15)}, p.y)); }`);
    }
    if (sk.apron) {
      const A = sk.apron, ab = yTop - len * A.to;
      const ad = `max(abs(p.x) - ${f(A.aw)} * (1. + .18 * clamp((${f(yTop)} - p.y) / ${f(len)}, 0., 1.)), ${f(ab)} - p.y)`;
      sc.push(`if (${ad} < 0.) cl = ${vec(A.C)};`);
      sd.push(`over(c, ${INK}, fill(abs(${ad}) - .0055));`);
      sd.push(`{ float d = box(p, vec2(${f(A.aw * .35)}, ${f(yTop - len * .32)}), vec2(.085, .065)); over(c, ${INK}, fill(abs(d) - .0042)); over(c, ${INK}, fill(box(p, vec2(${f(A.aw * .35)}, ${f(yTop - len * .32 + .05)}), vec2(.085, .003)))); }`);
      // the bow's two tails hanging down the back
      for (const sg of [-1, 1]) sd.push(`{ float d = max(abs(b.x - ${f(sg * .03)} - (${f(yTop)} - p.y) * ${f(sg * .10)}) - .022, p.y - ${f(yTop + .02)}); d = max(d, ${f(yTop - len * .38)} - p.y); over(c, ${INK}, fill(d - .005)); over(c, SH(${vec(A.C)}, kb), fill(d)); }`);
    }
    // the waistband seam and the hem: ink
    sd.push(`over(c, ${INK}, fill(p.y - ${f(yb + .012)}));`);
    sd.push(`over(c, ${INK}, .7 * fill(abs(p.y - ${f(yTop - .05)}) - .003));`);
  }
  const torso = `${tc.join('\n')}\nvec3 c = SH(cl, kb);\nc = mix(c, mix(cl, vec3(1.), .55), RIMON * RIMK(cl) * smoothstep(.80, .92, kb) * (1. - smoothstep(.96, .995, kb)) * smoothstep(${f(Y(.3))}, ${f(Y(.55))}, p.y));\n${td.join('\n')}`;
  const skirt = sk ? `${sc.join('\n')}\nvec3 c = SH(cl, kb);\nc = mix(c, mix(cl, vec3(1.), .5), RIMON * RIMK(cl) * smoothstep(.80, .92, kb) * (1. - smoothstep(.96, .995, kb)) * .6);\n${sd.join('\n')}` : null;
  const trousers = O.trousers || '#4a3f4a';
  return { decl: DECL, torso, skirt, skirtDef, trousers, trousersDark: darkOf(trousers), ink: O.ink || '#3a2a33', rim: O.rim ?? 1 };
}

export default { shapeOf, compileOutfit, BUILDS };
