// Storm-test cast (CAPTAIN / COOK / SAILOR) + 2D effects, drawn on a canvas.
// Construction v2 (characters.md, our own cast): superellipse heads (pointed crown 1.75 / full jaw 2.3, chin taper,
// seeded side bulge + tilt), bean torsos, single-stroke limbs with ink-dot hands, a thick-thin plum outline weighted
// away from the light, soft painted crescents, deadpan lidded eyes, no blush, no catchlights.
// Construction v3 (StormTest v3, amended skill target 10): snow-white heads #fcfbf7 with a subtle grey-blue
// crescent band (SH_SKIN), thick expressive brows (angled anger / arched mockery / flat deadpan), rich mouths
// (open shout with teeth + tongue, tooth-separated grins/laughs, grimaces, moustaches), full costumes with one
// distinguishing piece each (gold-epaulette captain's coat, cook's apron + tall pleated toque, sailor's striped
// vest + polka-dot bandana). Head h/w tightened to ~0.93-0.94. Close-up detail (crow's feet, cheek creases,
// tooth separators) so faces hold at 45-65% frame width. New "pourBowl" prop: thin oil thread into a bowl.
// (v3: the ghost-dissolve head card drawHead() was deleted with target 19 — no ghost code ships.)
// Design space 600 x 1000 units (soles at y = 975); the canvas transform scales it.
// Storm additions: bicorne (red cockade) / toque / polka-dot bandana hats; "wheel" / ["pour", k] props;
// "determined" / "explaining" / "proud" / "doubtful" / "calm" / "quiet" expressions; a mouth override so the cast
// pass can cycle mouths every 2 frames while a character speaks.
// INK stays #241726 (inside the #201628-#351f22 band).
export const INK = "#241726";
/** target 10 (v3): pure snow-white head, luma ~0.95 — never flat paper, the grey-blue crescent (SH_SKIN) rounds it */
export const SKIN = "#fcfbf7";
const WHITE = "#ffffff";
const MOUTH = "#5a1e28";
const TONGUE = "#e86e78";
type C3 = [number, number, number];
/** head crescent: #fcfbf7 x [0.86, 0.88, 0.93] = #d8dde6 — a subtle GREY-BLUE band along the bottom/side edge */
const SH_SKIN: C3 = [0.86, 0.88, 0.93]; // grey-blue, not warm: the head reads round, never flat paper
const SH_CLOTH: C3 = [0.64, 0.66, 0.74]; // torsos: lit side -> far side ~0.65
const SH_FELT: C3 = [0.62, 0.62, 0.7];

export type Build = "adult" | "stout" | "kid";
export type Outfit = {
  jacket: string; pants: string; boots: string; hat?: string | null; belt?: string | null; buttons?: string; rifle?: boolean;
  sash?: string; sword?: boolean; moustache?: string; skin?: string; head?: number; cap?: string; hair?: string; dress?: string;
  build?: Build;
  /** v3 costume pieces: gold epaulettes (captain), apron (cook), horizontal stripes (sailor's vest) */
  epaulettes?: string; apron?: string; stripes?: string;
};
type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
/** deterministic per-character random in [0, 1) */
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** smooth curve from a through (near) k to b, as a polyline */
const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

// Storm-test cast: three costumes, ONE distinguishing piece each, readable at 0.5 scale.
//   CAPTAIN — wide flat blue bicorne + red cockade + blue coat + GOLD EPAULETTES + moustache (tall, stern, calm).
//   COOK (the hero) — tall white toque + white uniform + APRON (stout, big head, determined / explaining / proud).
//     Head #fcfbf7, toque #f7f4ec, jacket #ece7da, apron #e2dccb: stepped whites so the pieces separate at 0.5 scale.
//   SAILOR (the mocker) — orange shirt with WHITE STRIPES + blue polka-dot bandana (laughing, doubtful, then quiet).
// No two share headgear + coat silhouette. Reference: short01_0060 / short01_0180 / short01_sheet.
export const CAPTAIN: Outfit = { jacket: "#2f4d8f", pants: "#2a2f45", boots: "#1d1b22", hat: "bicorne", buttons: "#e8c45a", moustache: "#3a2a1a", epaulettes: "#e8c45a", build: "adult" };
export const COOK: Outfit = { jacket: "#ece7da", pants: "#3b3f52", boots: "#4a3426", hat: "toque", buttons: "#c9c4b8", apron: "#e2dccb", build: "stout" };
export const SAILOR: Outfit = { jacket: "#e8722a", pants: "#3b3f52", boots: "#4a3426", hat: "bandana", cap: "#3f6fb5", stripes: "#f4f1ea", build: "adult" };
export const SKINS = [SKIN, "#f2f0ea", "#e9e7e1"]; // snow-white family only (target 10): no peach skin anywhere

export class Pen {
  g: CanvasRenderingContext2D;
  ol = 12;
  /** [angle, cx, cy] rotation about (cx, cy), optional post-translation [.., dx, dy] */
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) { this.g = g; }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  /** filled shape with an ink outline; fill=null draws the outline only */
  poly(pts: P2[], fill: string | null, ol?: number) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  /** thick round-capped limb with an ink rim (effects, rope) */
  line(pts: P2[], fill: string, w: number, ink = true) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    if (ink) { this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * this.ol * 0.9; g.stroke(); }
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.fillStyle = fill; this.g.fill();
  }
  /** draw with a closed shape as clip */
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  /** flat fill + soft crescent on the side away from the light (light = canvas angle the light comes FROM).
   *  Radial ramp centred `shift` R toward the light: flat out to ~0.6 R on the far side, full shadow by ~0.8 R. */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(r0 / r1, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** broad gradient across a shape along the light: lit edge = base, far edge = shadow (torsos, coats) */
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** thick-thin ink ring: w(θ) = w0 (1 + k cos(θ − thick)), θ from the contour centroid (canvas angles) */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal for clockwise-on-screen contours
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }
  /** flat strap with a thin ink rim (cross belts, sash, rifle, handles) */
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g; g.lineCap = cap; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = "round";
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 48): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

const rrect = (x0: number, y0: number, x1: number, y1: number, r: number, n = 8): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(rad(a + (90 * i) / n)), cy + r * Math.sin(rad(a + (90 * i) / n))]);
  return pts;
};

/** tapered stroke, thick end at a: brows, moustache halves */
const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

// ---------------- contours ----------------
export type Blob = { a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number };

/** superellipse "bean": separate crown / jaw exponents, egg taper (neg = narrower chin), one-side bulge, soft noise.
 *  Points run right -> down -> left -> up (clockwise on screen). */
export const blobPts = (cx: number, cy: number, B: Blob, n = 72): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

/** measured head: H/W 0.93-0.94 (v3 tightened from 0.90-0.98), slightly pointed crown (1.75), fuller jaw (2.3), chin taper -0.12, 8 % bulge to the facing side */
export const headBlob = (seed: number, a = 118, facing = 0): Blob => ({
  a, b: a * (0.935 + 0.02 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});

/** thickest outline direction: away from the light, pulled toward the ground (64 deg measured for upper-left light) */
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
const DEF_LIGHT = rad(-120);

// ---------------- faces ----------------
export type Expr = "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock" | "relief" | "relief_open" | "dazed"
  | "pained" | "smile" | "smile_closed" | "lick" | "squint" | "awe"
  | "determined" | "explaining" | "calmExplain" | "proud" | "doubtful" | "calm" | "quiet";
type EyeK = "dot" | "small" | "lid" | "slit" | "happy" | "dash" | "squeeze" | "shock" | "shockHalf" | "spiral";
export type MouthK = "dash" | "frown" | "smirk" | "smile" | "smileWide" | "grin" | "laugh" | "o" | "O" | "wave" | "teeth" | "lick";
/** eyes [back, front], brows [inner, outer] offsets in u (+ = down), mouth kind.
 *  v3 brows (target 10): THICK (6.5u in, 3u out) and shaped — angled for anger (stern/determined: inner DOWN),
 *  ARCHED for mockery (grin/laugh: outer end UP, [-2,-6]), FLAT for deadpan (neutral/quiet/calm: [0,-1]). */
const FACE: Record<Expr, { eye: [EyeK, EyeK]; brow: [number, number]; mouth: MouthK }> = {
  neutral: { eye: ["lid", "lid"], brow: [0, -1], mouth: "dash" },
  stern: { eye: ["lid", "lid"], brow: [3, -2], mouth: "frown" },
  grin: { eye: ["happy", "happy"], brow: [-2, -6], mouth: "grin" },
  laugh: { eye: ["squeeze", "squeeze"], brow: [-2, -6], mouth: "laugh" },
  whistle: { eye: ["dash", "dash"], brow: [-2, -4], mouth: "o" },
  nervous: { eye: ["small", "small"], brow: [-3, 2], mouth: "wave" },
  shock: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "O" },
  relief: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "smileWide" },
  relief_open: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "grin" },
  dazed: { eye: ["spiral", "spiral"], brow: [-3, 2], mouth: "wave" },
  pained: { eye: ["squeeze", "lid"], brow: [-3, 2], mouth: "teeth" },
  squint: { eye: ["slit", "slit"], brow: [2, -1], mouth: "dash" },
  awe: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "o" },
  smile: { eye: ["dot", "dot"], brow: [0, -1], mouth: "smirk" },
  smile_closed: { eye: ["happy", "happy"], brow: [0, -1], mouth: "smile" },
  lick: { eye: ["dot", "dot"], brow: [0, -1], mouth: "lick" },
  determined: { eye: ["lid", "lid"], brow: [4, -2], mouth: "teeth" },
  explaining: { eye: ["dot", "dot"], brow: [-3, -3], mouth: "smile" },
  /** v3: the S5 analogy close-up face — half-lidded calm eyes, gently raised brows, soft closed smile: explaining, unhurried */
  calmExplain: { eye: ["lid", "lid"], brow: [-2, -2], mouth: "smile" },
  proud: { eye: ["happy", "happy"], brow: [-2, -2], mouth: "smileWide" },
  doubtful: { eye: ["small", "small"], brow: [-4, 2], mouth: "smirk" },
  calm: { eye: ["lid", "lid"], brow: [0, -1], mouth: "smile" },
  quiet: { eye: ["lid", "lid"], brow: [1, 0], mouth: "dash" },
};
const halfLid = (k: EyeK): EyeK => (k === "dot" || k === "small" ? "lid" : k === "lid" ? "slit" : k === "shock" ? "shockHalf" : k);
const eyeKind = (k: EyeK, lid: number): EyeK =>
  lid >= 1 && k !== "happy" && k !== "squeeze" && k !== "spiral" ? "dash" : lid > 0 ? halfLid(k) : k;
