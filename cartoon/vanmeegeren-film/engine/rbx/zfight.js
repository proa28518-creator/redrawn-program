// engine/rbx/zfight.js: the V4 flicker detector (experiments/roblox-style/v4/tools/flicker.mjs, V4-Z) as a pure module, so the
// Creatorize app runs it in its page on frames it draws itself (film_check zfight) and the lab keeps its mp4 tool. Same numbers:
// frames in grey at half size; a pixel FLICKERS at frame t when it jumps away for 1 or 2 frames and comes back:
//   1 frame:  min(|F[t]-F[t-1]|, |F[t]-F[t+1]|) - |F[t+1]-F[t-1]|                          > th
//   2 frames: min(|F[t]-F[t-1]|, |F[t+1]-F[t+2]|) - |F[t+2]-F[t-1]| - |F[t+1]-F[t]|            > th
// Smooth camera moves and cuts score low by construction; frames at a cut (mean grey change > 20) are skipped. Hot pixels are
// gathered in 8 px cells (16 px in the full frame), cells into regions, regions over nearby frames into events. Labels: "head"
// (inside a head disc of that frame), "caption" (the caption band), "wide" (over 35 % of the frame), else "scene". A z-fight, a pop or
// a speckle is a "scene" or "wide" event; the detector also counts camera motion streaming over floors and bricks (V4_DOCS f): the
// crops are LOOKED at before anything is called a z-fight.
//   const Z = createZfight({ w, h, W, H, th, captionBand })   w x h = the grey frame, W x H = the full frame (boxes in full px)
//   Z.push(grey, frameIndex, heads)    heads = [{ cx, cy, d }] in full px (the frame's head discs), grey = Uint8Array(w * h)
//   Z.finish() -> { frames, events }   events sorted by hot pixels: { label, f0, f1, f, n, frames, box: [x0, y0, x1, y1], hot }

export function createZfight({ w, h, W, H, th = 35, captionBand = [.6, .8] }) {
  const FS = w * h, CELL = 8, cw = Math.ceil(w / CELL), chh = Math.ceil(h / CELL), sx = W / w;
  const win = [], md = [], comps = [], headsOf = new Map();
  let fi = -1, first = null;
  function analyse(t) {
    const [A, B, C, D] = win, cut = x => (md[x] ?? 0) > 20;
    if (cut(t) || cut(t + 1)) return;
    const two = D && !cut(t + 2);
    const cells = new Uint16Array(cw * chh); let peakAll = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = A[i], b = B[i], c = C[i];
      let s = Math.min(Math.abs(b - a), Math.abs(b - c)) - Math.abs(c - a);
      if (two) { const d = D[i]; const s2 = Math.min(Math.abs(b - a), Math.abs(c - d)) - Math.abs(d - a) - Math.abs(c - b); if (s2 > s) s = s2; }
      if (s > th) { cells[((y / CELL) | 0) * cw + ((x / CELL) | 0)]++; if (s > peakAll) peakAll = s; }
    }
    const seen = new Uint8Array(cw * chh);
    for (let k = 0; k < cells.length; k++) {
      if (cells[k] < 2 || seen[k]) continue;
      const st = [k]; seen[k] = 1; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, hc = 0, hot = null;
      while (st.length) { const q = st.pop(), qx = q % cw, qy = (q / cw) | 0; n += cells[q]; if (cells[q] > hc) { hc = cells[q]; hot = [(qx + .5) * sx * CELL, (qy + .5) * sx * CELL]; } x0 = Math.min(x0, qx); y0 = Math.min(y0, qy); x1 = Math.max(x1, qx); y1 = Math.max(y1, qy);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= cw || ny >= chh) continue; const nk = ny * cw + nx; if (!seen[nk] && cells[nk] >= 2) { seen[nk] = 1; st.push(nk); } } }
      const s = sx * CELL; comps.push({ f: first + t, box: [x0 * s, y0 * s, (x1 + 1) * s, (y1 + 1) * s].map(Math.round), n, hot: hot && hot.map(Math.round), peak: peakAll });
    }
  }
  function label(c) {
    const cx = (c.box[0] + c.box[2]) / 2, cy = (c.box[1] + c.box[3]) / 2;
    if ((c.box[2] - c.box[0]) * (c.box[3] - c.box[1]) > .35 * W * H) return 'wide';
    for (const v of headsOf.get(c.f) || []) { const r = v.d * .6 + 16;
      if (v.d > 4 && v.d < H && c.box[0] >= v.cx - r && c.box[2] <= v.cx + r && c.box[1] >= v.cy - r && c.box[3] <= v.cy + r) return 'head'; }
    if (cy > H * captionBand[0] && cy < H * captionBand[1] && (c.box[2] - c.box[0]) > 40) return 'caption';
    return 'scene';
  }
  return {
    push(grey, frame, heads = []) {
      if (grey.length !== FS) throw new Error(`zfight: a grey frame must be ${w}x${h}`);
      if (first == null) first = frame;
      fi++; headsOf.set(frame, heads);
      if (win.length) { const L = win[win.length - 1]; let s = 0; for (let i = 0; i < FS; i += 7) s += Math.abs(grey[i] - L[i]); md[fi] = s / (FS / 7); }
      win.push(grey); if (win.length > 4) win.shift();
      if (win.length === 4) analyse(fi - 2);
    },
    finish() {
      if (win.length >= 3) { win.push(undefined); win.shift(); analyse(fi - 1); }
      const events = [];
      for (const c of comps) {
        c.label = label(c);
        const e = events.find(e => e.label === c.label && c.f - e.f1 <= 3 && c.box[0] <= e.box[2] + 32 && c.box[2] >= e.box[0] - 32 && c.box[1] <= e.box[3] + 32 && c.box[3] >= e.box[1] - 32);
        if (e) { e.f1 = c.f; e.n += c.n; e.frames++; e.box = [Math.min(e.box[0], c.box[0]), Math.min(e.box[1], c.box[1]), Math.max(e.box[2], c.box[2]), Math.max(e.box[3], c.box[3])]; if (c.n > e.worstN) { e.worstN = c.n; e.f = c.f; e.hot = c.hot; } }
        else events.push({ label: c.label, f0: c.f, f1: c.f, f: c.f, n: c.n, worstN: c.n, frames: 1, box: [...c.box], hot: c.hot });
      }
      events.sort((a, b) => b.n - a.n);
      return { frames: fi + 1, events };
    },
  };
}
