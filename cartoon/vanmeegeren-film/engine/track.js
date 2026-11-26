// engine/track.js - keyframe tracks. Pure in t: at(t) reads only the keys.
// K([[t, v, ease?], ...], ease) -> { at(t, from) }. v: number | array | string | bool | null | FROM | { '@': offset }.
// The ease on a key is the ease INTO that key (segment from the previous key); default = the track's ease.
// Strings, booleans, null and objects always step (snap at the key). Before the first key: first value; after the last: last value.
// FROM ('@') = "the value underneath at the clip's start" (compose resolves it); { '@': d } = that value + d (numbers / arrays).
import { easeFn } from './ease.js';

export const FROM = '@';
const isNum = v => typeof v === 'number';
const isArr = v => Array.isArray(v);
const isRel = v => v && typeof v === 'object' && !isArr(v) && '@' in v;

export function resolve(v, from) {
  if (v === FROM) return from;
  if (isRel(v)) {
    const d = v['@'];
    if (isArr(from)) return from.map((x, i) => x + (isArr(d) ? d[i] ?? 0 : d));
    return (isNum(from) ? from : 0) + d;
  }
  return v;
}

export function mix(a, b, k) {
  if (isNum(a) && isNum(b)) return k === 0 ? a : k === 1 ? b : a + (b - a) * k;
  if (isArr(a) && isArr(b)) return a.map((x, i) => mix(x, b[i] ?? x, k));
  return k >= 1 ? b : a;   // strings, bools, null: step
}

export function K(keys, ease = 'fastIn') {
  if (!isArr(keys) || !keys.length) return { at: (t, from) => from, keys: [] };
  if (!isArr(keys[0])) keys = [[0, keys]];             // a bare constant
  const ks = keys.map(k => [k[0], k[1], easeFn(k[2] ?? ease)]).sort((a, b) => a[0] - b[0]);
  return {
    keys: ks,
    dur: ks[ks.length - 1][0],
    at(t, from) {
      if (t <= ks[0][0]) return resolve(ks[0][1], from);
      const n = ks.length;
      if (t >= ks[n - 1][0]) return resolve(ks[n - 1][1], from);
      let i = 1; while (ks[i][0] <= t) i++;       // first key after t
      const [t0, v0] = ks[i - 1], [t1, v1, e] = ks[i];
      const a = resolve(v0, from), b = resolve(v1, from);
      if (!(isNum(a) || isArr(a)) || !(isNum(b) || isArr(b))) return a;   // step types hold until the key
      if (a === b) return a;                              // a hold is exact: same value, bit for bit
      return mix(a, b, e((t - t0) / (t1 - t0)));
    },
  };
}

/** A constant track. */
export const C = v => K([[0, v]]);
/** Step track from [[t, v], ...] (strings, flags). Before its first key it gives what is underneath (FROM), so a clip's
 *  face snap at f13 doesn't show from f0. */
export const S = keys => K(keys[0] && keys[0][0] > 0 ? [[0, FROM], ...keys] : keys, 'snap');

/** blend(u, v, w): override layer with weight w. add(u, v, w): additive layer. */
export const blend = (u, v, w = 1) => w >= 1 ? v : w <= 0 ? u : mix(u, v, w);
export function add(u, v, w = 1) {
  if (isNum(u) && isNum(v)) return u + v * w;
  if (isArr(u) && isArr(v)) return u.map((x, i) => x + (v[i] ?? 0) * w);
  return w >= .5 ? v : u;
}
/** layer(base, over, { w, add }) -> a track whose at(t) = base under over. */
export const layer = (base, over, { w = 1, additive = false } = {}) => ({
  at: (t, from) => { const u = base.at(t, from), v = over.at(t, from); return additive ? add(u, v, w) : blend(u, v, w); },
});