const lidOf = (b: boolean | number | undefined) => (b === true ? 1 : Number(b) || 0);

const eye = (p: Pen, kind: EyeK, x: number, ey: number, u: number, side: number, look: number, skin: string) => {
  const lx = x + look * 3 * u, lw = 3.8 * u;
  switch (kind) {
    case "dot": p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0); break;
    case "small": p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0); break;
    case "lid": p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); break;
    case "slit": p.ell(lx, ey, 7 * u, 2.6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey], [x + 9 * u, ey]], lw); break;
    case "happy": p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw); break;
    case "dash": p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw); break;
    case "squeeze": p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw); break;
    case "shock": case "shockHalf":
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u);
      if (kind === "shockHalf") { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      break;
    default: {
      const s: P2[] = [];
      for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]);
      p.stroke(s, 2.4 * u);
    }
  }
};

/** open "D" mouth with a white teeth band (+ tongue). v3: tooth separators in the band and an outlined tongue,
 *  so the grin/laugh still read as teeth at 45-65% close-up scale; `teeth` = band depth in u (laugh 5, grin 3). */
const dmouth = (p: Pen, mx: number, y: number, rx: number, ry: number, u: number, tongue = false, teeth = 3) => {
  p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
  p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + teeth * u], [mx - rx, y + teeth * u]], () => p.ell(mx, y, rx, ry, WHITE, 0, 0, 180));
  for (const j of [-0.5, 0, 0.5]) p.stroke([[mx + j * rx, y + 0.5 * u], [mx + j * rx, y + (teeth - 0.5) * u]], 1.6 * u);
  if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 2 * u);
  p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
};

/** close-up laugh detail (v3): crow's feet at the outer eye corner + a cheek crease under the eye, so the
 *  laughing face holds drawn detail when the head fills 45-65% of the frame (S3 mocker close-up). */
const laughLines = (p: Pen, x: number, ey: number, u: number, side: number) => {
  const ox = x + side * 13 * u;
  p.stroke([[ox, ey - 6 * u], [ox + side * 5 * u, ey - 8.5 * u]], 2.2 * u);
  p.stroke([[ox, ey - 1 * u], [ox + side * 6 * u, ey - 1 * u]], 2.2 * u);
};

const mouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, k = 1) => {
  const mw = 4 * u;
  switch (kind) {
    case "dash": p.stroke([[mx - 5.5 * u * k, my], [mx + 5.5 * u * k, my - 0.8 * u]], mw); break;
    case "frown": p.arc(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340, mw); break;
    case "smirk": p.arc(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150, mw); break;
    case "smile": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); break;
    case "smileWide": p.arc(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165, mw); break;
    case "grin": dmouth(p, mx, my - u, 12 * u * k, 8 * u, u); break;
    case "laugh": dmouth(p, mx, my, 16 * u * k, 11 * u, u, true, 5); break;
    case "o": p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case "O": { // v3 shouting mouth: dark open mouth, white teeth band across the top, pink tongue at the bottom
      p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, MOUTH, 0);
      p.clip([[mx - 9 * u * k, my - 9 * u], [mx + 9 * u * k, my - 9 * u], [mx + 9 * u * k, my - 3 * u], [mx - 9 * u * k, my - 3 * u]],
        () => p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, WHITE, 0));
      p.ell(mx + u, my + 7 * u, 5 * u * k, 4 * u, TONGUE, 2 * u);
      p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, null, 3.2 * u);
      break;
    }
    case "wave": { const s: P2[] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case "teeth":
      p.poly([[mx - 12 * u * k, my - 4 * u], [mx + 12 * u * k, my - 4 * u], [mx + 11 * u * k, my + 4 * u], [mx - 11 * u * k, my + 4 * u]], WHITE, 3 * u);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - 4 * u], [mx + j * 6 * u * k, my + 4 * u]], 1.5 * u);
      break;
    case "lick": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); p.ell(mx + 6 * u * k, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u); break;
  }
};

/** face v2 (front / 3-4). u = 1 % of the head path width W. Eyes 26u apart on the centre line, brows 20u up, mouth 20u
 *  down, everything slid toward the facing side. No blush, no catchlights. */
const faceFront = (p: Pen, cx: number, cy: number, W: number, expr: Expr, facing: number, look: number, lid: number, brim: boolean,
  skin: string, moustache?: string, stout = false, mouthOv?: MouthK) => {
  const u = W / 100, F = FACE[expr], fx = cx + 7 * u * facing;
  const ex = (F.eye[0] === "shock" ? 12 : 13) * u, ey = cy;
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    const kind = eyeKind(F.eye[(facing ? side === facing : side > 0) ? 1 : 0], lid);
    eye(p, kind, x, ey, u, side, look, skin);
    const [dI, dO] = F.brow, by = ey - (brim ? 17 : 20) * u;
    if (kind === "shock" || kind === "shockHalf") p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 6.5 * u, 3 * u); // v3: THICK brows
    if (expr === "laugh" || expr === "grin") laughLines(p, x, ey, u, side); // v3 close-up detail
    if (expr === "laugh") p.arc(x, ey + 11 * u, 9 * u, 4.5 * u, 20, 160, 2 * u); // cheek crease
  }
  const mx = cx + 8 * u * facing, my = cy + 20 * u;
  mouth(p, mouthOv ?? F.mouth, mx, my, u);
  if (moustache) for (const s of [-1, 1])
    taper(p, [mx + s * 1.5 * u, cy + 12.5 * u], [mx + s * (stout ? 19 : 15) * u, cy + (stout ? 10.5 : 15) * u], stout ? 6.5 * u : 5.5 * u, 1.6 * u, moustache);
  if (expr === "nervous") p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

