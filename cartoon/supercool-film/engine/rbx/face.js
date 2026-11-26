// engine/rbx/face.js (Roblox V3, WP-C2): the charsys face AS IS on a Roblox head.
// The drawing is engine/face.js faceTriangles() of a faceset.js state (kit.json eyes / brow / mouth, visemes, blinks: the same names,
// the same snaps, facetime.js times them). Roblox changes only: eyes spread wider, the whole decal 1.25x, near-black ink, a dark red
// mouth inside, white teeth / sclera, one small highlight in open eyes. The decal is wrapped round the head's cylinder (u = arc length,
// v straight down), subdivided so it follows the curve, and sits 1.5 mm proud of the skin.
// gruss's V1 goofy faces (experiments/roblox-style/engine/faces, FACES.md) are named expressions in the same hand: kit parts where the
// kit has the drawing, plus flat fill + bold ink extras (tears, blush, sweat, moustache, spiral / heart / star eyes, glasses, teeth).
// A goofy name may ride ANY face channel; put it on `brow` so blinks (eyes) and talk (mouth visemes) still play over it:
//   pose.face = { brow: 'kid_cry' }            -> the V1 kid_cry face, blinks close its eyes, visemes replace its mouth while talking.
//   pose.face = { eyes: 'wide', brow: 'up', mouth: 'o' }  -> plain charsys names, as in FACE_API.md.
// API: createRbxFace(head, spec) -> { mesh, glow, update(faceChannel, opts), stateOf(faceChannel) }; GOOFY (names); RBX_PAL.
import * as THREE from '../three.js';
import { faceTriangles } from '../face.js';
import { faceState, kit, kitReady } from '../faceset.js';

export const RBX_PAL = { ink: 0x1c1c22, maroon: 0x5c1420, tongue: 0xe2607a, white: 0xffffff, eye: 0x1c1c22 };
const KIT_MAROONS = new Set([0x55202f, 0x3a1f26]);       // the kit's own mouth insides -> the Roblox dark red
const SCALE = 1.25;                                     // decal size on the head (plan: big eyes low on a wide head)
const SPREAD = 1.34;                                    // eye half spacing x this (charsys .227 R -> .304 R before SCALE)
const EU = .227, EV = .03, MV = .382;                   // kit anchors (decal R units): eye centre u, eye v, mouth v
const E = EU * SPREAD;                                  // where custom eyes sit (already spread)
const MAX_EDGE = .04;

// ---------- custom shapes in the same hand (flat fill, bold ink) ----------
const tri = (o, a, b, c, col) => o.push(a, b, c, col);
function fan(o, poly, col) { let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length; for (let i = 0; i < poly.length; i++) tri(o, [cx, cy], poly[i], poly[(i + 1) % poly.length], col); }
const ellPts = (cu, cv, rx, ry, tilt = 0, n = 40) => { const c = Math.cos(tilt), s = Math.sin(tilt), P = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a); P.push([cu + x * c - y * s, cv + x * s + y * c]); } return P; };
const ell = (o, cu, cv, rx, ry, col, tilt = 0) => fan(o, ellPts(cu, cv, rx, ry, tilt), col);
// a bold ink line through points (round joints), width w
function line(o, pts, w, col) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-6, nx = -dy / l * w / 2, ny = dx / l * w / 2;
    tri(o, [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], col); tri(o, [a[0] + nx, a[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny], col);
  }
  for (const p of pts) fan(o, ellPts(p[0], p[1], w / 2, w / 2, 0, 12), col);
}
const bez = (P, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, m = 1 - t; return [m * m * P[0][0] + 2 * m * t * P[1][0] + t * t * P[2][0], m * m * P[0][1] + 2 * m * t * P[1][1] + t * t * P[2][1]]; });
// a filled shape with an ink outline
function inked(o, poly, fill, w = .04) { fan(o, poly, fill); line(o, [...poly, poly[0]], w, 'ink'); }
const both = f => [-1, 1].forEach(s => f(s));       // s = -1 left eye (viewer's left), +1 right

