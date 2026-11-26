// Painted procedural textures (Canvas2D). Every texture is a pure function of its options and seed.
// Look: soft painterly blotches, a few brush strokes, thin dark seams between parts.
import * as THREE from "three";
import { rng, hash2, hexToRgb, rgbToHex, shadeHex, mixHex, clamp } from "../core/util.js";

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// tiling value noise (period p cells), 0..1
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % p) + p) % p;
  const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s);
  const c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, p, s, oct = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, p * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

// Base layer: colour with painterly value variation (tileable).
function paintBase(g, w, h, hex, { var: vr = 0.12, cells = 6, seed = 1, hue = 0.0 } = {}) {
  const img = g.createImageData(w, h);
  const [r, gg, b] = hexToRgb(hex);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * cells, (y / h) * cells, cells, seed) - 0.5;
      const n2 = fbm((x / w) * cells * 4, (y / h) * cells * 4, cells * 4, seed + 99) - 0.5;
      const k = 1 + n * vr * 2 + n2 * vr * 0.6;
      const i = (y * w + x) * 4;
      d[i] = clamp(r * k + n * hue * 255, 0, 255);
      d[i + 1] = clamp(gg * k, 0, 255);
      d[i + 2] = clamp(b * k - n * hue * 255, 0, 255);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// Short soft strokes for a hand-painted feel.
function strokes(g, w, h, hex, n, r, { len = 18, width = 3, alpha = 0.18, angle = null } = {}) {
  g.save();
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h;
    const a = angle == null ? r() * Math.PI : angle + (r() - 0.5) * 0.5;
    const l = len * (0.5 + r());
    g.strokeStyle = r() < 0.5 ? shadeHex(hex, 0.18) : shadeHex(hex, -0.14);
    g.globalAlpha = alpha * (0.5 + r());
    g.lineWidth = width * (0.6 + r() * 0.8);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      if (x + ox < -l || x + ox > w + l || y + oy < -l || y + oy > h + l) continue;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      g.stroke();
    }
  }
  g.restore();
}

function seam(g, hex, w = 2.2) { g.strokeStyle = shadeHex(hex, -0.62); g.lineWidth = w; g.globalAlpha = 0.85; }

