// Character drawing kit (Canvas2D). One fixed style, endless combinations.
// Design space: canvas 640 x 1024, soles on y = BASE, total figure height T design px.
// Style: flat capsule body, round head (face about 22-30 % of the height: adult 3.5 head heights),
// thin black stick limbs with ball hands, big round eyes, one even near-black outline.
// Outline and limb widths are given per frame in SCREEN pixels (settings.ink_px, limbs 14-20 px at 1080
// wide) and converted to card pixels by the caller, so every character keeps the same line on screen.
import { shadeHex, mixHex } from "../core/util.js";

export const CW = 640, CH = 1024, BASE = 1000, T = 860;
export const INK = "#16121a";
// per-draw state set by drawFigure: outline scale (1 = 9 card px) and limb width in card px
let INKS = 1, LIMB = 14;

export const PALETTE = {
  skin: ["#fffaf0", "#fbf3e4", "#f8ead6", "#f9e4d0", "#f5ddc4", "#fffdf8"], // cream and white heads: identity comes from clothes and features, not skin colour
  hair: ["#2b1d1a", "#4b2f22", "#76482a", "#b8743c", "#d9a95a", "#e9cf8f", "#8e8a86", "#ece8e2"],
  cloth: ["#d9473a", "#3b6fd2", "#e7b53a", "#4c9a52", "#2aa39f", "#7b52b3", "#e07a2e", "#df6a8f", "#8a5a36", "#2f3f7a", "#ece5d6", "#6f737c", "#a8323a", "#3f8a8a", "#c7a24a", "#5a6d3a"],
  pants: ["#2f3f7a", "#3c3438", "#5a4636", "#6f737c", "#2a5a7a", "#7a5a3a", "#3a4a2a"],
};

export const EXPRESSIONS = ["neutral", "happy", "grin", "laugh", "surprised", "shocked", "worried", "sad", "angry", "smug", "confused", "thinking", "sleepy", "determined"];
export const ARM_POSES = ["idle", "wave", "point", "armsUp", "shrug", "hips", "hold", "think", "cross", "reach", "clap", "facepalm"];

// ---------- low-level pen ----------
function inked(g, pathFn, fill, w, shadowOff = 0) {
  // fill, then one even outline (width scaled to the on-screen ink setting)
  if (shadowOff) {
    g.save(); g.translate(1.2 * shadowOff * INKS, 1.6 * shadowOff * INKS);
    g.beginPath(); pathFn(g); g.fillStyle = INK; g.fill(); g.restore();
  }
  g.beginPath(); pathFn(g);
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = w * INKS; g.strokeStyle = INK; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
}
// ink lines scale with the outline setting; coloured lines and limbs (raw) keep their width
function line(g, pts, w, color = INK, raw = false) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineWidth = color === INK && !raw ? w * INKS : w; g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
}
function dot(g, x, y, r, color = INK) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill(); }

// ---------- head ----------
// Round head: a circle with a slightly fuller jaw, a little wider than tall.
function headPath(cx, cy, w, h) {
  return (g) => { g.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); };
}