// eye kinds
const ringEye = (o, s, r = .15, pupil = .05, fill = 'white', v = EV, du = 0) => { ell(o, s * E + du, v, r, r * 1.08, 'ink'); ell(o, s * E + du, v, r - .04, r * 1.08 - .04, fill); ell(o, s * E + du, v + .005, pupil, pupil * 1.08, 'ink'); ell(o, s * E + du + pupil * .35, v - pupil * .4, pupil * .3, pupil * .3, 'white'); };
const dotEye = (o, s, r = .06, v = EV) => { ell(o, s * E, v, r, r * 1.25, 'ink'); ell(o, s * E + r * .35, v - r * .45, r * .3, r * .3, 'white'); };
const brow = (o, s, tilt, v = -.16, len = .15, w = .055) => line(o, [[s * E - len, v - s * tilt * len * 0 + (s < 0 ? tilt : -tilt) * len * -1], [s * E + len, v + (s < 0 ? tilt : -tilt) * len]].map(p => p), w, 'ink');
// tilt > 0 = angry (inner ends down), < 0 = worried (inner ends up)
const browT = (o, s, tilt, v = -.17, len = .14, w = .058) => { const inner = [s * E - s * len, v + tilt * len], outer = [s * E + s * len, v - tilt * len]; line(o, [inner, outer], w, 'ink'); };
const tears = (o, len = .32) => both(s => { const u = s * E; fan(o, [[u - .045, EV + .08], [u + .045, EV + .08], [u + .055, EV + .08 + len], [u - .055, EV + .08 + len]], '#59b8f0'); ell(o, u, EV + .08 + len, .055, .03, '#59b8f0'); });
const drop = (o, u, v, r = .045, col = '#59b8f0') => { fan(o, [[u, v - r * 2.2], ...ellPts(u, v, r, r, 0, 20).filter(p => p[1] >= v - r * .2)], col); ell(o, u, v, r, r, col); ell(o, u - r * .3, v - r * .1, r * .3, r * .35, 'white'); };
const blush = o => both(s => ell(o, s * (E + .07), MV - .1, .1, .05, '#ff8fa3'));
const heart = (o, cu, cv, r, col) => { const P = []; for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); P.push([cu + x / 16 * r, cv - y / 16 * r]); } inked(o, P, col, .035); ell(o, cu - r * .35, cv - r * .35, r * .18, r * .14, 'white'); };
const star = (o, cu, cv, r, col) => { const P = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .32 : r; P.push([cu + rr * Math.cos(a), cv + rr * Math.sin(a)]); } fan(o, P, col); };
function spiral(o, cu, cv, r) { ell(o, cu, cv, r, r, 'ink'); ell(o, cu, cv, r - .03, r - .03, '#d81c1c'); const P = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 6, rr = (r - .05) * i / 60; P.push([cu + rr * Math.cos(a), cv + rr * Math.sin(a)]); } line(o, P, .022, 'ink'); }
const glassesFlat = (o, square, fill = '#dfe9f5') => { both(s => { const P = square ? [[s * E - .15, EV - .11], [s * E + .15, EV - .11], [s * E + .15, EV + .11], [s * E - .15, EV + .11]] : ellPts(s * E, EV, .16, .15); inked(o, P, fill, .055); }); line(o, [[-E + .15, EV - .02], [E - .15, EV - .02]], .045, 'ink'); };
const moustache = (o, curly) => { const v = MV - .1, P = []; for (let i = 0; i <= 20; i++) { const t = i / 20, u = -.3 + .6 * t, bump = Math.sin(t * Math.PI); P.push([u, v + .03 - .07 * bump + (curly ? 0 : .02 * Math.abs(Math.sin(t * Math.PI * 4)))]); } for (let i = 20; i >= 0; i--) { const t = i / 20, u = -.3 + .6 * t; P.push([u, v + .06 - .03 * Math.sin(t * Math.PI) + .03 * (Math.abs(u) > .22 ? 1 : 0)]); } fan(o, P, 'ink'); if (curly) both(s => line(o, bez([[s * .3, v + .06], [s * .42, v + .02], [s * .37, v - .05]], 10), .04, 'ink')); };
const openMouth = (o, w = .26, h = .2, v = MV - .02, teeth = 'top', tongue = false) => { const P = [[-w, v - h * .4], [w, v - h * .4], [w * .55, v + h * .6], [-w * .55, v + h * .6]]; inked(o, P, 'maroon', .05); if (teeth === 'top') fan(o, [[-w + .04, v - h * .4 + .02], [w - .04, v - h * .4 + .02], [w - .07, v - h * .4 + .08], [-w + .07, v - h * .4 + .08]], 'white'); if (tongue) ell(o, 0, v + h * .45, w * .4, h * .22, 'tongue'); };
const jagged = (o, w = .3, v = MV, h = .14, glowTeeth = false) => { const P = [[-w, v - h], [w, v - h]]; for (let i = 0; i <= 10; i++) P.push([w - 2 * w * i / 10, v + h * (i % 2 ? .35 : 1)]); fan(o, ellPts(0, v, w + .03, h + .05), 'ink'); for (let i = 0; i < 7; i++) { const u = -w + .05 + i * (2 * w - .1) / 6; fan(o, [[u - .035, v - h * .7], [u + .035, v - h * .7], [u, v - h * .05]], glowTeeth ? 'white' : 'white'); fan(o, [[u - .035, v + h * .7], [u + .035, v + h * .7], [u, v + h * .1]], 'white'); } };
const smileArc = (o, w = .2, d = .09, v = MV - .03, lw = .05) => line(o, bez([[-w, v], [0, v + d * 2], [w, v]]), lw, 'ink');
const frownArc = (o, w = .16, d = .06, v = MV + .02, lw = .05) => line(o, bez([[-w, v + d], [0, v - d], [w, v + d]]), lw, 'ink');
const wavy = (o, w = .12, v = MV) => line(o, Array.from({ length: 13 }, (_, i) => [-w + 2 * w * i / 12, v + .02 * Math.sin(i / 12 * Math.PI * 3)]), .035, 'ink');