/** profile face (facing screen-right): one eye, brow, nose tick, mouth near the front edge; no skin bump nose, no ear */
const faceSide = (p: Pen, hx: number, hy: number, W: number, expr: Expr, lid: number, brim: boolean, skin: string, moustache?: string, stout = false, mouthOv?: MouthK) => {
  const u = W / 100, F = FACE[expr], ex = hx + 27 * u, ey = hy;
  const kind = eyeKind(F.eye[1], lid);
  eye(p, kind, ex, ey, u, 1, 0.6, skin);
  const by = ey - (brim ? 17 : 20) * u, [dI, dO] = F.brow;
  if (kind === "shock" || kind === "shockHalf") p.arc(ex, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
  else taper(p, [ex + 8 * u, by + dI * u], [ex - 7 * u, by - u + dO * u], 6.5 * u, 3 * u); // v3: THICK brows
  if (expr === "laugh" || expr === "grin") laughLines(p, ex, ey, u, 1); // v3 close-up detail
  if (expr === "laugh") p.arc(ex, ey + 11 * u, 9 * u, 4.5 * u, 20, 160, 2 * u); // cheek crease
  p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
  mouth(p, mouthOv ?? F.mouth, hx + 33 * u, hy + 21 * u, u, 0.62);
  if (moustache) taper(p, [hx + 41 * u, hy + 13.5 * u], [hx + 25 * u, hy + (stout ? 11.5 : 16) * u], stout ? 6.5 * u : 5.5 * u, 1.6 * u, moustache);
  if (expr === "nervous") p.ell(hx - 30 * u, hy - 24 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

// ---------------- hats ----------------
const BONNET = "#e9cf8f", BONNET_BRIM = "#d6b46a";
/** parts of a hat that sit behind the head (bonnet) */
const hatBehind = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, light: number, thick: number, ow: number, side: boolean) => {
  if (o.hat !== "bonnet") return;
  const bb = blobPts(cx - (side ? 12 : 0) * (H.a / 50), hc - 0.07 * 2 * H.b, { ...H, a: H.a * 1.17, b: H.b * 1.13, asym: 0, egg: 0.04, seed: H.seed + 3 });
  p.shadedFill(bb, BONNET, mul(BONNET, SH_CLOTH), light, H.a * 1.17);
  p.inkRing(bb, ow * 0.85, thick);
};

const hatOn = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, facing: number, side: boolean) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5)); // tilt with the head, +-2 deg extra
  const R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  const sag = (yb: number, wb: number): P2[] => {
    const base: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    return base;
  };
  if (o.hat === "shako" || o.hat === "shako_tall") {
    const tall = o.hat === "shako_tall", yb = crown + 0.25 * HH, ht = (tall ? 0.66 : 0.56) * HH, wb = 46 * u, wt = 52 * u;
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, "#3a3d47", "#24262d", light, wt, 0.4);
    if (tall) p.clip(body, () => p.band(R([[cx - wt - 5 * u, yb - ht + 0.07 * HH], [cx + wt + 5 * u, yb - ht + 0.07 * HH]]), "#e8c45a", 0.06 * HH, 1.5 * u));
    p.poly(body, null, ow);
    const deg = (a * 180) / Math.PI;
    if (side) {
      p.poly(R([[cx + 36 * u, yb - 1 * u], [cx + 60 * u, yb + 8 * u], [cx + 34 * u, yb + 6 * u]]), "#16171b", 2.5 * u);
      const [tx, ty] = R([[cx + 24 * u, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u);
    } else {
      const [px, py] = R([[cx + 3 * u * facing, yb + 3 * u]])[0];
      p.ell(px, py, 34 * u, 0.045 * HH, "#16171b", 2.5 * u, 0, 180, deg); // peak
      const [bx, by] = R([[cx, yb - 0.45 * ht]])[0];
      p.ell(bx, by, 7 * u, 6 * u, tall ? "#e8c45a" : "#c9ccd2", 2 * u, 0, 360, deg); // badge plate
      p.arc(bx, by, 3.5 * u, 2.8 * u, 200, 500, 1.6 * u);
      const [tx, ty] = R([[cx, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u); // green tuft
    }
  } else if (o.hat === "helmet") {
    // pith helmet: shallow dome + wide brim, khaki with a darker band
    const yb = crown + 0.3 * HH, ht = 0.34 * HH, col = "#e3d3a4";
    const dome = R([...sag(yb, 0.3 * W).reverse(), [cx - 0.3 * W, yb - ht], [cx + 0.3 * W, yb - ht]]);
    p.shadedFill(dome, col, mul(col, SH_FELT), light, 0.3 * W, 0.4);
    p.clip(dome, () => p.band(R([[cx - 0.3 * W - 4 * u, yb - 0.1 * HH], [cx + 0.3 * W + 4 * u, yb - 0.1 * HH]]), "#8a6f3c", 0.07 * HH, 0.8 * u));
    p.poly(dome, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.42 * W, 0.05 * HH, shade(col, 0.85), ow, 0, 360, (a * 180) / Math.PI);
  } else if (o.hat === "bicorne") {
    // wide flat fore-and-aft bicorne: low crown + a broad brim whose ends sweep up; red cockade at the front
    const yb = crown + 0.16 * HH, col = "#2f4d8f";
    const dome = R([...sag(yb, 0.3 * W).reverse(), [cx - 0.3 * W, yb - 0.16 * HH], [cx + 0.3 * W, yb - 0.16 * HH]]);
    p.shadedFill(dome, col, mul(col, SH_FELT), light, 0.3 * W, 0.4);
    p.poly(dome, null, ow);
    const brimPts = R([[cx - 0.52 * W, yb + 0.03 * HH], [cx - 0.56 * W, yb - 0.1 * HH], [cx - 0.2 * W, yb + 0.01 * HH],
      [cx + 0.2 * W, yb + 0.01 * HH], [cx + 0.56 * W, yb - 0.1 * HH], [cx + 0.52 * W, yb + 0.03 * HH]]);
    p.shadedFill(brimPts, col, mul(col, SH_FELT), light, 0.5 * W, 0.4);
    p.poly(brimPts, null, ow);
    p.stroke(R([[cx - 0.52 * W, yb - 0.08 * HH], [cx - 0.2 * W, yb + 0.005 * HH], [cx + 0.2 * W, yb + 0.005 * HH], [cx + 0.52 * W, yb - 0.08 * HH]]), 2 * u, "#e8c45a");
    const [ccx, ccy] = R([[cx + 6 * u * (facing || 1), yb - 0.02 * HH]])[0];
    p.ell(ccx, ccy, 8 * u, 8 * u, "#c0392b", 2.2 * u);
    p.dot(ccx, ccy, 3.5 * u, "#f4f1ea");
  } else if (o.hat === "toque") {
    // tall white chef toque: a deep pleated band + three puffs, ~0.7 head-heights above the crown — the hero's read
    const yb = crown + 0.08 * HH, col = "#f7f4ec";
    const bumps: [number, number, number, number][] = [[-34, -0.2, 30, 30], [0, -0.3, 42, 44], [34, -0.2, 30, 30]];
    for (const [dx, dy, rx, ry] of bumps) p.ell(cx + dx * u, yb + dy * HH, rx * u, ry * u, col, 0);
    p.ell(cx + 30 * u, yb - 0.22 * HH, 26 * u, 30 * u, "#ddd8cb", 0); // soft far-side shade
    for (const [dx, dy, rx, ry] of bumps) p.ell(cx + dx * u, yb + dy * HH, rx * u, ry * u, null, ow * 0.9);
    for (const [dx, dy] of [[-17, -0.26], [17, -0.26]] as const) p.ell(cx + dx * u, yb + dy * HH, 12 * u, 12 * u, col, 0); // hide seams
    for (const dx of [-22, 0, 22]) p.stroke([[cx + dx * u, yb - 0.34 * HH], [cx + dx * u, yb - 0.12 * HH]], 1.6 * u, "#c9c4b8"); // pleats
    const band = rrect(cx - 0.32 * W, yb - 0.02 * HH, cx + 0.32 * W, yb + 0.24 * HH, 8 * u);
    p.shadedFill(band, col, "#ddd8cb", light, 0.32 * W, 0.4);
    p.poly(band, null, ow);
  } else if (o.hat === "bandana") {
    // blue polka-dot bandana: cloth over the crown + a knot and tails at the back of the head
    const cut = crown + 0.3 * HH;
    const keep = (x: number, y: number) => y < cut;
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    if (arc.length >= 3) {
      const col = o.cap ?? "#3f6fb5";
      p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
      p.clip(arc, () => {
        for (let gx = -6; gx <= 6; gx++) for (let gy = -3; gy <= 2; gy++)
          p.dot(cx + gx * 15 * u, hc - 0.55 * H.b + gy * 15 * u + (gx % 2 ? 7 * u : 0), 2.4 * u, "#f4f1ea");
      });
      p.poly(arc, null, ow);
      const s = facing ? -facing : 1; // knot on the back side
      const [kx, ky] = R([[cx + s * 52 * u, cut - 4 * u]])[0];
      p.ell(kx, ky, 9 * u, 8 * u, col, 2.2 * u);
      p.poly(R([[kx - 4 * u, ky + 4 * u], [kx + 2 * u, ky + 26 * u], [kx + 8 * u, ky + 6 * u]]), col, 2 * u);
      p.poly(R([[kx - 8 * u, ky + 2 * u], [kx - 12 * u, ky + 22 * u], [kx - 2 * u, ky + 8 * u]]), shade(col, 0.85), 2 * u);
    }
  } else if (o.hat === "cap" || o.hat === "hair") {
    const cut = crown + (o.hat === "cap" ? 0.3 : 0.42) * HH;
    const keep = (x: number, y: number) => y < cut || (side && o.hat === "hair" && x < cx - 6 * u && y < hc + 0.42 * H.b);
    // start the arc at the first kept point after a dropped one, so the kept run is contiguous and the cut closes it
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    if (arc.length < 3) return;
    if (o.hat === "hair") { // scalloped lower edge
      const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
      for (let i = 1; i < 6; i++) arc.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6 + (i % 2 ? 4 * u : 0)]);
    }
    const col = o.hat === "cap" ? o.cap! : o.hair!;
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.poly(arc, null, ow);
    if (o.hat === "hair") {
      const s = side ? -1 : facing || 1;
      p.stroke([[cx + s * 10 * u, cut - 30 * u], [cx + s * 2 * u, cut - 12 * u]], 1.2 * u);
    }
    if (o.hat === "cap") {
      const deg = (a * 180) / Math.PI;
      if (side) p.poly(R([[cx + 40 * u, cut - 2 * u], [cx + 74 * u, cut + 4 * u], [cx + 40 * u, cut + 6 * u]]), shade(col, 0.8), ow);
      else {
        const s = facing || (rnd(seed, 21) < 0.5 ? -1 : 1), [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
        p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, deg);
      }
    }
  } else if (o.hat === "tophat") {
    const yb = crown + 0.22 * HH, ht = 0.8 * HH, wb = 0.31 * W, wt = 0.33 * W, col = "#2e2a36";
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.13 * HH], [cx + wt + 4 * u, yb - 0.13 * HH]]), shade(o.jacket, 0.9), 0.14 * HH, 0.8 * u));
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.45 * W, 0.05 * HH, "#1d1b22", ow, 0, 360, (a * 180) / Math.PI);
  } else if (o.hat === "bonnet") {
    const [bx, by] = R([[cx + (side ? 6 * u : 0), crown + 0.16 * HH]])[0];
    p.arc(bx, by, 0.5 * W, 0.2 * HH, 200, 340, 7 * u, BONNET_BRIM);
    p.arc(bx, by, 0.5 * W + 3.5 * u, 0.2 * HH + 3.5 * u, 200, 340, 1.2 * u);
    const cy = hc + H.b * 0.98;
    p.stroke([[cx - 14 * u, cy - 4 * u], [cx, cy + 2 * u], [cx + 14 * u, cy - 4 * u]], 2 * u, BONNET_BRIM);
  }
};

