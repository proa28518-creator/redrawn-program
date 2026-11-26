// engine/rbx/captions.js: the Roblox Lightweight captions (V4), for a page (the Creatorize app's host, chost.js) and for node alike.
// No imports, no DOM until draw(). The SAME chunking and look as experiments/roblox-style/v3/tools/captions.mjs (the V4 films burned
// these with libass): V1's chunks (gap > .45 s splits, punctuation ends a chunk of 2+, '.!?' always, `max` words), the 'ref1' cards
// (V3_REF rule 8: 2-4 words, lowercase with exactly ONE word in CAPITALS, no punctuation, a card also breaks on a picture cut so it
// changes with the cut), V1's timing (t1 = min(next t0, last word end + .7), the last + .6), V1's look (Nunito 900, white, a 12 px
// #141414 stroke = 6 px outline, a soft shadow 5 px down, centred, y = opts.y of the frame, two-line split balanced the way V1 measured
// it). Widths come from the font's advance table (fonts/nunito-900.widths.json, the table captions.mjs uses) so the line split is the
// same as the delivered films, whatever the canvas measures.
//   const caps = captionCards(words, opts)      words = [{ word, start, end }] (the voice's own words), opts = film.rbx.captions
//   drawCaption(ctx, caps, t, opts, W, H, adv)  draws the card at t (if any) on a 2D context; adv = the widths table (loadWidths)

const STOP = new Set(['the', 'a', 'an', 'and', 'to', 'of', 'he', 'she', 'him', 'his', 'her', 'it', 'was', 'had', 'be', 'from', 'who', 'you', 'i', 'they', "they'd", "he'd", 'said', 'just', 'into', 'about', 'this', 'up', 'is']);