// ---------- gruss's V1 faces: { k: kit names (any missing -> the channel's own), x: custom extras, eyes: 'custom' drops the kit eyes } ----------
// Every entry is his FACES.md face, redrawn in the charsys hand. Alias names from FACES.md (smug, shocked, sob, ...) point at them.
export const GOOFY = {
  leo_smug:      { k: { eyes: 'smug', brow: 'down', mouth: 'smirk' } },
  blonde_smug:   { k: { brow: 'off', mouth: 'smile' }, eyes: 'custom', x: o => { both(s => { fan(o, [[s * E - .08, EV - .07], [s * E + .08, EV - .07], [s * E + .07, EV + .08], [s * E - .07, EV + .08]], 'ink'); ell(o, s * E + .025, EV - .01, .022, .022, 'white'); }); browT(o, -1, .05, -.16); browT(o, 1, -.12, -.2); } },
  bug_eyes:      { k: { brow: 'off', mouth: 'frown' }, eyes: 'custom', x: o => both(s => { ringEye(o, s, .17, .045, '#b9cbe6'); line(o, bez([[s * E - .14, EV + .2], [s * E, EV + .25], [s * E + .14, EV + .2]], 8), .035, 'ink'); }) },
  classic_smile: { k: { eyes: 'open', brow: 'off', mouth: 'rest' }, x: o => smileArc(o, .24, .1, MV - .06, .055), noMouth: true },
  dad_moustache: { k: { eyes: 'open', brow: 'down', mouth: 'flat' }, x: o => moustache(o, false) },
  derp_o:        { k: { eyes: 'wide', brow: 'off', mouth: 'gulp' } },
  dion_smirk:    { k: { eyes: 'smug', brow: 'off', mouth: 'rest' }, noMouth: true, x: o => line(o, [[-.09, MV - .05], [0, MV + .07], [.09, MV - .05]], .06, 'ink') },
  glasses_frown: { k: { eyes: 'open', brow: 'down', mouth: 'frown' }, x: o => glassesFlat(o, false) },
  glasses_worry: { k: { brow: 'worried', mouth: 'rest' }, eyes: 'custom', noMouth: true, x: o => { glassesFlat(o, false, '#ffffff'); both(s => dotEye(o, s, .04)); wavy(o); } },
  goofy_tongue:  { k: { eyes: 'open', brow: 'off' }, noMouth: true, x: o => openMouth(o, .24, .2, MV - .02, 'none', true) },
  happy_derp:    { k: { brow: 'off' }, eyes: 'custom', noMouth: true, x: o => { ringEye(o, -1, .09, .035, '#c7e6f7', EV + .03); ringEye(o, 1, .12, .04, '#c7e6f7', EV - .02); openMouth(o, .24, .22, MV - .02, 'none', true); } },
  kid_cry:       { k: { eyes: 'arc', brow: 'worried', mouth: 'wide' }, x: o => tears(o, .3) },
  meme_man:      { k: { brow: 'off' }, eyes: 'custom', noMouth: true, x: o => { both(s => { ringEye(o, s, .09, .035); line(o, bez([[s * E - .09, EV - .14], [s * E, EV - .19], [s * E + .09, EV - .14]], 8), .03, 'ink'); }); inked(o, ellPts(0, MV, .11, .045), 'white', .045); } },
  mom_rage:      { k: { eyes: 'angry', brow: 'knit', mouth: 'grid' }, x: o => { line(o, [[-.04, -.3], [.04, -.22]], .03, 'ink'); line(o, [[.04, -.3], [-.04, -.22]], .03, 'ink'); } },
  mom_teeth:     { k: { brow: 'knit' }, eyes: 'custom', noMouth: true, x: o => { both(s => ringEye(o, s, .16, .04, '#b9cbe6')); fan(o, [[.04, MV + .08], [.3, MV - .04], [.32, MV + .1]], 'ink'); for (let i = 0; i < 3; i++) fan(o, [[.09 + i * .07, MV + .065 - i * .03], [.15 + i * .07, MV + .035 - i * .03], [.13 + i * .07, MV + .07 - i * .03]], 'white'); } },
  moustache_sad: { k: { eyes: 'open', brow: 'worried', mouth: 'frown' }, x: o => drop(o, E + .02, EV + .2) },
  noob_angry:    { k: { eyes: 'angry', brow: 'knit', mouth: 'frown' } },
  noob_unamused: { k: { eyes: 'smug', brow: 'off', mouth: 'flat' } },
  noob_yell:     { k: { eyes: 'open', brow: 'knit', mouth: 'wide' } },
  o_eyes:        { k: { brow: 'off', mouth: 'gulp' }, eyes: 'custom', x: o => both(s => { ell(o, s * E, EV - .02, .14, .19, 'ink'); ell(o, s * E, EV - .02, .105, .155, 'white'); ell(o, s * E + s * .01, EV + .02, .075, .1, 'ink'); }) },
  squint_frown:  { k: { eyes: 'wince', brow: 'knit', mouth: 'frown' } },
  squint_mad:    { k: { eyes: 'angry', brow: 'quizzical', mouth: 'frown' } },
  sweat:         { k: { brow: 'worried', mouth: 'rest' }, eyes: 'custom', noMouth: true, x: o => { both(s => ringEye(o, s, .14, .05)); drop(o, -E - .17, EV + .15, .035); drop(o, -E - .12, EV + .27, .03); wavy(o, .1); } },
  teary:         { k: { brow: 'worried', mouth: 'frown' }, eyes: 'custom', x: o => both(s => { ell(o, s * E, EV, .15, .16, 'ink'); ell(o, s * E, EV, .12, .13, 'white'); ell(o, s * E, EV + .01, .09, .1, '#2f7fe0'); ell(o, s * E, EV + .015, .045, .05, 'ink'); ell(o, s * E - .04, EV - .04, .035, .035, 'white'); ell(o, s * E + .04, EV + .05, .018, .018, 'white'); drop(o, s * E, EV + .26, .035); }) },
  mom_red_eyes:  { k: { brow: 'knit', mouth: 'rest' }, eyes: 'custom', noMouth: true, x: o => { both(s => spiral(o, s * E, EV, .15)); line(o, [[-.2, MV + .04], [.2, MV - .04]], .05, 'ink'); } },
  girl_o:        { k: { brow: 'off', mouth: 'gulp' }, eyes: 'custom', x: o => both(s => { ell(o, s * E, EV, .15, .16, 'ink'); ell(o, s * E, EV, .115, .125, 'white'); star(o, s * E, EV, .08, 'ink'); }) },
  sis_scared:    { k: { brow: 'worried' }, eyes: 'custom', noMouth: true, x: o => { both(s => ringEye(o, s, .16, .04)); const P = [[-.22, MV], [-.08, MV - .07], [.08, MV - .07], [.22, MV], [.08, MV + .06], [-.08, MV + .06]]; inked(o, P, 'maroon', .045); fan(o, [[-.15, MV - .02], [.15, MV - .02], [.12, MV + .02], [-.12, MV + .02]], 'white'); } },
  mannequin_scream: { k: { brow: 'knit' }, eyes: 'custom', noMouth: true, x: o => { both(s => { ell(o, s * E, EV, .1, .13, 'ink'); ell(o, s * E + .02, EV - .02, .035, .04, 'white'); }); ell(o, 0, MV + .05, .1, .17, 'ink'); ell(o, 0, MV + .1, .065, .08, '#d63a3a'); } },
  dad_shock:     { k: { brow: 'worried' }, eyes: 'custom', noMouth: true, x: o => { both(s => ringEye(o, s, .12, .04)); moustache(o, false); ell(o, 0, MV + .08, .07, .09, 'ink'); } },
  nerd:          { k: { brow: 'off' }, eyes: 'custom', noMouth: true, x: o => { glassesFlat(o, false, '#ffffff'); both(s => dotEye(o, s, .05)); smileArc(o, .2, .08, MV - .04); inked(o, [[-.05, MV + .04], [.05, MV + .04], [.05, MV + .11], [-.05, MV + .11]], 'white', .03); line(o, [[0, MV + .04], [0, MV + .11]], .025, 'ink'); } },
  evil:          { k: { eyes: 'arc', brow: 'knit' }, noMouth: true, x: o => jagged(o, .26, MV + .02, .11) },
  monster:       { k: { brow: 'off' }, eyes: 'custom', noMouth: true, glow: true, x: o => { both(s => { fan(o, [[s * E - s * .14, EV - .08], [s * E + s * .14, EV - .03], [s * E + s * .1, EV + .07], [s * E - s * .1, EV + .06]], 'glow'); ell(o, s * E, EV + .005, .05, .025, 'glowcore'); }); jagged(o, .32, MV + .05, .12); } },
  love:          { k: { brow: 'off' }, eyes: 'custom', noMouth: true, x: o => { both(s => heart(o, s * E, EV, .13, '#e8283c')); blush(o); smileArc(o, .14, .06, MV - .02); } },
};
// FACES.md aliases (= his V1 names) + gate expressions not in the kit
const GOOFY_ALIAS = { nervous: 'bug_eyes', smile: 'classic_smile', moustache: 'dad_moustache', shocked: 'derp_o', neutral: 'glasses_frown', worried: 'glasses_worry',
  grin: 'goofy_tongue', happy: 'happy_derp', sob: 'kid_cry', smug: 'leo_smug', cry: 'moustache_sad', furious: 'mom_rage', angry: 'noob_angry', sleepy: 'noob_unamused',
  scream: 'noob_yell', surprised: 'o_eyes', scared: 'sweat', sad: 'teary' };