const PAINTERS = {
  plaster(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: 0.08, cells: 5, seed: o.seed });
    strokes(g, w, h, o.color, 140, r, { len: 26, width: 6, alpha: 0.12 });
    // a few chips and a darker base band painted in
    g.globalAlpha = 0.18; g.fillStyle = shadeHex(o.color, -0.35);
    for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 6, 2 + r() * 3, r(), 0, 7); g.fill(); }
    g.globalAlpha = 1;
  },
  brick(g, w, h, o, r) {
    const mortar = o.mortar || shadeHex(o.color, 0.35);
    paintBase(g, w, h, mortar, { var: 0.06, cells: 4, seed: o.seed + 3 });
    const rows = 16, cols = 6, bh = h / rows, bw = w / cols;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * bw * 0.5;
      for (let i = -1; i < cols + 1; i++) {
        const x = i * bw + off, y = j * bh;
        const tone = mixHex(o.color, r() < 0.5 ? shadeHex(o.color, -0.18) : shadeHex(o.color, 0.12), r() * 0.7);
        g.fillStyle = tone;
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        g.globalAlpha = 0.22; g.fillStyle = shadeHex(tone, 0.25); g.fillRect(x + 3, y + 3, bw - 8, 2); g.globalAlpha = 1;
        seam(g, o.color, 1.6); g.strokeRect(x + 2, y + 2, bw - 4, bh - 4); g.globalAlpha = 1;
      }
    }
    strokes(g, w, h, o.color, 60, r, { len: 14, width: 3, alpha: 0.1 });
  },
  planks(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: 0.07, cells: 3, seed: o.seed });
    const n = o.count || 8, ph = h / n;
    for (let j = 0; j < n; j++) {
      const tone = mixHex(o.color, shadeHex(o.color, r() < 0.5 ? -0.16 : 0.1), r());
      g.globalAlpha = 0.55; g.fillStyle = tone; g.fillRect(0, j * ph, w, ph); g.globalAlpha = 1;
      strokes(g, w, ph, tone, 18, r, { len: 60, width: 2, alpha: 0.25, angle: 0 });
      seam(g, o.color, 2.4); g.beginPath(); g.moveTo(0, j * ph + 1); g.lineTo(w, j * ph + 1); g.stroke(); g.globalAlpha = 1;
      const cut = r() * w; g.beginPath(); seam(g, o.color, 2); g.moveTo(cut, j * ph); g.lineTo(cut, (j + 1) * ph); g.stroke(); g.globalAlpha = 1;
    }
  },
  tiles(g, w, h, o, r) { // roof tiles: overlapping rows with a dark seam under each row
    paintBase(g, w, h, o.color, { var: 0.1, cells: 4, seed: o.seed });
    const rows = 10, cols = 8, th = h / rows, tw = w / cols;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * tw * 0.5;
      for (let i = -1; i <= cols; i++) {
        const x = i * tw + off, y = j * th;
        g.fillStyle = mixHex(o.color, shadeHex(o.color, r() < 0.5 ? -0.2 : 0.14), r() * 0.8);
        g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + tw - 2, y); g.lineTo(x + tw - 2, y + th * 0.75);
        g.quadraticCurveTo(x + tw / 2, y + th * 1.02, x + 2, y + th * 0.75); g.closePath(); g.fill();
        seam(g, o.color, 1.8); g.stroke(); g.globalAlpha = 1;
      }
    }
  },
  stone(g, w, h, o, r) { // cobbles / stone wall
    const gap = o.mortar || shadeHex(o.color, -0.45);
    paintBase(g, w, h, gap, { var: 0.05, cells: 3, seed: o.seed });
    const n = o.count || 7, cw = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = (i + 0.5 + (j % 2) * 0.5 + (r() - 0.5) * 0.25) * cw, cy = (j + 0.5 + (r() - 0.5) * 0.25) * cw;
      const rx = cw * (0.4 + r() * 0.08), ry = cw * (0.36 + r() * 0.1);
      const tone = mixHex(o.color, shadeHex(o.color, r() < 0.5 ? -0.18 : 0.16), r());
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        g.fillStyle = tone; g.beginPath(); g.ellipse(cx + ox, cy + oy, rx, ry, r() * 0.6, 0, 7); g.fill();
        g.globalAlpha = 0.25; g.fillStyle = shadeHex(tone, 0.3);
        g.beginPath(); g.ellipse(cx + ox - rx * 0.2, cy + oy - ry * 0.25, rx * 0.5, ry * 0.3, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      }
    }
  },
  slabs(g, w, h, o, r) { // paving slabs / floor tiles
    paintBase(g, w, h, o.color, { var: 0.07, cells: 4, seed: o.seed });
    const n = o.count || 4, s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.35; g.fillStyle = shadeHex(o.color, r() < 0.5 ? -0.12 : 0.1); g.fillRect(i * s, j * s, s, s); g.globalAlpha = 1;
    }
    if (o.check) { g.globalAlpha = 0.85; g.fillStyle = o.check; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if ((i + j) % 2) g.fillRect(i * s, j * s, s, s); g.globalAlpha = 1; }
    seam(g, o.color, 2.2);
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    g.globalAlpha = 1;
    strokes(g, w, h, o.color, 80, r, { len: 20, width: 4, alpha: 0.1 });
  },
  grass(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: 0.16, cells: 4, seed: o.seed, hue: 0.03 });
    strokes(g, w, h, o.color, 900, r, { len: 9, width: 2.2, alpha: 0.35, angle: -Math.PI / 2 });
    g.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) { // little flower dots
      g.fillStyle = r() < 0.5 ? "#f3e7a1" : "#f4f1ea";
      g.beginPath(); g.arc(r() * w, r() * h, 1.6 + r() * 1.2, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  },
  dirt(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: 0.12, cells: 5, seed: o.seed });
    strokes(g, w, h, o.color, 200, r, { len: 12, width: 4, alpha: 0.14 });
    for (let i = 0; i < 70; i++) {
      const tone = shadeHex(o.color, r() < 0.5 ? -0.3 : 0.2);
      g.fillStyle = tone; g.globalAlpha = 0.6;
      g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  },
  wood(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: 0.08, cells: 3, seed: o.seed });
    strokes(g, w, h, o.color, 120, r, { len: 80, width: 2, alpha: 0.28, angle: Math.PI / 2 });
  },
  flat(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: o.var ?? 0.06, cells: 4, seed: o.seed });
    strokes(g, w, h, o.color, 60, r, { len: 20, width: 5, alpha: 0.08 });
  },
  water(g, w, h, o, r) {
    paintBase(g, w, h, o.color, { var: 0.1, cells: 3, seed: o.seed });
    g.strokeStyle = shadeHex(o.color, 0.45); g.lineCap = "round";
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, l = 10 + r() * 30;
      g.globalAlpha = 0.3 + r() * 0.3; g.lineWidth = 2 + r() * 2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke();
    }
    g.globalAlpha = 1;
  },
};

// Public: get (cached) painted texture. kind = key of PAINTERS. repeat = [u, v].
export function paint(kind, opts = {}) {
  const o = { seed: 1, size: 512, ...opts };
  const key = kind + JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const c = canvas(o.size, o.size);
  const g = c.getContext("2d");
  PAINTERS[kind](g, o.size, o.size, o, rng(o.seed * 131 + kind.length));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(key, t);
  return t;
}
export const PAINT_KINDS = Object.keys(PAINTERS);