/** V1 chunking (rbx.js captions()), then 'ref1' cards when opts.style === 'ref1' */
export function captionCards(words, o = {}) {
  const emph = o.emph ? new Set(o.emph) : null;
  const ws = (words || []).map((w, i) => { let text = String(w.word).trim(); if (o.strip) text = text.replace(/[.,!?;:]+$/, '') || text; if (emph && emph.has(i)) text = text.toUpperCase();
    return { text, raw: String(w.word).trim(), start: +w.start, end: +w.end }; }).filter(w => w.text && w.start >= -.01);
  const max = o.style === 'ref1' ? 1e9 : (o.max || 7), chunks = []; let cur = [];
  const push = () => { if (cur.length) chunks.push(cur); cur = []; };
  ws.forEach((w, i) => { const gap = i && w.start - ws[i - 1].end > .45; if (gap && cur.length) push(); cur.push(w);
    const rt = w.raw || w.text, punct = /[.,!?;:]["')]?$/.test(rt); if ((punct && (cur.length >= 2 || /[.!?]/.test(rt))) || cur.length >= max) push(); });
  push();
  if (o.style === 'ref1') return ref1Cards(chunks, o);
  const caps = chunks.map(c => ({ text: c.map(w => w.text).join(' '), t0: c[0].start, t1: c[c.length - 1].end }));
  for (let i = 0; i < caps.length; i++) { const n = caps[i + 1]; caps[i].t1 = n ? Math.min(n.t0, caps[i].t1 + .7) : caps[i].t1 + .6; }
  return caps;
}

function ref1Cards(chunks, o) {
  const cuts = (o.cuts || []).slice().sort((a, b) => a - b), max = Math.min(o.max || 4, 4);
  const cards = [];
  for (const c of chunks) {
    const segs = []; let cur = [];
    c.forEach((w, i) => { const prev = c[i - 1]; const cutBetween = prev && cuts.some(t => t > prev.start + .05 && t <= w.start + .05);
      if (cur.length && cutBetween) { segs.push(cur); cur = []; } cur.push(w); });
    if (cur.length) segs.push(cur);
    for (const s of segs) { const n = s.length <= max + 1 ? 1 : Math.ceil(s.length / max), per = s.length / n;
      for (let k = 0; k < n; k++) cards.push(s.slice(Math.round(k * per), Math.round((k + 1) * per))); }
  }
  const clean = s => s.replace(/[.,!?;:"]+/g, '').toLowerCase();
  const out = cards.map(k => {
    const ws = k.map(w => clean(w.raw || w.text));
    let best = -1, bl = -1; ws.forEach((x, i) => { const l = STOP.has(x) ? 0 : x.length; if (l > bl) { bl = l; best = i; } });
    if (o.caps) k.forEach((w, i) => { if (o.caps.includes(clean(w.raw || w.text))) best = i; });
    ws[best] = ws[best].toUpperCase();
    return { text: ws.join(' '), t0: k[0].start, t1: k[k.length - 1].end, last: k[k.length - 1].start };
  });
  for (let i = 0; i < out.length; i++) { const n = out[i + 1]; out[i].t1 = n ? Math.min(n.t0, out[i].t1 + .7) : out[i].t1 + .6;
    const cut = cuts.find(t => t > out[i].last + .15 && t < out[i].t1); if (cut != null) out[i].t1 = cut; delete out[i].last; }
  return out;
}

/** the width of s at px from the advance table ({ upm, adv }) */
export const measure = (adv, s, px) => [...s].reduce((a, c) => a + (adv.adv[c] ?? adv.adv['n'] ?? 550), 0) * px / adv.upm;

/** V1 wrapLines: one line when short, else the most balanced 2-line split under 80 % of the width */
export function wrapCaption(adv, text, px, W = 1080, maxW = .8) {
  const words = text.split(' '), full = measure(adv, text, px);
  if (full < W * .42 || words.length < 3) { if (full <= W * maxW) return [text]; }
  let best = [text], bestScore = 1e9;
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const wa = measure(adv, a, px), wb = measure(adv, b, px);
    const sc = Math.abs(wa - wb) + (Math.max(wa, wb) > W * maxW ? 1e6 : 0); if (sc < bestScore) { bestScore = sc; best = [a, b]; } }
  return best;
}

/** the card shown at t (a card holds [t0, t1)) */
export const cardAt = (caps, t) => (caps || []).find(c => t >= c.t0 && t < c.t1) || null;

/** V1's look (rbx.js drawCaptions) at the film's size: Nunito 900 opts.size px (V1 66, ref1 70) scaled to the frame width, white, a
 *  12 px #141414 stroke under a soft shadow 5 px down, centred at opts.y of the height (ref1 .18) */
export function drawCaption(g, caps, t, o = {}, W = 1080, H = 1920, adv = null, family = 'Nunito') {
  const c = cardAt(caps, t); if (!c) return false;
  const k = W / 1080, px = (o.size || 66) * k, y = o.y ?? .22;
  const text = o.upper ? c.text.toUpperCase() : c.text;
  g.save();
  g.font = `900 ${px}px ${family}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const ls = adv ? wrapCaption(adv, text, o.size || 66) : [text], lh = px * 1.08, y0 = H * y - (ls.length - 1) * lh / 2;
  ls.forEach((l, i) => { const yy = y0 + i * lh;
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10 * k; g.shadowOffsetY = 5 * k; g.lineWidth = 12 * k; g.strokeStyle = '#141414'; g.strokeText(l, W / 2, yy);
    g.shadowColor = 'transparent'; g.fillStyle = '#ffffff'; g.fillText(l, W / 2, yy); });
  g.restore();
  return true;
}

/** the widths table next to this file (fonts/nunito-900.widths.json), fetched once in a page */
let ADV = null;
export async function loadWidths(base = import.meta.url) {
  if (ADV) return ADV;
  const u = new URL('./fonts/nunito-900.widths.json', base).href;
  if (typeof fetch === 'function' && !/^file:/.test(u)) { const r = await fetch(u); ADV = await r.json(); return ADV; }
  const fs = await import('node:fs'); ADV = JSON.parse(fs.readFileSync(new URL(u), 'utf8')); return ADV;
}
/** the font file next to this file (a page loads it as a FontFace named family before drawing) */
export const fontUrl = (base = import.meta.url) => new URL('./fonts/nunito-900.ttf', base).href;
