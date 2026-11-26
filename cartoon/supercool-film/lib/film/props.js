// lab/film/props.js: props for films (world space, 1 = head diameter D). `await makeProp(kind, opts)` -> Object3D whose origin is the
// GRIP point (where the hand holds it), userData.sockets = { grip:[0,0,0], ... } (prop space). Full reference: engine/props/PROPS_API.md.
// Where a kind comes from, in this order (the first that has it wins):
//   1. built-in here: cane, loaf (= bread_loaf), half_loaf (= bread_half), mug, newspaper (printed both faces), box
//   2. engine/props/<kind>.js        (camera umbrella phone book bag ball cup bottle broom fishing_rod flowers letter, + his video's props)
//   3. films/<film>/props/<kind>.js  (opts.film = the film's name; a film's own prop = one new file there)
// A prop module: `export function build(opts) -> Object3D` (may be async), origin at the grip, units D, his look (engine/props/_kit.js).
// An unknown kind throws an error that names the three places looked.
import * as THREE from '../../engine/three.js';
import { outline } from '../../engine/shade.js';

const VERT = `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform vec3 cLit, cDark; varying vec3 vN;
void main() { float k = dot(normalize(vN), normalize(vec3(-.55, .7, .45))); gl_FragColor = vec4(mix(cDark, cLit, smoothstep(-.1, .25, k)), 1.0);
#include <colorspace_fragment>
}`;
export function flat(lit, dark) {
  const a = new THREE.Color(lit), b = dark != null ? new THREE.Color(dark) : a.clone().multiplyScalar(.72);
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { cLit: { value: a }, cDark: { value: b } } });
}
const part = (geo, mat, w = .03) => { const m = new THREE.Mesh(geo, mat); outline(m, { width: w, color: 0x3a2a33 }); return m; };

// ---- the newspaper's print (FABLE_REVIEW 9: a blank slab). Front = masthead, headline, picture box, columns; back = page 2.
function pageTex(o, back) {
  const W = 512, H = Math.round(512 * .7 / .55), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), ink = o.ink || '#3a2f2c', mx = W * .07;
  g.fillStyle = o.paper || '#efeae0'; g.fillRect(0, 0, W, H);
  g.fillStyle = ink; g.strokeStyle = ink; g.textAlign = 'center';
  const rule = (y, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(mx, y); g.lineTo(W - mx, y); g.stroke(); };
  const cols = (y0, y1, x0, x1, n) => { const cw = (x1 - x0) / n; g.globalAlpha = .45;
    for (let c = 0; c < n; c++) for (let y = y0, r = 0; y < y1; y += H * .026, r++) g.fillRect(x0 + c * cw + cw * .08, y, cw * (r % 4 === 3 ? .5 : .84), H * .009);
    g.globalAlpha = 1; };
  const pic = (x, y, w, h) => { g.fillStyle = o.pic || '#9a8f80'; g.fillRect(x, y, w, h); g.lineWidth = W * .008; g.strokeRect(x, y, w, h);
    g.fillStyle = '#c9c1b2'; g.beginPath(); g.arc(x + w * .3, y + h * .35, h * .14, 0, 7); g.fill();            // a sun / a face
    g.fillStyle = '#6f665a'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * .35, y + h * .5); g.lineTo(x + w * .6, y + h * .75);
    g.lineTo(x + w * .8, y + h * .45); g.lineTo(x + w, y + h); g.closePath(); g.fill(); g.fillStyle = ink; };
  if (!back) {
    g.font = `bold ${H * .085}px Georgia, 'Times New Roman', serif`;
    g.save(); g.translate(W / 2, H * .115); g.scale(.86, 1); g.fillText(o.title || 'The Daily Herald', 0, 0); g.restore();
    rule(H * .14, H * .006); rule(H * .152, H * .002);
    g.font = `bold ${H * .072}px Georgia, serif`;
    g.save(); g.translate(W / 2, H * .235); g.scale(.78, 1); g.fillText(o.headline || 'BIG NEWS IN TOWN!', 0, 0); g.restore();
    pic(mx, H * .28, W * .52, H * .3); cols(H * .29, H * .58, mx + W * .54, W - mx, 1); cols(H * .62, H * .95, mx, W - mx, 3);
  } else {
    g.font = `bold ${H * .05}px Georgia, serif`; g.save(); g.translate(W / 2, H * .08); g.scale(.82, 1); g.fillText(o.backline || 'MORE ON PAGE 2', 0, 0); g.restore();
    rule(H * .1, H * .004); cols(H * .13, H * .5, mx, W - mx, 3); pic(W * .45, H * .54, W * .48, H * .22); cols(H * .54, H * .76, mx, W * .42, 1);
    cols(H * .8, H * .95, mx, W - mx, 3);
  }
  g.globalAlpha = .5; g.lineWidth = W * .01; g.strokeStyle = '#b9ae98'; g.strokeRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