const HAIR = {
  none() {},
  short(g, c, L) { // cap of hair on the top half
    inked(g, (p) => {
      const { cx, cy, w, h } = L;
      p.moveTo(cx - w * 0.52, cy + h * 0.02);
      p.bezierCurveTo(cx - w * 0.6, cy - h * 0.62, cx + w * 0.6, cy - h * 0.72, cx + w * 0.52, cy + h * 0.0);
      p.bezierCurveTo(cx + w * 0.4, cy - h * 0.22, cx + w * 0.1, cy - h * 0.3, cx - w * 0.15, cy - h * 0.2);
      p.bezierCurveTo(cx - w * 0.3, cy - h * 0.15, cx - w * 0.45, cy - h * 0.1, cx - w * 0.52, cy + h * 0.02);
    }, c, 8);
  },
  spiky(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => {
      p.moveTo(cx - w * 0.52, cy - h * 0.02);
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        const r1 = 0.55, r2 = 0.78;
        p.lineTo(cx + Math.cos(a - 0.12) * w * r1, cy + Math.sin(a - 0.12) * h * r1 - h * 0.1);
        if (i < n) p.lineTo(cx + Math.cos(a + Math.PI / n / 2) * w * r2 * 0.75, cy + Math.sin(a + Math.PI / n / 2) * h * r2 - h * 0.12);
      }
      p.lineTo(cx + w * 0.52, cy - h * 0.02);
      p.bezierCurveTo(cx + w * 0.2, cy - h * 0.3, cx - w * 0.2, cy - h * 0.3, cx - w * 0.52, cy - h * 0.02);
    }, c, 8);
  },
  bob(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => {
      p.moveTo(cx - w * 0.6, cy + h * 0.45);
      p.bezierCurveTo(cx - w * 0.72, cy - h * 0.8, cx + w * 0.72, cy - h * 0.8, cx + w * 0.6, cy + h * 0.45);
      p.lineTo(cx + w * 0.42, cy + h * 0.45);
      p.bezierCurveTo(cx + w * 0.45, cy - h * 0.1, cx + w * 0.2, cy - h * 0.28, cx - w * 0.1, cy - h * 0.22);
      p.bezierCurveTo(cx - w * 0.35, cy - h * 0.1, cx - w * 0.42, cy + h * 0.1, cx - w * 0.42, cy + h * 0.45);
      p.closePath();
    }, c, 8);
  },
  long(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => {
      p.moveTo(cx - w * 0.58, cy + h * 0.95);
      p.bezierCurveTo(cx - w * 0.75, cy - h * 0.85, cx + w * 0.75, cy - h * 0.85, cx + w * 0.58, cy + h * 0.95);
      p.lineTo(cx + w * 0.44, cy + h * 0.95);
      p.bezierCurveTo(cx + w * 0.46, cy - h * 0.1, cx + w * 0.2, cy - h * 0.3, cx - w * 0.05, cy - h * 0.26);
      p.bezierCurveTo(cx - w * 0.35, cy - h * 0.12, cx - w * 0.44, cy + h * 0.2, cx - w * 0.44, cy + h * 0.95);
      p.closePath();
    }, c, 8);
  },
  bun(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => p.ellipse(cx + w * 0.05, cy - h * 0.6, w * 0.2, h * 0.17, 0, 0, Math.PI * 2), c, 8);
    HAIR.short(g, c, L);
  },
  curly(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => {
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * 0.95 + (i / n) * Math.PI * 1.1;
        const x = cx + Math.cos(a) * w * 0.5, y = cy - h * 0.06 + Math.sin(a) * h * 0.52;
        if (i === 0) p.moveTo(x, y + h * 0.08);
        p.arc(x, y, w * 0.1, a - 1.6, a + 1.6);
      }
      p.bezierCurveTo(cx + w * 0.3, cy - h * 0.18, cx - w * 0.3, cy - h * 0.18, cx - w * 0.5, cy + h * 0.08);
    }, c, 8);
  },
  side(g, c, L) { // side part with a swoop
    const { cx, cy, w, h } = L;
    inked(g, (p) => {
      p.moveTo(cx - w * 0.52, cy + h * 0.1);
      p.bezierCurveTo(cx - w * 0.62, cy - h * 0.7, cx + w * 0.62, cy - h * 0.72, cx + w * 0.53, cy + h * 0.05);
      p.bezierCurveTo(cx + w * 0.3, cy - h * 0.12, cx + w * 0.05, cy - h * 0.42, cx - w * 0.2, cy - h * 0.3);
      p.bezierCurveTo(cx - w * 0.4, cy - h * 0.2, cx - w * 0.48, cy - h * 0.05, cx - w * 0.52, cy + h * 0.1);
    }, c, 8);
  },
  ponytail(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.ellipse(cx + w * 0.6, cy + h * 0.05, w * 0.13, h * 0.32, -0.3, 0, Math.PI * 2); }, c, 8);
    HAIR.short(g, c, L);
  },
  bald(g, c, L) { // fringe on the sides only
    const { cx, cy, w, h } = L;
    for (const s of [-1, 1]) inked(g, (p) => p.ellipse(cx + s * w * 0.47, cy - h * 0.02, w * 0.08, h * 0.16, 0, 0, Math.PI * 2), c, 7);
  },
};