const goofyOf = n => n && (GOOFY[n] ? n : GOOFY_ALIAS[n] && !isKitName(n) ? GOOFY_ALIAS[n] : null);
const isKitName = n => { const K = kit(); return !!K && (n in K.eyes || n in K.brow || n in K.mouth); };
// Extras any face may carry: pose.face.fx = ['tears', 'blush', 'sweat', 'shine', 'glint'] (or spec.face.fx for a standing look)
const FX = { tears: o => tears(o, .26), blush, sweat: o => drop(o, -E - .17, EV + .1, .04), shine: o => both(s => { ell(o, s * E - .035, EV - .04, .03, .03, 'white'); ell(o, s * E + .04, EV + .05, .016, .016, 'white'); }),
  glint: o => both(s => fan(o, [[s * E - .1, EV - .08], [s * E - .04, EV - .1], [s * E + .06, EV + .06], [s * E, EV + .08]], 'white')),
  moustache_big: o => moustache(o, false), moustache_curly: o => moustache(o, true),
  beard_long: o => { const P = [[-.36, MV - .12], [-.22, MV + .08], [.22, MV + .08], [.36, MV - .12], [.3, MV + .45], [0, MV + .62], [-.3, MV + .45]]; inked(o, P, 'hair', .05); },
  mask: o => { const P = [[-.4, MV - .2], [.4, MV - .2], [.36, MV + .2], [0, MV + .3], [-.36, MV + .2]]; inked(o, P, '#a8d8ef', .04); for (const d of [-.08, 0, .08]) line(o, [[-.3, MV - .08 + d], [.3, MV - .08 + d]], .018, '#6aaed0'); both(s => line(o, [[s * .4, MV - .17], [s * .62, MV - .3]], .03, '#e9f4fa')); } };