const BUILTIN = ['cane', 'loaf', 'bread_loaf', 'half_loaf', 'bread_half', 'mug', 'newspaper', 'box'];
export const builtinKinds = () => BUILTIN.slice();

function builtIn(kind, o) {
  const g = new THREE.Group(); g.name = 'prop.' + kind;
  if (kind === 'bread_loaf') kind = 'loaf';
  if (kind === 'bread_half') kind = 'half_loaf';
  if (kind === 'cane') {
    // grip at the crook; the shaft hangs down to the ground (length ~ the hand height)
    const L = o.length ?? 1.25, m = flat(o.color ?? '#5b3a24');
    const shaft = part(new THREE.CylinderGeometry(.028, .028, L, 10), m, .022); shaft.position.y = -L / 2; g.add(shaft);
    const crook = part(new THREE.TorusGeometry(.09, .028, 8, 16, Math.PI), m, .022); crook.position.set(-.09, 0, 0); g.add(crook);
    g.userData.sockets = { grip: [0, 0, 0], tip: [0, -L, 0] };
  } else if (kind === 'loaf' || kind === 'half_loaf') {
    const half = kind === 'half_loaf', len = (o.length ?? .62) * (half ? .5 : 1);
    const geo = new THREE.CapsuleGeometry(.13, Math.max(.01, len - .26), 6, 14); geo.rotateZ(Math.PI / 2); geo.scale(1, .8, 1);
    const crust = part(geo, flat(o.color ?? '#c98a3f', '#8f5a26'), .024); g.add(crust);
    if (half) { const cut = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), flat('#f3dfae', '#e2c68e')); cut.rotation.y = Math.PI / 2; cut.position.x = len / 2 - .01; cut.scale.y = .8; g.add(cut); }
    for (let i = -1; i <= 1; i++) { if (half && i > 0) continue; const s = new THREE.Mesh(new THREE.BoxGeometry(.015, .02, .2), new THREE.MeshBasicMaterial({ color: 0x7a4a20 }));
      s.position.set(i * len * .25, .1, 0); s.rotation.y = .5; g.add(s); }
    g.userData.sockets = { grip: [0, 0, 0], ends: [[-len / 2, 0, 0], [len / 2, 0, 0]] };
  } else if (kind === 'mug') {
    const m = flat(o.color ?? '#3e5fae'); const c = part(new THREE.CylinderGeometry(.13, .13, .3, 16), m, .022); g.add(c);
    const h = part(new THREE.TorusGeometry(.07, .02, 6, 12), m, .018); h.position.x = .15; g.add(h);
    g.userData.sockets = { grip: [0, 0, 0], lip: [0, .15, 0] };
  } else if (kind === 'newspaper') {
    // same slab as before (.55 x .7 x .02, centre .2 above the grip), now printed on both faces; the edges stay plain paper
    const edge = flat('#efeae0', '#c9c3b6');
    const mats = [edge, edge, edge, edge, new THREE.MeshBasicMaterial({ map: pageTex(o, false) }), new THREE.MeshBasicMaterial({ map: pageTex(o, true), color: 0xe4ded2 })];
    const p = new THREE.Mesh(new THREE.BoxGeometry(.55, .7, .02), mats); outline(p, { width: .02, color: 0x3a2a33 }); p.position.y = .2; g.add(p);
    g.userData.sockets = { grip: [0, 0, 0], centre: [0, .2, 0] };
  } else {
    const [w, h, d] = o.size ?? [.2, .2, .2]; g.add(part(new THREE.BoxGeometry(w, h, d), flat(o.color ?? '#bc481b')));
    g.userData.sockets = { grip: [0, 0, 0] };
  }
  g.traverse(m => { m.frustumCulled = false; });
  return g;
}

// ---- the loader: built-in -> engine/props/<kind>.js -> films/<film>/props/<kind>.js
const ROOT = new URL('../../', import.meta.url); // charsys/
async function tryImport(url) {
  if (url.protocol === 'file:') {
    try { return await import(url.href); } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(url.pathname.split('/').pop())) return null; throw e; }
  }
  let ok = false; try { ok = (await fetch(url.href, { method: 'HEAD', cache: 'no-store' })).ok; } catch { ok = false; }
  return ok ? import(url.href) : null; // a file that exists but fails to load throws its own error (never hidden as "unknown kind")
}
const filmName = f => f ? String(f).replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() : null;