const HATS = {
  none() {},
  cap(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.moveTo(cx - w * 0.5, cy - h * 0.12); p.bezierCurveTo(cx - w * 0.5, cy - h * 0.78, cx + w * 0.5, cy - h * 0.78, cx + w * 0.5, cy - h * 0.12); p.closePath(); }, c, 8);
    inked(g, (p) => { p.moveTo(cx + w * 0.2, cy - h * 0.14); p.quadraticCurveTo(cx + w * 0.75, cy - h * 0.18, cx + w * 0.82, cy - h * 0.06); p.lineTo(cx + w * 0.2, cy - h * 0.06); p.closePath(); }, shadeHex(c, -0.2), 7);
  },
  tophat(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => p.rect(cx - w * 0.3, cy - h * 1.25, w * 0.6, h * 0.8), c, 8);
    inked(g, (p) => p.ellipse(cx, cy - h * 0.45, w * 0.55, h * 0.08, 0, 0, Math.PI * 2), c, 8);
    g.fillStyle = shadeHex(c, 0.35); g.fillRect(cx - w * 0.3 + 4, cy - h * 0.62, w * 0.6 - 8, h * 0.08);
  },
  bowler(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.moveTo(cx - w * 0.36, cy - h * 0.38); p.bezierCurveTo(cx - w * 0.36, cy - h * 0.98, cx + w * 0.36, cy - h * 0.98, cx + w * 0.36, cy - h * 0.38); p.closePath(); }, c, 8);
    inked(g, (p) => p.ellipse(cx, cy - h * 0.38, w * 0.56, h * 0.07, 0, 0, Math.PI * 2), c, 8);
  },
  beret(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => p.ellipse(cx - w * 0.06, cy - h * 0.44, w * 0.52, h * 0.2, -0.15, 0, Math.PI * 2), c, 8);
  },
  hardhat(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.moveTo(cx - w * 0.5, cy - h * 0.26); p.bezierCurveTo(cx - w * 0.5, cy - h * 0.95, cx + w * 0.5, cy - h * 0.95, cx + w * 0.5, cy - h * 0.26); p.closePath(); }, c, 8);
    inked(g, (p) => p.rect(cx - w * 0.62, cy - h * 0.3, w * 1.24, h * 0.09), c, 8);
  },
  straw(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => p.ellipse(cx, cy - h * 0.36, w * 0.82, h * 0.1, 0, 0, Math.PI * 2), c, 8);
    inked(g, (p) => { p.moveTo(cx - w * 0.36, cy - h * 0.38); p.bezierCurveTo(cx - w * 0.36, cy - h * 0.85, cx + w * 0.36, cy - h * 0.85, cx + w * 0.36, cy - h * 0.38); p.closePath(); }, c, 8);
    g.fillStyle = "#b8473a"; g.fillRect(cx - w * 0.35, cy - h * 0.5, w * 0.7, h * 0.08);
  },
  helmet(g, c, L) { // round soldier/explorer helmet
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.moveTo(cx - w * 0.62, cy - h * 0.2); p.bezierCurveTo(cx - w * 0.55, cy - h * 1.0, cx + w * 0.55, cy - h * 1.0, cx + w * 0.62, cy - h * 0.2); p.closePath(); }, c, 8);
  },
  chef(g, c, L) {
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.rect(cx - w * 0.32, cy - h * 0.7, w * 0.64, h * 0.32); }, c, 8);
    inked(g, (p) => { for (const s of [-0.22, 0, 0.22]) p.ellipse(cx + s * w, cy - h * 0.85, w * 0.2, h * 0.2, 0, 0, Math.PI * 2); }, c, 8);
  },
  scarf(g, c, L) { // head scarf
    const { cx, cy, w, h } = L;
    inked(g, (p) => { p.moveTo(cx - w * 0.6, cy + h * 0.3); p.bezierCurveTo(cx - w * 0.72, cy - h * 0.9, cx + w * 0.72, cy - h * 0.9, cx + w * 0.6, cy + h * 0.3); p.bezierCurveTo(cx + w * 0.4, cy - h * 0.3, cx - w * 0.4, cy - h * 0.3, cx - w * 0.6, cy + h * 0.3); }, c, 8);
  },
};