// ---------- the state: kit drawing + Roblox changes ----------
const VIS = n => typeof n === 'string' && n.startsWith('v_');
/** The resolved drawing for a face channel: { tris: [a, b, c, col, ...] in decal R units (before SCALE) }. */
export function stateOf(ch = {}, spec = {}) {
  const sf = spec.face || {};
  // spec.face.default (the character's V1 standing face) plays whenever the channel only holds the neutral defaults (compose always
  // writes eyes / brow / mouth): open or blinking eyes, brow 'on', mouth at rest or talking. Any keyed expression wins over it.
  const neutral = (!ch.brow || ch.brow === 'on') && (!ch.eyes || ['open', 'blink', 'half'].includes(ch.eyes)) && (!ch.mouth || ch.mouth === 'rest' || VIS(ch.mouth));
  const g = goofyOf(ch.brow) || goofyOf(ch.eyes) || goofyOf(ch.mouth) || (neutral ? goofyOf(sf.default) : null);
  const G = g ? GOOFY[g] : null;
  const pick = (part, dflt) => { const n = ch[part]; return n && !goofyOf(n) ? n : dflt; };
  let names;
  const blinking = ch.eyes === 'blink' || ch.eyes === 'half';
  const talking = VIS(ch.mouth) && ch.mouth !== 'v_rest' || (VIS(ch.mouth) && G?.noMouth !== true && false);
  if (G) {
    names = { eyes: blinking ? ch.eyes : (G.k.eyes || pick('eyes', 'open')), brow: G.k.brow || 'on', mouth: VIS(ch.mouth) ? ch.mouth : (G.k.mouth || 'rest') };
  } else names = { eyes: pick('eyes', 'open'), brow: pick('brow', 'on'), mouth: pick('mouth', 'rest') };
  const st = faceState(names, { id: spec.id, ...sf.kit });
  const kitTris = faceTriangles({ ...st, extras: st.extras || [] }, { ...RBX_PAL, eye: sf.eyeColor ?? RBX_PAL.eye });
  const out = [];
  const customEyes = G && G.eyes === 'custom' && !blinking;
  const dropMouth = G && G.noMouth && !VIS(ch.mouth);
  // kit triangles: eye zone (v < .2) moved out to the Roblox spacing; dropped where a goofy face draws its own
  for (let i = 0; i < kitTris.length; i += 4) {
    const a = kitTris[i], b = kitTris[i + 1], c = kitTris[i + 2], cv = (a[1] + b[1] + c[1]) / 3, cu = (a[0] + b[0] + c[0]) / 3;
    const eyeZone = cv < .2;
    if (eyeZone && customEyes && !isBrowTri(st, cv)) continue;
    if (!eyeZone && dropMouth) continue;
    const du = eyeZone ? Math.sign(cu || 1) * (SPREAD - 1) * EU : 0;
    out.push([a[0] + du, a[1]], [b[0] + du, b[1]], [c[0] + du, c[1]], kitTris[i + 3]);
  }
  if (G?.x && !(blinking && G.eyes === 'custom' && false)) {
    const o = []; G.x(o);
    if (blinking && G.eyes === 'custom') { for (let i = 0; i < o.length; i += 4) { const cv = (o[i][1] + o[i + 1][1] + o[i + 2][1]) / 3; if (cv > .2 || cv < -.13) out.push(o[i], o[i + 1], o[i + 2], o[i + 3]); } }
    else if (VIS(ch.mouth) && G.noMouth) { for (let i = 0; i < o.length; i += 4) { const cv = (o[i][1] + o[i + 1][1] + o[i + 2][1]) / 3; if (cv < .25) out.push(o[i], o[i + 1], o[i + 2], o[i + 3]); } }
    else out.push(...o);
  }
  // Roblox highlight in open solid eyes (the kit's 'open' ovals and the smug / sad eggs)
  if (!customEyes && (names.eyes === 'open' || names.eyes === 'smug' || names.eyes === 'look_l' || names.eyes === 'look_r' || names.eyes === 'sad' || names.eyes === 'stare')) {
    for (const s of [-1, 1]) {
      const egg = names.eyes === 'open' || names.eyes === 'stare' ? st.extras?.find(e => Math.sign(e.ell[0]) === s && e.ell[2] > .05 && e.ell[1] < .2) : null;
      const d = st.dome?.[s < 0 ? 0 : 1];
      const cu = egg ? egg.ell[0] : d ? d[0] : null, cv = egg ? egg.ell[1] - .035 : d ? d[1] + .015 : null;
      if (cu != null) { const o = []; ell(o, cu + s * (SPREAD - 1) * EU + .03, cv, .028, .03, 'white'); out.push(...o); }
    }
  }
  for (const f of [...(sf.fx || []), ...(ch.fx || [])]) if (FX[f]) FX[f](out);
  if (spec.facial?.style && FX[spec.facial.style]) FX[spec.facial.style](out);
  if (spec.mask) FX.mask(out);
  return { tris: out, glow: !!G?.glow, name: g || null, names };
}
// the kit's brows sit above v -.1; custom-eye faces keep the kit brow named in k.brow
function isBrowTri(st, cv) { return cv < -.09 && !!st.brow?.[0]; }