/** red oil can with a gold spout, drawn at the grip (hx, hy), rotated by ang about the grip */
const oilCan = (p: Pen, hx: number, hy: number, u: number, ang: number) => {
  const savedRot = p.rot;
  p.rot = [ang, hx, hy];
  p.poly([[hx - 16 * u, hy - 14 * u], [hx + 14 * u, hy - 14 * u], [hx + 14 * u, hy + 16 * u], [hx - 16 * u, hy + 16 * u]], "#c0392b", 2.2 * u);
  p.band([[hx - 16 * u, hy - 4 * u], [hx + 14 * u, hy - 4 * u]], "#e8c45a", 4 * u, 1 * u);
  p.band([[hx + 14 * u, hy - 10 * u], [hx + 26 * u, hy - 18 * u]], "#e8c45a", 4 * u, 1.2 * u, "round"); // spout
  p.arc(hx - 18 * u, hy - 2 * u, 7 * u, 9 * u, 90, 270, 2.4 * u); // handle loop
  p.rot = savedRot;
};
/** golden oil stream falling from the spout tip: a thick gold line + falling drops, length by k */
const pourStream = (p: Pen, sx: number, sy: number, u: number, k: number) => {
  const len = 70 * u * k;
  p.stroke([[sx, sy], [sx + 6 * u, sy + len * 0.6], [sx + 2 * u, sy + len]], 5 * u, "#f2b234");
  p.stroke([[sx, sy], [sx + 6 * u, sy + len * 0.6], [sx + 2 * u, sy + len]], 2 * u, "#ffe08a");
  for (let i = 0; i < 3; i++) p.dot(sx + (i % 2 ? 8 : -4) * u, sy + len + (8 + i * 14) * u * k, (3.5 - i * 0.7) * u, "#f2b234");
};
/** v5 (S5a pour-staging fix): the S5 bowl pour — a THIN thread, not the rail pour's thick stream — that
 *  REACHES the bowl water instead of stopping after a fixed 46u. The bowl sits 0.6 m behind the card and
 *  its dark interior projects to design y ≈ 395 at the thread's x (see the arm branch below), so the
 *  thread runs from the spout down to design y 395: at k = 1 it is the full spout-to-water drop, and the
 *  (0.4 + 0.6k) ramp keeps it visibly long even 3 frames into the pour (f469, k ≈ 0.39), when the old
 *  46u*k stub was 18 units long and died on the rail bar. Width 4.2u gold + 2u highlight so it reads at
 *  0.5 scale; one drop at the end where it meets the water. */
const THREAD_END_Y = 395; // design y where the thread meets the bowl water (S5a projection)
const pourThread = (p: Pen, sx: number, sy: number, u: number, k: number) => {
  const len = Math.max(0, (THREAD_END_Y - sy) * (0.4 + 0.6 * k));
  p.stroke([[sx, sy], [sx + 2 * u, sy + len]], 4.2 * u, "#f2b234");
  p.stroke([[sx, sy], [sx + 2 * u, sy + len]], 2 * u, "#ffe08a");
  p.dot(sx + 2 * u, sy + len + 6 * u * k, 3.2 * u, "#f2b234");
};

// ---------------- bodies ----------------
export type Arms = [P2[], P2[]];
/** held prop; for the hammer the number is the strike 0 (raised) .. 1 (struck) */
export type Prop = null | "icecream" | "shako" | "staff" | ["hammer", number] | ["saw", number]
  | "oilcan" | "wheel" | ["pour", number] | ["pourBowl", number]; // storm: oil can at rest, both hands on the wheel, tilted pour (k 0 upright .. 1 full tilt); v3: thin-thread pour into the bowl (S5)

const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  kid: { a: 112, torso: 0.85, legs: 1.0, tw: 0.72 },
};

export type FrontOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stroll" | "stand" | "sit" | "fall"; look?: number; blink?: boolean | number; lift?: number;
  prop?: Prop; tilt?: number; headTilt?: number; wave?: number; mouth?: MouthK;
  /** canvas angle the key light comes FROM (painted crescent + thick outline side) */
  light?: number; facing?: -1 | 0 | 1; seed?: number;
};

const footStroke = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  if (col !== INK) p.stroke([a, b], w + 3, INK);
  p.stroke([a, b], w, col);
};