// ---------- face ----------
// Big round eyes (white with a dark pupil), about 0.3 of the head width; larger when shocked.
function eyes(g, L, kind, look, open = 1) {
  const { cx, cy, w } = L;
  const ex = w * 0.17, ey = cy - L.h * 0.04, off = look * w * 0.07;
  const P = [[cx - ex + off, ey], [cx + ex + off, ey]];
  const r = w * 0.135 * (kind === "big" ? 1.15 : kind === "wide" ? 1.32 : 1);
  const lw = 5;
  g.lineCap = "round";
  if (kind === "closed" || open < 0.15) { P.forEach(([x, y]) => line(g, [[x - r * 0.9, y + r * 0.1], [x + r * 0.9, y + r * 0.1]], 6)); return; }
  if (kind === "happy") { P.forEach(([x, y]) => { g.beginPath(); g.arc(x, y + r * 0.45, r * 0.85, Math.PI * 1.12, Math.PI * 1.88); g.lineWidth = 6 * INKS; g.strokeStyle = INK; g.stroke(); }); return; }
  const ry = r * open;
  P.forEach(([x, y]) => {
    inked(g, (p) => p.ellipse(x, y, r * 0.86, ry, 0, 0, Math.PI * 2), "#fbf7f0", lw);
    if (kind === "spiral") { g.beginPath(); for (let a = 0; a < 10; a += 0.3) g.lineTo(x + Math.cos(a) * a * r * 0.07, y + Math.sin(a) * a * r * 0.07); g.lineWidth = 3 * INKS; g.strokeStyle = INK; g.stroke(); return; }
    const pr = r * (kind === "wide" ? 0.28 : 0.4);
    dot(g, x + look * r * 0.32, y + (kind === "half" ? ry * 0.25 : 0), Math.min(pr, ry * 0.9));
    if (kind === "half") { g.save(); g.beginPath(); g.ellipse(x, y, r * 0.86 + 2, ry + 2, 0, 0, Math.PI * 2); g.clip(); g.fillStyle = L.skin; g.fillRect(x - r, y - ry - 3, r * 2, ry * 1.05); g.restore(); line(g, [[x - r * 0.84, y + ry * 0.05], [x + r * 0.84, y + ry * 0.05]], 5); }
  });
}
function brows(g, L, kind, look) {
  if (!kind) return;
  const { cx, cy, w, h } = L;
  const ex = w * 0.17, y = cy - h * 0.25, l = w * 0.085, off = look * w * 0.07;
  const tilt = { worried: 0.45, sad: 0.35, angry: -0.5, determined: -0.32, up: 0, confused: null }[kind] ?? 0;
  for (const s of [-1, 1]) {
    let a = tilt * s;
    let yy = y - (kind === "up" ? h * 0.06 : 0);
    if (kind === "confused") { a = s < 0 ? 0.3 : -0.1; yy = y - (s < 0 ? 0 : h * 0.06); }
    const x = cx + s * ex + off;
    line(g, [[x - l * Math.cos(a), yy - l * Math.sin(a) * s * -1], [x + l * Math.cos(a), yy + l * Math.sin(a) * s * -1]], 6);
  }
}
function mouth(g, L, kind, look, open = 0) {
  const { cx, cy, w, h } = L;
  const mx = cx + look * w * 0.07, my = cy + h * 0.23, mw = w * 0.12;
  g.lineCap = "round";
  const arc = (r, a0, a1, yy = my, lw = 6) => { g.beginPath(); g.arc(mx, yy, r, a0, a1); g.lineWidth = lw * INKS; g.strokeStyle = INK; g.stroke(); };
  const fillShape = (fn) => { inked(g, fn, "#7a2b34", 5, 0.3); };
  switch (kind) {
    case "smile": arc(mw * 0.8, Math.PI * 0.15, Math.PI * 0.85, my - mw * 0.45); break;
    case "grin": fillShape((p) => { p.moveTo(mx - mw, my - 4); p.quadraticCurveTo(mx, my + mw * 1.3, mx + mw, my - 4); p.closePath(); });
      g.fillStyle = "#fbf6ee"; g.fillRect(mx - mw * 0.75, my - 3, mw * 1.5, mw * 0.25); break;
    case "laugh": fillShape((p) => { p.moveTo(mx - mw * 1.1, my - 6); p.quadraticCurveTo(mx, my + mw * 1.8, mx + mw * 1.1, my - 6); p.closePath(); }); break;
    case "o": fillShape((p) => p.ellipse(mx, my + 4, mw * 0.35, mw * 0.5, 0, 0, Math.PI * 2)); break;
    case "O": fillShape((p) => p.ellipse(mx, my + 8, mw * 0.55, mw * 0.85, 0, 0, Math.PI * 2)); break;
    case "frown": arc(mw * 0.8, Math.PI * 1.15, Math.PI * 1.85, my + mw * 0.75); break;
    case "wavy": g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(mx - mw + (i / 8) * mw * 2, my + Math.sin(i * 1.6) * 4); g.lineWidth = 5 * INKS; g.strokeStyle = INK; g.stroke(); break;
    case "smirk": g.beginPath(); g.moveTo(mx - mw * 0.7, my + 2); g.quadraticCurveTo(mx + mw * 0.2, my + 8, mx + mw * 0.8, my - 8); g.lineWidth = 6 * INKS; g.strokeStyle = INK; g.stroke(); break;
    case "flat": line(g, [[mx - mw * 0.6, my], [mx + mw * 0.6, my]], 6); break;
    case "gritted": fillShape((p) => p.rect(mx - mw * 0.8, my - mw * 0.25, mw * 1.6, mw * 0.5)); g.fillStyle = "#fbf6ee"; g.fillRect(mx - mw * 0.7, my - mw * 0.18, mw * 1.4, mw * 0.36);
      line(g, [[mx - mw * 0.7, my], [mx + mw * 0.7, my]], 3); break;
    case "small": line(g, [[mx - mw * 0.3, my], [mx + mw * 0.3, my]], 5); break;
    default: arc(mw * 0.7, Math.PI * 0.2, Math.PI * 0.8, my - mw * 0.4);
  }
  if (open > 0 && ["smile", "flat", "small", "smirk", "frown", "wavy"].includes(kind)) {
    fillShape((p) => p.ellipse(mx, my + 3, mw * 0.4, mw * 0.3 * open + 3, 0, 0, Math.PI * 2));
  }
}
const FACE = {
  neutral: { eyes: "dot", brows: null, mouth: "small" },
  happy: { eyes: "dot", brows: "up", mouth: "smile" },
  grin: { eyes: "dot", brows: "up", mouth: "grin" },
  laugh: { eyes: "happy", brows: "up", mouth: "laugh" },
  surprised: { eyes: "big", brows: "up", mouth: "o" },
  shocked: { eyes: "wide", brows: "up", mouth: "O" },
  worried: { eyes: "dot", brows: "worried", mouth: "wavy" },
  sad: { eyes: "dot", brows: "sad", mouth: "frown" },
  angry: { eyes: "dot", brows: "angry", mouth: "gritted" },
  smug: { eyes: "half", brows: "confused", mouth: "smirk" },
  confused: { eyes: "dot", brows: "confused", mouth: "wavy" },
  thinking: { eyes: "dot", brows: "confused", mouth: "flat", lookUp: true },
  sleepy: { eyes: "half", brows: null, mouth: "small" },
  determined: { eyes: "dot", brows: "determined", mouth: "flat" },
};

