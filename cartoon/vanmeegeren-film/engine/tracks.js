// tracks.js: how every part finds its per-frame track. One place, so a part never fetches at module top level and two instances of
// a part (two characters in one page) each keep their own track.
//   loadTrack(params, kind, fallbackUrl)
//     params.track   an inline track object: used as it is
//     params.tracks  a base URL ending in '/' (loads <base><kind>.json), one URL, or a list of URLs merged in order (later files add frames)
//     neither        fallbackUrl (today's src/<kind>Track.json): `--part <name>` and the engineer's f0-108 run exactly as before
// Merge of several files (engineer: src/<kind>Track.json, then tracks/engineer/<kind>.json for his other shots): objects merge key by
// key, later wins on a leaf; the frame-run lists `spans` (cap light) and `farLegGreyRuns` (limbs) concatenate; any other array is replaced.
// Frames are global, so frame-keyed maps from different shots never collide.
const CONCAT = new Set(['spans', 'farLegGreyRuns']);
const plain = v => v && typeof v === 'object' && !Array.isArray(v);

export function merge(a, b) {
  if (b === undefined) return a;
  if (!plain(a) || !plain(b)) return b;
  const o = { ...a };
  for (const k of Object.keys(b)) o[k] = CONCAT.has(k) && Array.isArray(a[k]) && Array.isArray(b[k]) ? [...a[k], ...b[k]] : merge(a[k], b[k]);
  return o;
}

export function trackUrls(src, kind) {
  if (!src) return [];
  const base = typeof location !== 'undefined' ? location.href : undefined;
  if (Array.isArray(src)) return src.map(u => new URL(u, base).href);
  const s = String(src);
  return [new URL(s.endsWith('/') ? s + kind + '.json' : s, base).href];
}

export async function loadTrack(params = {}, kind, fallbackUrl) {
  if (params.track && typeof params.track === 'object') return params.track;
  const urls = params.tracks ? trackUrls(params.tracks, kind) : [String(fallbackUrl)];
  if (!urls.length) throw new Error(`${kind}: no track given (write tracks/<char>/${kind}.json, or hide the part)`);
  let out;
  for (const u of urls) {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${kind}: track not found (${r.status}): ${u}`);
    out = out === undefined ? await r.json() : merge(out, await r.json());
  }
  return out;
}
