// Word-by-word captions from words.json. 1-2 words at a time, each swap pops in over 4 frames
// (scale 0.8 -> 1.08 -> 1.03 -> 1.0). Bold rounded white font, solid black outline (about 8 px visible at
// 1080 wide) outside the letters, no shadow, no box. Script capitalisation, or all lowercase when the
// user chose it. Sizes are written for 1920-high frames and scaled.
import { FPS } from "../core/util.js";

export const CAPTION_STYLE = {
  font: "Nunito",
  weight: 900,
  sizePx: 88,          // font size at 1920 high: Nunito Black x-height is 0.51 em, so lowercase letters are about 45 px tall
  strokePx: 16,        // CSS stroke width; half is hidden behind the fill -> about 8 px visible
  centerFromBottom: 0.294, // caption centre 70.6 % from the top of the frame
  altFromBottom: 0.44,    // used when the normal spot would cover a face
  maxWidth: 0.86,
  pop: [0.8, 1.08, 1.03, 1.0], // scale on frames 0, 1, 2, 3+ of each caption
};

// Group words into caption chunks: one word, or two short words that are spoken close together.
export function chunkWords(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const a = words[i], b = words[i + 1];
    const short = (w) => w.text.replace(/[^\p{L}\p{N}']/gu, "").length <= 4;
    const endsClause = /[.,!?;:]$/.test(a.text);
    if (b && short(a) && short(b) && !endsClause && b.start - a.end < 0.12 && b.end - a.start < 0.6) {
      out.push({ text: a.text + " " + b.text, start: a.start, words: [a, b] }); i++;
    } else out.push({ text: a.text, start: a.start, words: [a] });
  }
  for (let i = 0; i < out.length; i++) out[i].end = out[i + 1] ? out[i + 1].start : out[i].words[out[i].words.length - 1].end + 0.3;
  return out;
}

export function makeCaptions(root, words, H, { enabled = true, lowercase = false, style = {} } = {}) {
  const S = H / 1920, st = { ...CAPTION_STYLE, ...style };
  const el = document.createElement("div");
  el.id = "caption";
  Object.assign(el.style, {
    position: "absolute", left: "0", right: "0", textAlign: "center", pointerEvents: "none",
    fontFamily: `"${st.font}", sans-serif`, fontWeight: String(st.weight), fontSize: `${st.sizePx * S}px`,
    lineHeight: "1.05", color: "#FFFFFF", whiteSpace: "nowrap",
    webkitTextStroke: `${st.strokePx * S}px #000000`, paintOrder: "stroke fill",
    letterSpacing: "0.005em", transformOrigin: "50% 50%", zIndex: "10", display: "none",
  });
  root.appendChild(el);
  const chunks = enabled ? chunkWords(words) : [];
  return {
    chunks,
    // decide once per chunk (pure function of the chunk's start time): move up if a face sits in the caption band
    planDodge(facesAt) {
      const cy = H * (1 - st.centerFromBottom), half = st.sizePx * S * 0.75;
      for (const c of chunks) c.dodge = facesAt(c.start + 0.05).some(([, y]) => Math.abs(y - cy) < half + H * 0.07);
    },
    update(t) {
      if (!enabled) return;
      let idx = -1;
      for (let i = 0; i < chunks.length; i++) if (t >= chunks[i].start && t < chunks[i].end) { idx = i; break; }
      if (idx < 0) { el.style.display = "none"; return; }
      const c = chunks[idx];
      el.textContent = lowercase ? c.text.toLowerCase() : c.text;
      el.style.display = "block";
      const f = Math.floor((t - c.start) * FPS + 1e-6);
      const scale = st.pop[Math.min(Math.max(f, 0), st.pop.length - 1)];
      const cy = H * (1 - (c.dodge ? st.altFromBottom : st.centerFromBottom));
      el.style.top = `${cy - st.sizePx * S * 0.55}px`;
      el.style.transform = `scale(${scale})`;
    },
  };
}