function accessories(g, L, look, acc) {
  const { cx, cy, w, h } = L;
  const off = look * w * 0.06;
  if (acc.glasses) for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * w * 0.17 + off, cy - h * 0.04, w * 0.15, 0, Math.PI * 2); g.lineWidth = 5 * INKS; g.strokeStyle = INK; g.stroke(); }
  if (acc.glasses) line(g, [[cx - w * 0.02 + off, cy - h * 0.05], [cx + w * 0.02 + off, cy - h * 0.05]], 4);
  if (acc.mustache) inked(g, (p) => { const mx = cx + look * w * 0.07, my = cy + h * 0.16; p.moveTo(mx, my); p.quadraticCurveTo(mx - w * 0.12, my - 8, mx - w * 0.17, my + 10); p.quadraticCurveTo(mx - w * 0.08, my + 6, mx, my + 4); p.quadraticCurveTo(mx + w * 0.08, my + 6, mx + w * 0.17, my + 10); p.quadraticCurveTo(mx + w * 0.12, my - 8, mx, my); }, acc.hairColor, 4, 0.3);
  if (acc.beard) inked(g, (p) => { p.moveTo(cx - w * 0.36, cy + h * 0.12); p.quadraticCurveTo(cx - w * 0.3, cy + h * 0.62, cx + w * 0.04, cy + h * 0.62); p.quadraticCurveTo(cx + w * 0.36, cy + h * 0.6, cx + w * 0.38, cy + h * 0.12); p.quadraticCurveTo(cx, cy + h * 0.34, cx - w * 0.36, cy + h * 0.12); }, acc.hairColor, 6);
}