// ---------- onto the head ----------
function subdivide(tris, maxEdge) {
  const m2 = maxEdge * maxEdge, long = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 > m2, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out = [], stack = [];
  for (let i = tris.length - 4; i >= 0; i -= 4) stack.push([tris[i], tris[i + 1], tris[i + 2], tris[i + 3]]);
  while (stack.length) {
    const [a, b, c, col] = stack.pop(), ab = long(a, b), bc = long(b, c), ca = long(c, a);
    if (!ab && !bc && !ca) { out.push(a, b, c, col); continue; }
    const mab = ab && mid(a, b), mbc = bc && mid(b, c), mca = ca && mid(c, a), n = ab + bc + ca;
    let parts;
    if (n === 3) parts = [[a, mab, mca], [mab, b, mbc], [mca, mbc, c], [mab, mbc, mca]];
    else if (n === 1) parts = ab ? [[a, mab, c], [mab, b, c]] : bc ? [[a, b, mbc], [a, mbc, c]] : [[a, b, mca], [mca, b, c]];
    else if (!ab) parts = [[a, b, mbc], [a, mbc, mca], [mca, mbc, c]];
    else if (!bc) parts = [[mab, b, c], [a, mab, mca], [mab, c, mca]];
    else parts = [[a, mab, mbc], [mab, b, mbc], [a, mbc, c]];
    for (let i = parts.length - 1; i >= 0; i--) stack.push([...parts[i], col]);
  }
  return out;
}