export async function makeProp(kind, o = {}) {
  if (BUILTIN.includes(kind)) return builtIn(kind, o);
  if (!/^[a-z][a-z0-9_]*$/.test(String(kind))) throw new Error(`makeProp: bad prop kind ${JSON.stringify(kind)} (lowercase letters, digits, _; not starting with _)`);
  const film = filmName(o.film);
  // o.propsUrl (the app's page: the film's own props/ folder, e.g. the project's scenes/props/) is looked in before films/<film>/props/
  const places = [new URL(`engine/props/${kind}.js`, ROOT), o.propsUrl ? new URL(`${kind}.js`, o.propsUrl) : null, film && !o.propsUrl ? new URL(`films/${film}/props/${kind}.js`, ROOT) : null].filter(Boolean);
  for (const url of places) {
    const mod = await tryImport(url);
    if (!mod) continue;
    const build = mod.build || mod.default?.build;
    if (typeof build !== 'function') throw new Error(`makeProp: ${url.pathname} has no build(opts) export`);
    const obj = await build({ ...o, kind });
    if (!obj?.isObject3D) throw new Error(`makeProp: ${url.pathname} build() did not return an Object3D`);
    obj.name ||= 'prop.' + kind;
    obj.userData.sockets ||= { grip: [0, 0, 0] };
    if (mod.update && !mod.free) obj.userData.trackDriven = true; // one of his video's props (character space, track keys): no grip origin
    obj.traverse(m => { m.frustumCulled = false; });
    return obj;
  }
  throw new Error(`makeProp: unknown prop kind "${kind}". Looked in: 1) built-in kinds in lab/film/props.js (${BUILTIN.join(', ')}); `
    + `2) engine/props/${kind}.js; 3) ${o.propsUrl ? `${o.propsUrl}${kind}.js` : film ?`films/${film}/props/${kind}.js` : 'films/<film>/props/' + kind + '.js (no film name given)'}. `
    + `Add the prop as one file in 2) or 3): export function build(opts) -> Object3D, origin at the grip (engine/props/PROPS_API.md).`);
}

// place a prop for one frame. st = character.update's state ({ hands, rig }); pp = pose.props[id] ({ in, at, rot }) or the film default.
// Hand props: origin on the hand, turned with the body's facing, + rot (deg, x y z) + at (body-space offset).
// Body props (in: 'body'): origin on the hem point (hips), turned with the body's facing, + at (body space: +X his left, +Y up, +Z forward)
// + rot: a satchel on the hip with its strap over the far shoulder (bag strap:'shoulder').
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function placeProp(obj, st, pp, base = {}) {
  const P = { ...base, ...(pp || {}) };
  const where = P.in || 'world';
  if (where === 'hidden') { obj.visible = false; return; }
  obj.visible = true;
  const rot = (P.rot || [0, 0, 0]).map(v => v * Math.PI / 180);
  if (where.startsWith('hand:') || where === 'body') {
    st.rig.hem.decompose(_p, _q, _s);
    const org = where === 'body' ? [_p.x, _p.y, _p.z] : st.hands[where.slice(5)];
    const f = st.rig.facing, ry = Math.atan2(f[0], f[2]);
    _q.setFromAxisAngle(_v.set(0, 1, 0), ry);
    _q2.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
    obj.quaternion.copy(_q).multiply(_q2);
    const off = P.at || [0, 0, 0];
    _v.set(off[0], off[1], off[2]).applyQuaternion(_q);
    obj.position.set(org[0] + _v.x, org[1] + _v.y, org[2] + _v.z);
    obj.userData.last = obj.position.toArray();
  } else if (where === 'release') {
    // dropped: falls from where it was to the ground and lies there (not pure across seeks; good enough for forward renders)
    const last = obj.userData.last || [0, .5, 0];
    obj.position.set(last[0], Math.max((st?.pose?.floorY || 0) + .05, last[1] - .2), last[2]); obj.userData.last = obj.position.toArray();
    obj.rotation.set(0, 0, Math.PI / 2);
  } else {
    const a = P.at || [0, 0, 0];
    obj.position.set(a[0], a[1], a[2]); obj.rotation.set(rot[0], rot[1], rot[2]);
  }
}