// ---------- body / outfits ----------
// torso box: top y0, bottom y1, half widths at shoulder (s) and hem (b)
const OUTFITS = {
  tee(g, B, c) { inked(g, (p) => roundTrap(p, B.cx, B.y0, B.y1, B.s, B.b * 0.95, 26), c.top, 9); },
  shirt(g, B, c) { OUTFITS.tee(g, B, c); collar(g, B, c.top); buttons(g, B, 4); },
  coat(g, B, c) {
    inked(g, (p) => roundTrap(p, B.cx, B.y0, B.y1 + 60, B.s * 1.04, B.b * 1.18, 24), c.top, 9);
    line(g, [[B.cx, B.y0 + 30], [B.cx, B.y1 + 55]], 5); collar(g, B, shadeHex(c.top, -0.15)); buttons(g, B, 3, 14);
  },
  suit(g, B, c) {
    inked(g, (p) => roundTrap(p, B.cx, B.y0, B.y1 + 10, B.s, B.b, 22), c.top, 9);
    inked(g, (p) => { p.moveTo(B.cx - 26, B.y0 + 4); p.lineTo(B.cx, B.y0 + 110); p.lineTo(B.cx + 26, B.y0 + 4); p.closePath(); }, "#f3eee4", 5, 0.3);
    inked(g, (p) => { p.moveTo(B.cx - 9, B.y0 + 14); p.lineTo(B.cx + 9, B.y0 + 14); p.lineTo(B.cx + 6, B.y0 + 95); p.lineTo(B.cx, B.y0 + 108); p.lineTo(B.cx - 6, B.y0 + 95); p.closePath(); }, c.accent || "#b8323a", 4, 0.3);
  },
  dress(g, B, c) {
    inked(g, (p) => { p.moveTo(B.cx - B.s, B.y0 + 22); p.quadraticCurveTo(B.cx - B.s, B.y0, B.cx - B.s + 30, B.y0); p.lineTo(B.cx + B.s - 30, B.y0); p.quadraticCurveTo(B.cx + B.s, B.y0, B.cx + B.s, B.y0 + 22); p.lineTo(B.cx + B.b * 1.55, B.y1 + 120); p.quadraticCurveTo(B.cx, B.y1 + 140, B.cx - B.b * 1.55, B.y1 + 120); p.closePath(); }, c.top, 9);
    line(g, [[B.cx - B.s * 0.98, B.y0 + (B.y1 - B.y0) * 0.45], [B.cx + B.s * 0.98, B.y0 + (B.y1 - B.y0) * 0.45]], 7, shadeHex(c.top, -0.3));
  },
  apron(g, B, c) { OUTFITS.tee(g, B, c); inked(g, (p) => roundTrap(p, B.cx, B.y0 + 50, B.y1 + 70, B.s * 0.62, B.b * 0.8, 12), c.accent || "#f1ece0", 6, 0.4); },
  overalls(g, B, c) { OUTFITS.tee(g, B, c); inked(g, (p) => roundTrap(p, B.cx, B.y0 + 70, B.y1 + 10, B.s * 0.6, B.b * 0.95, 10), c.accent || "#3b5f9a", 6, 0.4); for (const s of [-1, 1]) line(g, [[B.cx + s * B.s * 0.5, B.y0 + 6], [B.cx + s * B.s * 0.42, B.y0 + 72]], 10, c.accent || "#3b5f9a"); },
  uniform(g, B, c) { OUTFITS.coat(g, B, c); g.fillStyle = c.accent || "#e7c24a"; for (const s of [-1, 1]) g.fillRect(B.cx + s * (B.s - 34) - 22, B.y0 + 4, 44, 12); line(g, [[B.cx - B.s + 18, B.y1 - 30], [B.cx + B.s - 18, B.y1 - 30]], 12, shadeHex(c.top, -0.35)); },
  robe(g, B, c) { inked(g, (p) => roundTrap(p, B.cx, B.y0, B.y1 + 200, B.s, B.b * 1.35, 24), c.top, 9); line(g, [[B.cx - 30, B.y0 + 10], [B.cx + 20, B.y1 + 180]], 5); },
  stripes(g, B, c) { OUTFITS.tee(g, B, c); g.save(); g.beginPath(); roundTrap(g, B.cx, B.y0, B.y1, B.s, B.b * 0.95, 26); g.clip(); g.fillStyle = c.accent || "#f1ece0"; for (let y = B.y0 + 30; y < B.y1; y += 46) g.fillRect(0, y, CW, 18); g.restore(); g.beginPath(); roundTrap(g, B.cx, B.y0, B.y1, B.s, B.b * 0.95, 26); g.lineWidth = 9 * INKS; g.strokeStyle = INK; g.stroke(); },
};
function roundTrap(p, cx, y0, y1, s, b, r) {
  r = Math.min(Math.max(r, Math.min(s, b) * 0.9), (y1 - y0) / 2); // capsule: fully rounded shoulders and hem
  p.moveTo(cx - s + r, y0); p.lineTo(cx + s - r, y0); p.quadraticCurveTo(cx + s, y0, cx + s, y0 + r);
  p.lineTo(cx + b, y1 - r); p.quadraticCurveTo(cx + b, y1, cx + b - r, y1);
  p.lineTo(cx - b + r, y1); p.quadraticCurveTo(cx - b, y1, cx - b, y1 - r);
  p.lineTo(cx - s, y0 + r); p.quadraticCurveTo(cx - s, y0, cx - s + r, y0); p.closePath();
}
function collar(g, B, c) { for (const s of [-1, 1]) inked(g, (p) => { p.moveTo(B.cx, B.y0 + 6); p.lineTo(B.cx + s * 44, B.y0 + 2); p.lineTo(B.cx + s * 26, B.y0 + 42); p.closePath(); }, shadeHex(c, 0.25), 5, 0.3); }
function buttons(g, B, n, from = 50) { for (let i = 0; i < n; i++) dot(g, B.cx, B.y0 + from + i * 44, 6); }

// ---------- arms ----------
// arm angles (degrees from straight down, positive = outward) for one pose and side
function armAngles(pose, s, t, look) {
  let a1 = 14, a2 = 6, front = 0;
  const me = s === (look >= 0 ? 1 : -1); // the arm on the facing side does the gesture
  switch (pose) {
    case "wave": if (me) { a1 = 150; a2 = 160 + 22 * Math.sin(t * 14); } break;
    case "point": if (me) { a1 = 92; a2 = 90; } break;
    case "armsUp": a1 = 155; a2 = 168; break;
    case "shrug": a1 = 58; a2 = -30; break;
    case "hips": a1 = 48; a2 = -62; break;
    case "hold": a1 = 30; a2 = -55; front = 1; break;
    case "think": if (me) { a1 = 20; a2 = -150; front = 1; } break;
    case "cross": a1 = 22; a2 = -120; front = 1; break;
    case "reach": if (me) { a1 = 112; a2 = 108; } break;
    case "clap": a1 = 26; a2 = -78 + 18 * Math.abs(Math.sin(t * 12)); front = 1; break;
    case "facepalm": if (me) { a1 = 30; a2 = -165; } break;
    default: a1 = 24 + 2 * Math.sin(t * 1.3 + s); a2 = 6;
  }
  return [a1, a2, front];
}
// returns [shoulder, elbow, hand] for side s (-1 left of canvas, +1 right). A pose change blends from the
// previous pose over `u` (0..1, eased by the caller over 6-12 frames).
function armPts(pose, s, B, t, look, prevPose = null, u = 1) {
  const sx = B.cx + s * (B.s - 6), sy = B.y0 + 34;
  const L1 = B.arm, L2 = B.arm * 0.95;
  const deg = (d) => (d * Math.PI) / 180;
  let [a1, a2, front] = armAngles(pose, s, t, look);
  if (prevPose && prevPose !== pose && u < 1) {
    const [b1, b2] = armAngles(prevPose, s, t, look);
    a1 = b1 + (a1 - b1) * u; a2 = b2 + (a2 - b2) * u;
  }
  let e = [sx + s * Math.sin(deg(a1)) * L1, sy + Math.cos(deg(a1)) * L1];
  let h = [e[0] + s * Math.sin(deg(a2)) * L2, e[1] + Math.cos(deg(a2)) * L2];
  // keep the hand (and anything it holds) inside the card: shorten the arm if it would leave the canvas
  const margin = 40, minX = margin, maxX = CW - margin;
  const over = h[0] < minX ? (sx - minX) / Math.max(1, sx - h[0]) : h[0] > maxX ? (maxX - sx) / Math.max(1, h[0] - sx) : 1;
  if (over < 1) {
    e = [sx + (e[0] - sx) * over, sy + (e[1] - sy) * over];
    h = [sx + (h[0] - sx) * over, sy + (h[1] - sy) * over];
  }
  return { pts: [[sx, sy], e, h], front };
}