/** The face layer on a Roblox head (engine/rbx/head.js). head.surface(theta, y) -> [x, y, z] skin point; head.R = radius (D);
 *  head.eyeY = where the decal's origin (between the eyes) sits. update(pose.face, { gazeU }) snaps to the drawing for that channel. */
export function createRbxFace(head, spec = {}) {
  const C = new THREE.Color(), hair = new THREE.Color(spec.facial?.color || spec.hair?.color || '#3a2a20');
  const colors = { ink: RBX_PAL.ink, white: RBX_PAL.white, maroon: RBX_PAL.maroon, tongue: RBX_PAL.tongue, hair: hair.getHex(), glow: 0xff2a1a, glowcore: 0xfff0c8 };
  const mat = (head.material || ((h, k, o) => new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })))(0xffffff, 'face', { vertexColors: true, polygonOffset: -2, side: THREE.DoubleSide });
  const gmat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat), glow = new THREE.Mesh(new THREE.BufferGeometry(), gmat);
  // V4-HF (gruss V3 item 2, flicker): the decal's colour layers used to be stacked .5 mm apart by colour run, capped at 14 runs, so busy
  // faces had coplanar layers and close layers fought in the depth buffer as the head moved. Now every layer sits on ONE shell (.0025 D
  // proud of the skin) and the decal writes no depth: inside one draw call the GPU paints triangles in order, so later layers (pupil,
  // highlight, tears) always cover earlier ones (white, ink ring) with no depth test between them. It still tests against the skin and
  // anything in front (hands, props). Draw order: skin, face (1), glow (2), then hair / hats (3, head.js) so hair covers the brows.
  const V3 = !!globalThis.__rbxFaceV3;   // lab only: the V3 layering, for before/after measurements (lab/rbx/v4hf)
  if (!V3) for (const m of [mat, gmat]) { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  mesh.name = 'rbxFace'; glow.name = 'rbxFaceGlow'; mesh.renderOrder = 1; glow.renderOrder = 2; mesh.userData.noOutline = glow.userData.noOutline = true;
  head.group.add(mesh, glow);
  const unit = head.R * SCALE * (spec.face?.scale ?? 1);    // one decal R unit in D
  const cache = new Map();
  let last = null;
  function geoOf(key, ch, gazeU) {
    let g = cache.get(key);
    if (g) return g;
    const st = stateOf(ch, spec), tris = subdivide(st.tris, MAX_EDGE);
    const P = [[], []], Cc = [[], []], N = [[], []]; let layer = 0, lastCol = null;   // one shell, painted in triangle order (see the material note above)
    for (let i = 0; i < tris.length; i += 4) {
      const col = tris[i + 3]; if (V3 && col !== lastCol) { layer++; lastCol = col; }
      const isGlow = col === 'glow' || col === 'glowcore';
      const hex = typeof col === 'number' ? col : (colors[col] ?? (typeof col === 'string' && col[0] === '#' ? new THREE.Color(col).getHex() : RBX_PAL.ink));
      C.setHex(KIT_MAROONS.has(hex) ? RBX_PAL.maroon : hex);
      const k = isGlow ? 1 : 0;
      for (let j = 0; j < 3; j++) {
        const [u, v] = tris[i + j];
        const eye = v < .2 ? gazeU : 0;
        const p = head.surface((u + eye) * unit / head.R, head.eyeY - v * unit, .0025 + k * .0005 + (V3 ? Math.min(layer, 14) * .0005 : 0));
        P[k].push(p[0], p[1], p[2]); N[k].push(p[3], p[4], p[5]); Cc[k].push(C.r, C.g, C.b);
      }
    }
    g = P.map((p, k) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(N[k], 3)); b.setAttribute('color', new THREE.Float32BufferAttribute(Cc[k], 3)); b.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(p.length / 3).fill(1), 1)); return b; });
    if (cache.size > 40) { const [k0, v0] = cache.entries().next().value; cache.delete(k0); v0.forEach(b => b.dispose()); }
    cache.set(key, g);
    return g;
  }
  const api = {
    mesh, glow,
    update(ch = {}, opts = {}) {
      // V4-HF: gaze in steps of 1/400 (was 1/50 = .01 D: a look target near a step edge made the eyes jump back and forth a step)
      const gz = Math.round((opts.gazeU || 0) * 400) / 400;
      const key = JSON.stringify([ch.eyes, ch.brow, ch.mouth, ch.fx, gz]);
      if (key === last) return;
      last = key;
      const [a, b] = geoOf(key, ch, gz);
      mesh.geometry = a; glow.geometry = b;
    },
    stateOf: ch => stateOf(ch, spec),
  };
  api.update({});
  return api;
}
export { kitReady };