export const bodyFront = (p: Pen, o: Outfit, opts: FrontOpts) => {
  const { phase = 0, expr = "neutral", mode = "march", look = 0, blink = false, lift = 60, prop = null, tilt = 0, headTilt = 0, wave,
    light = DEF_LIGHT, facing = 0, seed = 1, mouth: mouthOv } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const tall = (1 + Bd.torso + Bd.legs) * HH, sole = 975;
  // body bob 5 % (march) / 3 % (stroll) of the height, lowest at contact (phase 0 and 0.5)
  const bob = mode === "march" ? 0.025 * tall * Math.cos(2 * two * phase) : mode === "stroll" ? 0.015 * tall * Math.cos(2 * two * phase) : 0;
  const torsoBot = mode === "sit" ? sole - 0.2 * HH : sole - Bd.legs * HH + bob;
  const chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5), footCol = o.boots;
  const legW = 5.8 * u, footW = 7.5 * u;
  // ---- legs + feet (not rotated) ----
  p.rot = null;
  if (mode === "sit") {
    for (const side of [-1, 1]) {
      const h: P2 = [300 + side * 15 * u, hipY], k: P2 = [300 + side * 36 * u, hipY + 0.2 * HH], f: P2 = [300 + side * 44 * u, sole - 8 * u];
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], footW, footCol);
    }
  } else if (mode === "fall") {
    const legs: [P2, P2, P2][] = [
      [[300 - 15 * u, hipY], [300 - 46 * u, hipY + 0.5 * HH], [300 - 70 * u, hipY + 0.72 * HH]],
      [[300 + 15 * u, hipY], [300 + 50 * u, hipY + 0.45 * HH], [300 + 76 * u, hipY + 0.22 * HH]],
    ];
    legs.forEach(([h, k, f], i) => {
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, f, [f[0] + (i ? 14 : -14) * u, f[1] + (i ? -6 : 4) * u], footW, footCol);
    });
  } else if (o.dress) {
    for (const side of [-1, 1]) {
      const fx = 300 + side * 12 * u, fy = sole - 4 * u;
      p.stroke([[fx, sole - 0.4 * HH], [fx + side * u, fy]], legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 12 * u, fy + u], footW, footCol);
    }
  } else {
    const L = mode === "march" ? lift * 1.25 : mode === "stroll" ? lift * 0.55 : 0;
    for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
      const up = Math.max(0, Math.sin(two * (phase + ph))) * L;
      const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
      const k: P2 = [(hx + fx) / 2 + side * (1.5 * u + up * 0.16), (hipY + fy) / 2 - up * 0.08];
      p.stroke(curve([hx, hipY], k, [fx, fy]), legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u], footW, footCol);
    }
  }
  // ---- upper body: rotates about the hips (tilt + a small weight-shift sway on every step) ----
  const sway = mode === "march" ? 1.6 * Math.sin(two * phase) : mode === "stroll" ? 1.0 * Math.sin(two * phase) : 0;
  const A = tilt + sway;
  p.rot = A ? [rad(A), 300, hipY] : null;
  const dress = !!o.dress && mode !== "sit" && mode !== "fall";
  const T: Blob = { a: ((Bd.tw / 2) * W) / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: o.build === "stout" ? 0.17 : 0.12,
    asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sh = (side: number): P2 => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const hang = (side: number, fwd: number): [P2, P2, P2] => {
    const S = sh(side), ex = tcx + side * (1.12 * T.a + 4 * u);
    const hx = ex + side * 3 * u - side * 6 * u * Math.max(0, fwd) + side * 4 * u * Math.max(0, -fwd);
    return [S, [ex, S[1] + 0.48 * HH], [hx, chin + 1.04 * HH - Math.abs(fwd) * 9 * u]];
  };
  const sw = mode === "march" || mode === "stroll" ? Math.sin(two * phase) : 0;
  // rifle at the order: butt by the right hip, held by the hanging right hand, muzzle past the crown
  const R0: P2 = [300 + 47 * u, torsoBot + 0.12 * HH], R1: P2 = [300 + 64 * u, crown - 0.32 * HH];
  const rifle = !!o.rifle && (mode === "march" || mode === "stand" || mode === "stroll");
  type Arm = { pts: [P2, P2, P2]; front: boolean; can?: boolean }; // can = this hand carries the oil can (pourBowl)
  const arms: Arm[] = [];
  if (mode === "sit") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.1 * T.a + 6 * u), sh(side)[1] + 0.4 * HH], [tcx + side * (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH]], front: false });
  else if (mode === "fall") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.15 * T.a + 12 * u), sh(side)[1] - 0.25 * HH], [tcx + side * (1.3 * T.a + 24 * u), sh(side)[1] - 0.68 * HH]], front: false });
  else if (prop === "wheel") {
    // both hands grip the wheel rim at chest height, in front of the coat (the wheel itself is world geometry)
    for (const side of [-1, 1] as const) {
      const S = sh(side);
      arms.push({ pts: [S, [tcx + side * 0.5 * T.a, S[1] + 0.3 * HH], [tcx + side * 0.48 * T.a, chin + 0.52 * HH]], front: true });
    }
  } else {
    arms.push({ pts: prop === "shako" ? hang(-1, 0) : hang(-1, -sw), front: false });
    if (rifle) {
      const G = lerp2(R0, R1, 0.1);
      arms.push({ pts: [sh(1), [tcx + 1.12 * T.a + 5 * u, sh(1)[1] + 0.45 * HH], G], front: false });
    } else if (wave !== undefined) {
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.1 * T.a + 10 * u + 3 * u * wave, S[1] - 0.22 * HH], [tcx + 1.18 * T.a + 16 * u + 12 * u * wave, S[1] - 0.6 * HH]], front: false });
    } else if (prop === "icecream") {
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.45 * HH], [tcx + 0.5 * T.a, S[1] + 0.4 * HH]], front: true });
    } else if (prop === "staff") {
      // measuring rod: right hand grips it at chest height, rod drawn upright in front of the body
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.42 * HH], [tcx + 0.55 * T.a, S[1] + 0.38 * HH]], front: true });
    } else if (prop === "oilcan") {
      // oil can held at the hip, ready: right hand grips it at chest height in front of the coat
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.0 * T.a + 4 * u, S[1] + 0.42 * HH], [tcx + 0.5 * T.a, S[1] + 0.42 * HH]], front: true });
    } else if (Array.isArray(prop) && prop[0] === "pourBowl") {
      // v5 S5 (pour-staging fix): the pouring arm is RAISED to head height and out to the bowl's side,
      // not down at the waist. Geometry (S5a lens, verified by projection, f469): the bowl centre
      // [3.8, 1.03, 1.4] sits 0.6 m behind the card and only 0.15 m to the card's +x side, so its dark
      // interior projects to screen x 38-71% / y 46-55% — directly behind the cook's head — and the
      // card point over it is design (359, 357), inside the face. The v3 waist-high hand put the
      // thread at screen (59%, 63-64%): below the bowl, on the rail bar, 18 units long at f469
      // (k = 0.39) — invisible. The raised hand puts the spout above the rim on screen and the
      // thread at design x ≈ 459-466, dropping straight through the bowl's right interior
      // (screen x 67-70%, y 44-54%, ending at the water, clear of both rail bars and the caption
      // band). k 0 = can held upright at upper-chest height beside the head; k 1 = fully tipped at
      // toque height, spout down-right over the bowl. The left hand still steadies the crate edge.
      // `can` marks the hand that carries the oil can.
      const k = clamp(prop[1], 0, 1), S = sh(1), SL = sh(-1);
      const E = lerp2([tcx + 1.7 * T.a, chin - 0.13 * HH], [tcx + 1.68 * T.a, chin - 0.44 * HH], k);
      const Hd = lerp2([tcx + 1.2 * T.a, chin - 0.42 * HH], [tcx + 1.1 * T.a, chin - 0.82 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true, can: true });
      const EL = lerp2([tcx - 1.05 * T.a - 4 * u, SL[1] + 0.3 * HH], [tcx - 0.6 * T.a, SL[1] + 0.55 * HH], k);
      const HdL = lerp2([tcx - 0.55 * T.a, SL[1] + 0.35 * HH], [tcx - 0.42 * T.a, chin + 0.72 * HH], k);
      arms.push({ pts: [SL, EL, HdL], front: true });
    } else if (Array.isArray(prop) && prop[0] === "pour") {
      // the pour: the right arm swings out over the rail as the can tips (k 0 -> 1, snap-and-settle from cast.ts)
      const S = sh(1), k = clamp(prop[1], 0, 1);
      const E = lerp2([tcx + 1.05 * T.a + 4 * u, S[1] + 0.3 * HH], [tcx + 1.35 * T.a + 16 * u, S[1] + 0.45 * HH], k);
      const Hd = lerp2([tcx + 0.55 * T.a, S[1] + 0.35 * HH], [tcx + 0.95 * T.a + 10 * u, S[1] + 0.55 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true });
    } else if (Array.isArray(prop)) {
      const S = sh(1), k = clamp(prop[1], 0, 1);
      if (prop[0] === "saw") {
        // sawing: the hand slides back and forth horizontally at chest height
        const E = lerp2([tcx + 1.15 * T.a + 14 * u, S[1] + 0.28 * HH], [tcx + 0.95 * T.a + 2 * u, S[1] + 0.28 * HH], k);
        const Hd = lerp2([tcx + 1.35 * T.a + 26 * u, S[1] + 0.3 * HH], [tcx + 1.1 * T.a + 8 * u, S[1] + 0.3 * HH], k);
        arms.push({ pts: [S, E, Hd], front: true });
      } else {
        const E = lerp2([tcx + 1.1 * T.a + 10 * u, S[1] - 0.15 * HH], [tcx + 1.2 * T.a + 10 * u, S[1] + 0.3 * HH], k);
        const Hd = lerp2([tcx + 1.15 * T.a + 14 * u, S[1] - 0.55 * HH], [tcx + 1.45 * T.a + 22 * u, S[1] + 0.35 * HH], k);
        arms.push({ pts: [S, E, Hd], front: true });
      }
    } else arms.push({ pts: hang(1, sw), front: false });
  }
  const drawArm = (a: Arm) => { p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol); p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u); };
  // behind the body: rifle, sword, arms
  if (rifle) {
    p.band([R0, R1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(R0, R1, 0.6), R1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  if (o.sword && mode !== "sit") {
    const s0: P2 = [tcx - 0.75 * T.a, torsoBot - 0.2 * HH];
    p.band([s0, [s0[0] - Math.sin(rad(25)) * 0.8 * HH, s0[1] + Math.cos(rad(25)) * 0.8 * HH]], "#c9ccd2", 3 * u, 1.2 * u, "round");
  }
  for (const a of arms) if (!a.front) drawArm(a);
  // torso / dress: shaded fill -> clothing clipped to it -> thick-thin ink ring
  if (dress) {
    const D: Blob = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0.03 * facing, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(300, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, o.dress!, mul(o.dress!, SH_CLOTH), light);
    p.inkRing(dp, ow, thick);
    const Sw: Blob = { a: 0.37 * W, b: 0.3 * HH, nTop: 2.2, nBot: 2.4, egg: 0.1, asym: 0, rot: 0, noise: 0.006, seed: seed + 8 };
    const sp = blobPts(300, chin + 0.12 * HH, Sw);
    p.gradFill(sp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.inkRing(sp, ow * 0.9, thick);
  } else {
    p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.clip(tp, () => {
      if (o.stripes) { // v3 sailor's striped vest: 3 white bands across the chest, clipped to the torso
        for (const yy of [0.3, 0.55, 0.8]) p.band([[tcx - 1.2 * T.a, chin + yy * HH], [tcx + 1.2 * T.a, chin + yy * HH]], o.stripes, 0.09 * HH, 0);
      }
      if (o.belt) {
        for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
        const xc = tcx + 0.025 * T.a, yc = chin - 0.05 * HH + (torsoBot - 0.1 * HH - (chin - 0.05 * HH)) * (0.75 / 1.55);
        p.poly([[xc - 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc + 3.5 * u], [xc - 3.5 * u, yc + 3.5 * u]], "#d9dde0", 1.5 * u);
      }
      if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
      for (let i = 0; i < 4; i++) {
        const y = chin + 0.12 * HH + i * 0.2 * HH;
        if (o.sash && Math.abs(y - (torsoBot - 0.32 * HH)) < 0.08 * HH) continue;
        p.dot(tcx + 2 * u * facing, y, 2.2 * u + 0.8 * u, INK); p.dot(tcx + 2 * u * facing, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
      }
      if (o.apron) { // v3 cook's apron: panel over the lower coat front (covers the lower buttons), waist tie + pocket
        p.poly([[tcx - 0.42 * T.a, chin + 0.42 * HH], [tcx + 0.42 * T.a, chin + 0.42 * HH],
          [tcx + 0.52 * T.a, torsoBot - 0.02 * HH], [tcx - 0.52 * T.a, torsoBot - 0.02 * HH]], o.apron, 2 * u);
        p.band([[tcx - 0.55 * T.a, torsoBot - 0.42 * HH], [tcx + 0.55 * T.a, torsoBot - 0.42 * HH]], shade(o.apron, 0.82), 4 * u, 1 * u);
        p.poly(rrect(tcx - 0.3 * T.a, chin + 0.68 * HH, tcx + 0.02 * T.a, chin + 0.86 * HH, 4 * u), null, 1.8 * u);
      }
    });
    if (o.sash) { const s = facing || 1; p.poly([[tcx + s * 0.55 * T.a, torsoBot - 0.3 * HH], [tcx + s * 0.75 * T.a, torsoBot + 0.05 * HH], [tcx + s * 0.45 * T.a, torsoBot + 0.02 * HH]], o.sash, 1.6 * u); }
    p.inkRing(tp, ow, thick);
    if (o.epaulettes) { // v3 captain's gold epaulettes: pads on both shoulders + fringe ticks
      for (const s of [-1, 1]) {
        const ex = tcx + s * 0.72 * T.a, ey2 = chin + 0.14 * HH;
        p.ell(ex, ey2, 0.24 * T.a, 0.075 * HH, o.epaulettes, 2 * u);
        for (let j = -1; j <= 1; j++) p.stroke([[ex + j * 0.1 * T.a, ey2 + 0.06 * HH], [ex + j * 0.1 * T.a, ey2 + 0.13 * HH]], 1.6 * u, o.epaulettes);
      }
    }
  }
  // in front of the body: hands holding props
  for (const a of arms) if (a.front) {
    drawArm(a);
    const [hx, hy] = a.pts[2];
    if (prop === "icecream") {
      p.poly([[hx - 8 * u, hy - 12 * u], [hx + 8 * u, hy - 12 * u], [hx, hy + 7 * u]], "#e0a35a", 1.8 * u);
      p.ell(hx, hy - 19 * u, 11 * u, 10 * u, "#f7c6d9", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (prop === "oilcan") {
      // v3: the can itself is the 3D mesh (world.ts buildHeldOilCan) — the card keeps the
      // gripping hand only, so the stills never show two cans.
      p.dot(hx, hy, 5.5 * u);
    } else if (Array.isArray(prop) && prop[0] === "pour") {
      const k = clamp(prop[1], 0, 1);
      // v3: can is the 3D mesh (tilt mirrors pourK) — the card keeps the arm + gold stream only.
      if (k > 0.15) pourStream(p, hx + 26 * u, hy + 6 * u, u, k);
      p.dot(hx, hy, 5.5 * u);
    } else if (Array.isArray(prop) && prop[0] === "pourBowl") {
      // v3 S5: the can ONLY in the marked hand (a.can) — the steadying hand gets its ink dot only
      if (a.can) {
        const k = clamp(prop[1], 0, 1);
        // v5: tilt sign FIXED. v3 used rad(-8 - 62k), copied from the 3D can's -z rotation — but
        // canvas y runs DOWN, so -70 deg swung the spout UP-LEFT while the thread fell down-right
        // of the grip: spout and thread never met, and the "fully tipped" can read upright. In
        // canvas space the spout tips down-right with a POSITIVE angle: at +70 deg the spout tip
        // sits at (hx + 26u, hy + 18u) and the thread drops straight down through it from
        // (hx + 26u, hy + 6u) — spout and thread read as one pour, the same down-right tip as
        // the 3D can (world.ts heldCan, -z rotation in y-up space).
        oilCan(p, hx, hy, u, rad(8 + 62 * k));
        if (k > 0.15) pourThread(p, hx + 26 * u, hy + 6 * u, u, k);
      }
      p.dot(hx, hy, 5.5 * u);
    } else if (prop === "staff") {
      // measuring rod: ground to above the crown, tick marks, red tip; the hand grips it at chest height
      p.band([[hx, sole - 2 * u], [hx, crown - 0.28 * HH]], "#d8c49a", 4 * u, 1.2 * u, "round");
      for (let i = 1; i <= 8; i++) {
        const ty = sole - 2 * u - (i * (sole - crown)) / 9;
        p.stroke([[hx - 4 * u, ty], [hx + (i % 2 ? 6 : 3) * u, ty]], 1.6 * u);
      }
      p.dot(hx, crown - 0.28 * HH, 3 * u, "#b03a2e");
      p.dot(hx, hy, 5.5 * u);
    } else if (Array.isArray(prop) && prop[0] === "saw") {
      // saw blade extends forward from the hand, serrated lower edge (blade ~3x the
      // old 40 u, so it reads at 8-12 m). Tilt +25 deg about the hand so the blade tips
      // down toward the rock (canvas y-down: positive angle = clockwise).
      const savedRot = p.rot;
      p.rot = [rad(25), hx, hy];
      const bx0 = hx - 12 * u, bx1 = hx + 118 * u;
      p.poly([[hx - 34 * u, hy - 4 * u], [hx - 12 * u, hy - 4 * u], [hx - 12 * u, hy + 4 * u], [hx - 34 * u, hy + 4 * u]], "#8a5a34", 1.8 * u); // handle
      p.poly([[bx0, hy - 7 * u], [bx1, hy - 7 * u], [bx1, hy + 4 * u], [bx0, hy + 4 * u]], "#d5d8dd", 2.2 * u);
      p.stroke([[bx0, hy - 7 * u], [bx1, hy - 7 * u]], 2 * u, "#5a6068");
      for (let i = 0; i < 9; i++) { const tx = bx0 + 6 * u + i * 13 * u; p.stroke([[tx, hy + 4 * u], [tx + 6 * u, hy + 10 * u]], 1.8 * u); }
      p.dot(hx, hy, 5.5 * u);
      p.rot = savedRot;
    } else if (Array.isArray(prop)) {
      const ang = rad(-70 + 105 * clamp(prop[1], 0, 1));
      const Rh = (pts: P2[]) => rotPts(pts, ang, hx, hy);
      p.band(Rh([[hx, hy + 12 * u], [hx, hy - 44 * u]]), "#8a5a34", 5 * u, 1.5 * u, "round");
      p.poly(Rh([[hx - 12 * u, hy - 58 * u], [hx + 20 * u, hy - 58 * u], [hx + 20 * u, hy - 42 * u], [hx - 12 * u, hy - 42 * u]]), "#7d848c", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    }
  }
  if (prop === "shako") { // carried by the left hand
    const [hx, hy] = arms[0].pts[2];
    p.poly([[hx - 14 * u, hy + 3 * u], [hx + 14 * u, hy + 3 * u], [hx + 16 * u, hy + 30 * u], [hx - 16 * u, hy + 30 * u]], "#3a3d47", 2.2 * u);
    p.ell(hx, hy + 31 * u, 3.5 * u, 3.5 * u, "#2b7a4b", 1.5 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  // ---- head: rotates with the body, plus its own tilt about the chin ----
  const Ah = A + headTilt, [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = Ah ? [rad(Ah), 300, chin, cpx - 300, cpy - chin] : null;
  hatBehind(p, o, H, 300, hc, light, thick, ow, false);
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
  const brim = !!o.hat && o.hat !== "hair" && o.hat !== "bonnet" && o.hat !== "cap" && o.hat !== "bandana";
  faceFront(p, 300, hc, W, expr, facing, look, lid, brim, skin, o.moustache, o.build === "stout", mouthOv);
  p.rot = null;
};

export type SideOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stand" | "swing" | "push"; blink?: boolean | number; stomp?: number; pose?: number;
  prop?: ["pour", number] | ["pourBowl", number] | null; mouth?: MouthK;
  /** step length as a multiple of 0.8 m (370 units): matches 1.6 m/s at 2 steps/s; scale by the view's foreshortening */
  stride?: number; light?: number; seed?: number;
  /** push mode: where the hands land at pose 1, in final canvas units (e.g. the swing kid's back) */
  hand?: [number, number];
};

/** two-bone leg, knee bending forward (+x) */
const ik = (hip: P2, ank: P2, l1: number, l2: number): P2 => {
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.01);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), k = Math.atan2(dy, dx) - A;
  return [hip[0] + l1 * Math.cos(k), hip[1] + l1 * Math.sin(k)];
};

/** hip height of the seated kid in `swing` mode (design units); swingKid seats the torso bottom on the plank */
const SWING_HIP = 733;

/** side view facing screen-right; march footfalls land at phase 0 (near foot) and 0.5 (far foot), like the front view.
 *  The stance foot is planted: it slides back at exactly the walking speed while the hip rises and falls over it. */
export const bodySide = (p: Pen, o: Outfit, opts: SideOpts) => {
  const { phase = 0, expr = "neutral", mode = "march", blink = false, stomp = 1, pose = 0, stride = 1, light = DEF_LIGHT, seed = 1,
    prop = null, mouth: mouthOv } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H: Blob = { ...headBlob(seed, Bd.a, 1), asym: 0.12, rot: rad(3 + 3 * (rnd(seed, 7) - 0.5)) };
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, sole = 975, ankY = sole - 4 * u;
  const thick = thickAngle(light), ow = 5 * u;
  const legLen = (Bd.legs + 0.12) * HH - 4 * u, l1 = legLen / 2, l2 = legLen / 2;
  const nearCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), footCol = o.boots;
  type LegS = { ank: P2; pitch: number; near: boolean };
  const legs: LegS[] = [];
  let hipY = ankY - legLen * 0.995, lean = 0, nearFwd = 0;
  if (mode === "march") {
    const S = 370 * stride, liftH = Math.max(22, 40 + 70 * (stomp - 1));
    const st = (ph: number) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) { const s = c / 0.5; return { x: S / 2 - S * s, h: 0, stance: true, s }; }
      const s = (c - 0.5) / 0.5; // swing: cycloid in world space, so the foot leaves and lands at zero ground speed
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(2 * Math.PI * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = legLen * (1 - 0.035 * Math.sin(Math.PI * stance.s));
    hipY = ankY - Math.sqrt(Math.max(1, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]] as const)
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(35 * Math.sin(Math.PI * L.s) * (1 - 1.6 * L.s)), near });
    lean = 4 + 3 * Math.cos(2 * two * phase); // 7 deg at contact, 1 deg at passing
    nearFwd = nL.x / (S / 2);
  } else if (mode === "push") {
    hipY = ankY - 0.87 * legLen;
    legs.push({ ank: [300 - 0.5 * legLen, ankY], pitch: rad(-8), near: false }, { ank: [300 + 0.32 * legLen, ankY], pitch: 0, near: true });
    lean = 14 * pose;
  } else if (mode === "swing") {
    hipY = SWING_HIP;
    const a = rad(60 * pose);
    for (const [dx, near] of [[-6, false], [0, true]] as const) {
      const knee: P2 = [300 + l1 * 0.98 + dx * u, hipY + 6 * u];
      legs.push({ ank: [knee[0] + l2 * Math.sin(a), knee[1] + l2 * Math.cos(a)], pitch: -a * 0.5, near });
    }
  } else {
    legs.push({ ank: [300 - 4 * u, ankY], pitch: 0, near: false }, { ank: [300 + 4 * u, ankY], pitch: 0, near: true });
  }
  const torsoBot = hipY + 0.12 * HH, chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hip: P2 = [300, hipY];
  p.rot = null;
  for (const L of legs) {
    const knee = mode === "swing" ? ([300 + l1 * 0.98 + (L.near ? 0 : -6 * u), hipY + 6 * u] as P2) : ik(hip, L.ank, l1, l2);
    const hp0: P2 = [300 + (L.near ? 0 : -5 * u), hipY];
    p.stroke([hp0, knee, L.ank], 5.8 * u, L.near ? nearCol : farCol);
    const c = Math.cos(L.pitch), s = Math.sin(L.pitch);
    footStroke(p, [L.ank[0] - 3 * u * c, L.ank[1] - 3 * u * s], [L.ank[0] + 13 * u * c, L.ank[1] + 13 * u * s + 0.5 * u],
      7.5 * u, L.near ? footCol : footCol === INK ? INK : shade(footCol, 0.82));
  }
  // ---- upper body leans about the hip ----
  p.rot = lean ? [rad(lean), 300, hipY] : null;
  const T: Blob = { a: (o.build === "stout" ? 0.36 : 0.31) * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.5, egg: 0.1, asym: 0.06,
    rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const armCol = mix(o.jacket, INK, 0.5), farArm = mix(o.jacket, INK, 0.68);
  const S: P2 = [tcx + 0.05 * T.a, chin + 0.14 * HH], aLen = 0.95 * HH;
  const swingArm = (ang: number): [P2, P2, P2] => {
    const e: P2 = [S[0] + Math.sin(ang) * aLen * 0.5, S[1] + Math.cos(ang) * aLen * 0.5], a2 = ang + rad(16) * Math.sign(ang || 1);
    return [S, e, [e[0] + Math.sin(a2) * aLen * 0.5, e[1] + Math.cos(a2) * aLen * 0.5]];
  };
  const rifle = !!o.rifle && (mode === "march" || mode === "stand");
  const B0: P2 = [tcx + 0.72 * T.a, chin + 0.58 * HH], B1: P2 = [tcx - 0.95 * T.a - 22 * u, crown - 0.4 * HH];
  let near: [P2, P2, P2], far: [P2, P2, P2] | null;
  if (mode === "swing") { near = [S, [S[0] + 12 * u, S[1] - 0.16 * HH], [300 + 6 * u, chin - 0.3 * HH]]; far = [S, [S[0] + 8 * u, S[1] - 0.18 * HH], [300 + 2 * u, chin - 0.36 * HH]]; }
  else if (mode === "push") {
    const reach = 0.55 * HH + 0.45 * HH * pose;
    let hN: P2 = [S[0] + reach, S[1] + 0.06 * HH];
    if (opts.hand) {
      // target is in final canvas units; the arm is drawn inside the lean rotation, so undo it
      const th = -rad(lean), dx = opts.hand[0] - 300, dy = opts.hand[1] - hipY;
      const tg: P2 = [300 + dx * Math.cos(th) - dy * Math.sin(th), hipY + dx * Math.sin(th) + dy * Math.cos(th)];
      hN = [hN[0] + (tg[0] - hN[0]) * pose, hN[1] + (tg[1] - hN[1]) * pose];
    }
    near = [S, [(S[0] + hN[0]) / 2, (S[1] + hN[1]) / 2 + 0.06 * HH], hN];
    far = [S, [(S[0] + hN[0]) / 2 - 4 * u, (S[1] + hN[1]) / 2 - 0.02 * HH], [hN[0] - 6 * u, hN[1] - 0.08 * HH]];
  } else if (Array.isArray(opts.prop) && opts.prop[0] === "pourBowl") {
    // v3 S5 in profile: both hands reach down-forward over the crate as the can tips (k 0 -> 1)
    const k = clamp(opts.prop[1], 0, 1), reach = 0.72 * HH * (0.55 + 0.45 * k);
    near = [S, [S[0] + reach * 0.55, S[1] + 0.16 * HH], [S[0] + reach, S[1] + 0.34 * HH]];
    far = [S, [S[0] + reach * 0.4, S[1] + 0.2 * HH], [S[0] + reach * 0.72, S[1] + 0.42 * HH]];
  } else if (Array.isArray(opts.prop) && opts.prop[0] === "pour") {
    // the pour in profile: the near arm reaches out over the rail as the can tips (k 0 -> 1)
    const k = clamp(opts.prop[1], 0, 1), reach = 0.8 * HH * (0.55 + 0.45 * k);
    near = [S, [S[0] + reach * 0.55, S[1] + 0.12 * HH], [S[0] + reach, S[1] + 0.28 * HH]];
    far = swingArm(rad(8));
  } else if (rifle) { near = [S, [S[0] - 4 * u, S[1] + 0.42 * HH], B0]; far = mode === "march" ? swingArm(rad(30) * nearFwd) : swingArm(0); }
  else { near = swingArm(rad(-30) * nearFwd); far = mode === "march" ? swingArm(rad(30) * nearFwd) : null; }
  if (far) { p.stroke(curve(far[0], far[1], far[2]), 5.2 * u, farArm); p.dot(far[2][0], far[2][1], 5.5 * u); }
  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.stripes) { // v3 sailor's striped vest, in profile too
      for (const yy of [0.3, 0.55, 0.8]) p.band([[tcx - 1.1 * T.a, chin + yy * HH], [tcx + 1.1 * T.a, chin + yy * HH]], o.stripes, 0.09 * HH, 0);
    }
    if (o.belt) p.band([[tcx - 0.65 * T.a, chin - 0.05 * HH], [tcx + 0.75 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (!o.dress) for (let i = 0; i < 3; i++) { const y = chin + 0.16 * HH + i * 0.24 * HH; p.dot(tcx + 0.8 * T.a, y, 3 * u, INK); p.dot(tcx + 0.8 * T.a, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7)); }
    if (o.apron) { // v3 cook's apron, front half of the torso in profile
      p.poly([[tcx + 0.05 * T.a, chin + 0.45 * HH], [tcx + 0.92 * T.a, chin + 0.45 * HH],
        [tcx + 0.92 * T.a, torsoBot - 0.02 * HH], [tcx + 0.05 * T.a, torsoBot - 0.02 * HH]], o.apron, 2 * u);
      p.band([[tcx + 0.05 * T.a, torsoBot - 0.42 * HH], [tcx + 0.92 * T.a, torsoBot - 0.42 * HH]], shade(o.apron, 0.82), 4 * u, 1 * u);
    }
  });
  p.inkRing(tp, ow, thick);
  if (o.epaulettes) { // v3 captain's gold epaulette on the near shoulder, in profile
    const ex = tcx + 0.1 * T.a, ey2 = chin + 0.14 * HH;
    p.ell(ex, ey2, 0.22 * T.a, 0.075 * HH, o.epaulettes, 2 * u);
    for (let j = -1; j <= 1; j++) p.stroke([[ex + j * 0.08 * T.a, ey2 + 0.06 * HH], [ex + j * 0.08 * T.a, ey2 + 0.13 * HH]], 1.6 * u, o.epaulettes);
  }
  if (rifle) {
    p.band([B0, B1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(B0, B1, 0.6), B1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  p.stroke(curve(near[0], near[1], near[2]), 5.2 * u, armCol); p.dot(near[2][0], near[2][1], 5.5 * u);
  if (Array.isArray(opts.prop) && opts.prop[0] === "pour") {
    const [hx, hy] = near[2], k = clamp(opts.prop[1], 0, 1);
    // v3: can is the 3D mesh — the card keeps the gold stream only.
    if (k > 0.15) pourStream(p, hx + 24 * u, hy + 8 * u, u, k);
  }
  if (Array.isArray(opts.prop) && opts.prop[0] === "pourBowl") { // v3 S5 in profile: can tipped, thin thread
    const [hx, hy] = near[2], k = clamp(opts.prop[1], 0, 1);
    oilCan(p, hx, hy, u, rad(8 + 62 * k)); // v5: sign as the front view (canvas y-down; -70 deg put the spout up)
    if (k > 0.15) pourThread(p, hx + 24 * u, hy + 8 * u, u, k);
  }
  // ---- head ----
  const hx = 300 + 4 * u;
  hatBehind(p, o, H, hx, hc, light, thick, ow, true);
  const hp = blobPts(hx, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatOn(p, o, hp, H, hx, hc, light, seed, 1, true);
  const brim = !!o.hat && o.hat !== "hair" && o.hat !== "bonnet" && o.hat !== "cap" && o.hat !== "bandana";
  faceSide(p, hx, hc, W, expr, lid, brim, skin, o.moustache, o.build === "stout", mouthOv);
  p.rot = null;
};

/** rope + seat + seated kid on a 700 x 2300 canvas; the pivot is design (350, 20); kid drawn at 0.92 scale */
export const swingKid = (p: Pen, o: Outfit, kick: number, expr: Expr, light = DEF_LIGHT, blink: number = 0) => {
  const rope = 1830, k = 1.1, HH = 2 * headBlob(5, BUILD[o.build ?? "adult"].a, 1).b;
  // two ropes from the pivot to the ends of a wide plank, the kid framed between them: a single rope behind the kid
  // ended at the cap and read as a hanging. Far rope behind the kid, near rope drawn over (clear of the face).
  const seat = rope + 18, x0 = 150, x1 = 550;
  p.line([[350, 20], [x0 + 16, seat + 4]], "#a07a4c", 10);
  p.poly(rrect(x0, seat, x1, seat + 36, 10), "#b5653f", 9);
  const g = p.g;
  g.save();
  g.translate(350 - 300 * k, rope + 18 - (SWING_HIP + 0.12 * HH) * k);
  g.scale(k, k);
  bodySide(new Pen(g), o, { expr, mode: "swing", pose: kick, light, seed: 5, blink });
  g.restore();
  p.line([[350, 20], [x1 - 16, seat + 4]], "#a07a4c", 10);
};

// ---------------- effects ----------------
export const fxNote = (p: Pen, kind: number, col = "#1f2a44") => {
  p.ell(70, 200, 46, 34, col, 8, 0, 360, -20);
  p.stroke([[110, 190], [110, 40]], 14);
  if (kind === 0) p.poly([[110, 40], [170, 70], [170, 110], [110, 82]], col, 8);
  else {
    p.ell(150, 170, 40, 30, col, 8, 0, 360, -20);
    p.stroke([[186, 160], [186, 20]], 14);
    p.poly([[110, 40], [186, 20], [186, 50], [110, 70]], col, 8);
  }
};

/** spark / impact star on a 500 x 500 canvas; t in 0..1 */
export const fxBurst = (p: Pen, t: number, col = "#fff3b0", rays = 10, r0 = 40, r1 = 230) => {
  const c = 250, e = 1 - (1 - t) ** 3;
  for (let i = 0; i < rays; i++) {
    const a = rad((i * 360) / rays + 7 * (i % 2)), ra = r0 + (r1 - r0) * e * (0.75 + 0.25 * (i % 2));
    p.poly([[c + r0 * 0.5 * Math.cos(a + 0.18), c + r0 * 0.5 * Math.sin(a + 0.18)], [c + ra * Math.cos(a), c + ra * Math.sin(a)],
      [c + r0 * 0.5 * Math.cos(a - 0.18), c + r0 * 0.5 * Math.sin(a - 0.18)]], col, Math.max(3, 8 * (1 - t)));
  }
  if (t < 0.5) p.ell(c, c, r0 * (1.4 - t), r0 * (1.4 - t), WHITE, 8);
};

/** water splash crown on an 800 x 800 canvas; t in 0..1 */
export const fxSplash = (p: Pen, t: number) => {
  const c = 400, size = 800, rise = Math.sin(Math.min(1, t * 1.3) * Math.PI);
  const blue = "#bfe8ff", deep = "#6cc0f0";
  if (rise > 0.02) {
    const pts: P2[] = [];
    for (let i = 0; i < 19; i++) {
      const h = (i % 2 ? 260 : 130) * rise * (0.7 + 0.3 * Math.sin(i * 1.7));
      pts.push([c - 330 + (660 * i) / 18, size - 120 - h]);
    }
    p.poly([...pts, [c + 330, size - 90], [c - 330, size - 90]], blue, 10);
    p.ell(c, size - 100, 360, 46, deep, 10);
  }
  for (let i = 0; i < 8; i++) {
    const a = rad(200 + i * 18), d = 120 + 380 * t, y = size - 160 + d * Math.sin(a) + 520 * t * t, r = 26 * (1 - t) + 6;
    if (t > 0.08 && y < size - 40) p.ell(c + d * Math.cos(a), y, r, r * 1.25, blue, 7);
  }
};

/** dust puff on a 300 x 300 canvas; t in 0..1 */
export const fxPuff = (p: Pen, t: number) => {
  for (let i = 0; i < 9; i++) {
    const ox = ((i * 37) % 90) - 45, oy = ((i * 53) % 70) - 35, rr = 26 + ((i * 29) % 32);
    const a = rad(160 + i * 40), d = 30 + 60 * t;
    const cx = 150 + d * Math.cos(a) + ox * (0.7 + 0.5 * t);
    const cy = 180 + d * 0.45 * Math.sin(a) + oy * (0.7 + 0.5 * t);
    const r = rr * (0.7 + 0.5 * t);
    const alpha = (1 - t) * (0.35 + 0.2 * ((i * 7) % 3) / 2);
    p.ell(cx, cy, r, r * 0.8, `rgba(238,225,205,${alpha.toFixed(3)})`, 0);
  }
};

/** circling stars on a 420 x 210 canvas */
export const fxStars = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) {
    const a = t * Math.PI * 2 + (i * Math.PI) / 2, x = 210 + 150 * Math.cos(a), y = 110 + 40 * Math.sin(a), pts: P2[] = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, b = rad(k * 36 - 90); pts.push([x + r * Math.cos(b), y + r * Math.sin(b)]); }
    p.poly(pts, "#ffd84a", 6);
  }
};

/** three jittering strain ticks on a 300 x 300 canvas */
export const fxCreak = (p: Pen, t: number) => {
  const j = 6 * Math.sin(t * 40);
  for (const a of [-30, 0, 30]) {
    const b = rad(a - 90);
    p.stroke([[150 + 70 * Math.cos(b) + j, 230 + 70 * Math.sin(b)], [150 + 100 * Math.cos(b) + 10 + j, 230 + 100 * Math.sin(b)],
      [150 + 130 * Math.cos(b) + j, 230 + 130 * Math.sin(b)]], 10);
  }
};

/** flat water ring (drawn top-down) on a 600 x 600 canvas; t in 0..1 */
export const fxRing = (p: Pen, t: number) => {
  // thin light water rings (white crest, pale blue trailing rings), thinning as they spread
  const g = p.g;
  for (let k = 0; k < 3; k++) {
    const u = t - k * 0.22;
    if (u <= 0 || u >= 1) continue;
    g.beginPath(); g.ellipse(300, 300, 60 + 230 * u, 60 + 230 * u, 0, 0, Math.PI * 2);
    g.strokeStyle = k === 0 ? "#f6fcff" : "#cfe8fa"; g.lineWidth = 9 * (1 - u) + 3; g.stroke();
  }
};

/** text-free sign on a 700 x 520 canvas: "no marching in step on the bridge". A bridge (deck + arch + piers), four
 *  identical pairs of marching legs in the same stride (in step), a bold red X over all of it. */
export const fxSign = (p: Pen) => {
  const g = p.g, RED = "#d42f2f";
  p.poly(rrect(14, 14, 686, 506, 40), "#f6ecd2", 0);
  p.poly(rrect(14, 14, 686, 506, 40), null, 14);
  // bridge: deck, stone arch underneath, two piers
  p.poly(rrect(70, 352, 630, 384, 8), "#8a5a3a", 9);
  g.beginPath(); g.moveTo(112, 470); g.quadraticCurveTo(350, 300, 588, 470);
  g.strokeStyle = INK; g.lineWidth = 16; g.lineCap = "round"; g.stroke();
  for (const x of [88, 612]) p.poly(rrect(x - 16, 384, x + 16, 470, 4), "#8a5a3a", 9);
  // four identical soldiers' legs mid-stride: same leg forward on every one = in step
  for (const x of [150, 278, 406, 534]) {
    p.poly(rrect(x - 30, 150, x + 30, 214, 14), "#357650", 9);                  // coat hem
    p.stroke([[x - 8, 210], [x + 34, 262], [x + 46, 338]], 15, INK);           // front leg
    p.stroke([[x + 6, 210], [x - 12, 274], [x - 36, 336]], 15, INK);           // back leg
    p.poly(rrect(x + 30, 330, x + 74, 350, 9), INK, 0);                          // boots point forward
    p.poly(rrect(x - 52, 328, x - 8, 348, 9), INK, 0);
  }
  // big red X
  for (const [a, b] of [[[96, 70], [604, 452]], [[604, 70], [96, 452]]] as [[number, number], [number, number]][]) {
    p.stroke([a, b], 58, "#ffffff");
    p.stroke([a, b], 42, RED);
  }
};

/** soft cartoon cloud on a 600 x 300 canvas */
export const fxCloud = (p: Pen, seed: number) => {
  const blobs: [number, number, number][] = [[150, 190, 80], [250, 150, 105], [360, 160, 95], [450, 195, 70], [300, 210, 90]];
  for (const [x, y, r] of blobs) p.ell(x + ((seed * 37) % 20) - 10, y, r, r * 0.8, "#ffffff", 0);
  p.ell(300, 235, 230, 40, "#ffffff", 0);
};

/** cast shadow on a 128 x 256 canvas: dark soft contact pool at the feet (y 205) and a softer tail that runs up the
 *  canvas = away from the sun, fading with distance; multiply colour (sRGB-encoded linear ratio), white = no change */
export const fxShadow = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 256);
  g.save(); g.filter = "blur(9px)";
  const lg = g.createLinearGradient(0, 205, 0, 22);
  lg.addColorStop(0, mix(col, WHITE, 0.08)); lg.addColorStop(0.55, mix(col, WHITE, 0.3)); lg.addColorStop(1, mix(col, WHITE, 0.85));
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(40, 205); g.bezierCurveTo(36, 120, 46, 50, 64, 30); g.bezierCurveTo(82, 50, 92, 120, 88, 205); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(64, 205, 30, 17, 0, 0, Math.PI * 2); g.fill();
  g.restore();
};

/** tight contact shadow right under the feet on a 128 x 128 canvas: dark core, short fall-off (multiply colour) */
export const fxContact = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.32, 0.02], [0.5, 0.22], [0.66, 0.58], [0.82, 0.88], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

/** floating wooden plank, side-on, on a 320 x 110 canvas */
export const fxPlank = (p: Pen) => {
  p.poly(rrect(14, 30, 306, 78, 10), "#a8744a", 9);
  p.line([[40, 46], [150, 44], [270, 50]], "#7d5234", 4);
  p.line([[60, 62], [200, 64], [284, 60]], "#7d5234", 4);
  p.dot(36, 54, 5, INK); p.dot(284, 54, 5, INK);
};

/** floating marching drum (no text) on a 260 x 240 canvas: white shell, red hoops, ink zig-zag cord */
export const fxDrum = (p: Pen) => {
  p.poly(rrect(40, 70, 220, 190, 16), "#f1ece0", 9);
  p.poly(rrect(32, 58, 228, 86, 12), "#c9373a", 8);
  p.poly(rrect(32, 176, 228, 204, 12), "#c9373a", 8);
  p.line([[52, 88], [82, 172], [112, 88], [142, 172], [172, 88], [202, 172]], INK, 6);
  p.ell(130, 58, 98, 18, "#f7f3ea", 8);
};

/** warm lantern pool on a 256 x 256 canvas: a soft amber glow (drawn soft/transparent over the deck) */
export const fxWarmPool = (p: Pen) => {
  const g = p.g;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,179,107,0.42)");
  gr.addColorStop(0.5, "rgba(255,179,107,0.18)");
  gr.addColorStop(1, "rgba(255,179,107,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};

/** soft ground contact blob on a 128 x 128 canvas, multiply colour (sRGB-encoded linear ratio) in the centre */
export const fxBlob = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  // soft contact shadow: flat core, then a long smooth (roughly gaussian) fall-off to white = no change
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.5, 0.04], [0.64, 0.18], [0.76, 0.42], [0.87, 0.72], [0.95, 0.92], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};