// ---------- full figure ----------
// look: { skin, hair, hairStyle, hat, hatColor, outfit, top, accent, pants, shoes, glasses, mustache, beard, heads (3.5 adult / 2.8 child), build (0.85..1.2), skirt }
// pose: { expr, blink, arms, armsPrev, armsU (0..1), exprU (0..1 after a face change), look (-1..1 facing),
//         lean (rad), bob (px), feet: [[x,y],[x,y]] (canvas px), hold: fn(g, hand), talk (0..1),
//         inkScale (outline, 1 = 9 card px), limb (stick limb width in card px) }
export function drawFigure(g, look, pose) {
  g.clearRect(0, 0, CW, CH);
  INKS = pose.inkScale || 1; LIMB = pose.limb || 14;
  const heads = look.heads || 3.5;
  const HH = T / heads, hw = HH * 1.04;
  const top = BASE - T + (pose.bob || 0);
  const legLen = HH * (heads >= 3.3 ? 1.25 : 1.05);
  const hipY = BASE - legLen + (pose.bob || 0);
  const cx = CW / 2;
  const build = look.build || 1;
  // capsule body from just under the head to the hips
  const bw = hw * 0.36 * build;
  const B = { cx, y0: top + HH * 0.98, y1: hipY + 14, s: bw, b: bw * 1.04, arm: (hipY - top - HH) * 0.52 };
  const lookDir = pose.look || 0;
  const lean = pose.lean || 0;

  // legs: black sticks (drawn un-leaned, the feet are planted in the world)
  const feet = pose.feet || [[cx - 30, BASE], [cx + 30, BASE]];
  feet.forEach(([fx, fy], i) => {
    const hip = [cx + (i ? 1 : -1) * B.b * 0.42, hipY];
    const dx = fx - hip[0], dy = fy - hip[1], dist = Math.hypot(dx, dy);
    const half = legLen / 2;
    let knee;
    if (dist >= legLen * 0.995) knee = [hip[0] + dx / 2, hip[1] + dy / 2];
    else {
      const k = Math.sqrt(half * half - (dist / 2) * (dist / 2));
      let nx = -dy / dist, ny = dx / dist;
      const fwd = lookDir >= 0 ? 1 : -1; // knees bend toward the facing side
      if (nx * fwd < 0) { nx = -nx; ny = -ny; }
      knee = [hip[0] + dx / 2 + nx * k * 0.6, hip[1] + dy / 2 + ny * k * 0.6];
    }
    line(g, [hip, knee, [fx, fy]], LIMB, INK, true);
    // shoe: a small rounded foot
    inked(g, (p) => p.ellipse(fx + (lookDir >= 0 ? 8 : -8), fy - LIMB * 0.45, LIMB * 1.15, LIMB * 0.62, 0, 0, Math.PI * 2), look.shoes || INK, 5);
  });

  g.save();
  // lean the upper body around the hips
  g.translate(cx, hipY); g.rotate(lean); g.translate(-cx, -hipY);
  const t = pose.time || 0;
  const arms = [-1, 1].map((s) => ({ s, ...armPts(pose.arms || "idle", s, B, t, lookDir, pose.armsPrev, pose.armsU ?? 1) }));
  const drawArm = (a) => {
    line(g, a.pts, LIMB, INK, true);
    dot(g, a.pts[2][0], a.pts[2][1], LIMB * 1.15); // ball hand
  };
  (OUTFITS[look.outfit] || OUTFITS.tee)(g, B, look);
  arms.forEach(drawArm); // stick arms read best in front of the body

  // head
  const L = { cx: cx + lookDir * hw * 0.04, cy: top + HH * 0.5, w: hw, h: HH, skin: look.skin };
  if (look.hairStyle === "long" || look.hairStyle === "bob") (HAIR[look.hairStyle])(g, look.hair, { ...L, cy: L.cy + 2 });
  inked(g, headPath(L.cx, L.cy, L.w, L.h), look.skin, 9);
  // two-tone cel shading: a cool lilac shadow on the lower right and a soft highlight on top, inside the outline
  g.save(); g.beginPath(); headPath(L.cx, L.cy, L.w, L.h)(g); g.clip();
  const sh = g.createLinearGradient(L.cx - L.w * 0.1, L.cy - L.h * 0.35, L.cx + L.w * 0.45, L.cy + L.h * 0.55);
  sh.addColorStop(0.55, "rgba(120,110,170,0)"); sh.addColorStop(1, "rgba(120,110,170,0.30)");
  g.fillStyle = sh; g.fillRect(L.cx - L.w / 2, L.cy - L.h / 2, L.w, L.h);
  g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(L.cx - L.w * 0.12, L.cy - L.h * 0.40, L.w * 0.30, L.h * 0.07, -0.25, 0, Math.PI * 2); g.fill();
  g.restore();
  const F = FACE[pose.expr] || FACE.neutral;
  const lk = lookDir * 0.8;
  if (!["long", "bob"].includes(look.hairStyle)) (HAIR[look.hairStyle] || HAIR.none)(g, look.hair, L);
  else (HAIR.short)(g, look.hair, L);
  // a face change takes 3-5 frames: the eyes squeeze and reopen into the new expression
  const eu = pose.exprU ?? 1;
  const open = eu >= 1 ? 1 : 0.35 + 0.65 * eu;
  eyes(g, L, pose.blink ? "closed" : F.eyes, lk + (F.lookUp ? 0.2 : 0), open);
  brows(g, L, F.brows, lk);
  mouth(g, L, F.mouth, lk, pose.talk || 0);
  accessories(g, L, lk, { glasses: look.glasses, mustache: look.mustache, beard: look.beard, hairColor: look.hair });
  (HATS[look.hat] || HATS.none)(g, look.hatColor || "#3a3a46", L);
  // props held in the hands are drawn last, in front of body and head
  if (pose.hold) pose.hold(g, arms.find((a) => a.s === (lookDir >= 0 ? 1 : -1)).pts[2], arms.map((a) => a.pts[2]));
  g.restore();
}

// ---------- look generator: new design for every story, same style ----------
// role: "adult" | "child" | "elder"; seed makes it repeatable; opts override anything.
export function makeLook(r, role = "adult", opts = {}) {
  const fem = opts.fem ?? r.chance(0.5);
  const heads = role === "child" ? 2.8 : role === "elder" ? 3.3 : 3.5;
  const hairStyles = fem ? ["bob", "long", "bun", "ponytail", "curly", "short"] : ["short", "spiky", "side", "curly", "bald", "short"];
  const outfits = role === "child" ? ["tee", "stripes", "overalls", "dress"] : fem ? ["dress", "shirt", "coat", "apron", "tee", "suit"] : ["shirt", "coat", "suit", "tee", "overalls", "apron", "stripes"];
  const top = r.pick(PALETTE.cloth);
  const look = {
    role, heads, fem,
    skin: r.pick(PALETTE.skin),
    hair: role === "elder" ? r.pick(["#8e8a86", "#ece8e2", "#b9b4ae"]) : r.pick(PALETTE.hair.slice(0, 6)),
    hairStyle: role === "elder" && !fem && r.chance(0.5) ? "bald" : r.pick(hairStyles),
    hat: r.chance(0.3) ? r.pick(role === "child" ? ["cap", "straw"] : ["cap", "bowler", "beret", "straw", "tophat"]) : "none",
    hatColor: r.pick(PALETTE.cloth),
    outfit: r.pick(outfits),
    top, accent: r.pick(PALETTE.cloth.filter((c) => c !== top)),
    pants: r.pick(PALETTE.pants),
    shoes: r.pick(["#26172a", "#4a2e22", "#3a3436"]),
    glasses: r.chance(role === "elder" ? 0.5 : 0.18),
    mustache: !fem && role !== "child" && r.chance(0.25),
    beard: !fem && role !== "child" && r.chance(0.12),
    build: r.range(0.88, 1.15),
    skirt: false,
  };
  if (look.outfit === "dress") look.skirt = true;
  return fixLook({ ...look, ...opts });
}
// hair that would poke through a hat is swapped for a short cut
export function fixLook(look) {
  if (look.hat && look.hat !== "none" && ["spiky", "curly", "bun", "ponytail", "side", "bald"].includes(look.hairStyle)) look.hairStyle = "short";
  if (look.outfit === "dress") look.skirt = true;
  return look;
}
export { mixHex };
