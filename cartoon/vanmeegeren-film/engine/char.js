// char.js: one character, every part in one object, assembled from a spec (specs/<char>.json, docs/API.md). build(params) -> Group, update(frame, ctx).
//   params (= the spec, merged under --params by bench/render.mjs):
//     head, face, torso, limbs   each goes to that part's build() as it is
//     hat   { kind: 'hickory' | 'none' | <any src/hats/<kind>.js>, ...its params }   (no hat key: the old `cap` params on the hickory cap)
//     props [{ kind: <src/props/<kind>.js>, ...its params }]   (no props key: the saw stays inside limbs as before; with it, limbs.saw is off)
//     hide  ['torso' | 'limbs' | 'head' | 'face' | 'hat' | 'cap' | 'props' | <prop kind>]: built and updated, not added
//     tracks { head, face, cap, torso, limbs, props: [urls] }   set by render.mjs --char; absent = each part's src/<kind>Track.json
//     lookFrame  passed to head, torso and hat: read the engineer's f0-108 light schedule at that frame instead of the render frame
// Parts stay as their builders measured them; this file only owns the joins, and the joins are depth only: nothing here moves a pixel.
//   face   pulled toward the camera, so the ball's camera-plane offset can't bury the eyes and brows (the band still covers the brows)
//   hull   the head's ink flattened to the plane of the head's rim: its far wall would let the near arm and the bandana draw over the ink
// Build order is torso, limbs, props, head, face, hat: it fixes the objects' ids, the last tie-break of three's draw order. Keep it.
import * as THREE from './three.js';
import * as Head from './head.js';
import * as Face from './face.js';
import * as Torso from './torso.js';
import * as Limbs from './limbs.js';

const FACE_PULL = .05;   // D toward the camera, in depth only
const HULL_Z = -.012;    // D behind the head's centre, in depth only: behind the ball's rim, in front of everything on the body

// clip.z as if the vertex were at view depth z, the screen position untouched
const depthAt = z => `{ vec4 _c = projectionMatrix * vec4(mvPosition.xy, ${z}, 1.0); gl_Position.z = _c.z / _c.w * gl_Position.w; }`;

function pullFace(face) {
  const m = face.children[0].material;
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${depthAt(`mvPosition.z + ${FACE_PULL.toFixed(4)}`)}`);
  };
  m.needsUpdate = true;
}

function flattenHull(head) {
  const hull = head.getObjectByName('head.hull');
  hull.material.vertexShader = `void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float z0 = (modelViewMatrix * vec4(0., 0., 0., 1.)).z + (${HULL_Z.toFixed(4)});
  ${depthAt('z0')}
}`;
  hull.material.needsUpdate = true;
}

// a hat or prop module by kind; a missing one is a plain error, not a 404 deep in the page
async function moduleOf(dir, kind) {
  if (!/^[a-z_][a-z0-9_-]*$/i.test(String(kind))) throw new Error(`${dir}: bad kind "${kind}"`);
  try { return await import(`./${dir}/${kind}.js`); }
  catch (e) { throw new Error(`${dir} kind "${kind}": src/${dir}/${kind}.js is missing or broken (start from src/${dir}/_template.js): ${e.message}`); }
}

export async function build(params = {}) {
  const root = new THREE.Group(); root.name = 'char';
  const T = params.tracks; // undefined = every part's own default track (today's engineer)
  const withTracks = (p, kind) => {
    const o = { ...(p || {}) };
    if (T && o.tracks === undefined && o.track === undefined) o.tracks = T[kind] || [];
    if (params.lookFrame !== undefined && o.lookFrame === undefined && ['head', 'torso', 'cap'].includes(kind)) o.lookFrame = params.lookFrame;
    return o;
  };
  const hide = new Set(params.hide || []);
  if (hide.has('cap')) hide.add('hat');
  const hatSpec = params.hat || { kind: 'hickory', ...(params.cap || {}) };
  const { kind: hatKind = 'hickory', ...hatParams } = hatSpec;
  const propSpecs = Array.isArray(params.props) ? params.props : null;
  const limbsParams = withTracks(params.limbs, 'limbs');
  if (propSpecs && limbsParams.saw === undefined) limbsParams.saw = false; // the saw comes as a prop now

  const parts = {};
  parts.torso = [Torso, await Torso.build(withTracks(params.torso, 'torso'))];
  parts.limbs = [Limbs, await Limbs.build(limbsParams)];
  const props = [];
  for (const spec of propSpecs || []) {
    const mod = await moduleOf('props', spec.kind);
    const obj = await mod.build({ ...spec, tracks: T, limbsTrack: parts.limbs[1].userData.track });
    if (!obj?.isObject3D) throw new Error(`props kind "${spec.kind}": build() did not return a THREE.Object3D`);
    props.push([mod, obj, spec.kind]);
  }
  parts.head = [Head, await Head.build(withTracks(params.head, 'head'))];
  parts.face = [Face, await Face.build(withTracks(params.face, 'face'))];
  if (hatKind !== 'none') {
    const mod = await moduleOf('hats', hatKind);
    const obj = await mod.build(withTracks(hatParams, 'cap'));
    if (!obj?.isObject3D) throw new Error(`hat kind "${hatKind}": build() did not return a THREE.Object3D`);
    parts.hat = [mod, obj];
  }
  for (const k of ['torso', 'limbs']) if (!hide.has(k)) root.add(parts[k][1]);
  for (const [, obj, kind] of props) if (!hide.has('props') && !hide.has(kind)) root.add(obj);
  for (const k of ['head', 'face', 'hat']) if (parts[k] && !hide.has(k)) root.add(parts[k][1]);
  if (params.flatHull !== false) flattenHull(parts.head[1]);
  if (params.pullFace !== false) pullFace(parts.face[1]);
  root.userData.parts = parts;
  root.userData.props = props;
  root.userData.logSockets = params.logSockets;
  return root;
}

export function update(frame, ctx) {
  const { parts, props, logSockets } = ctx.root.userData;
  for (const k of ['torso', 'limbs']) parts[k][0].update(frame, { ...ctx, root: parts[k][1] });
  for (const [mod, obj] of props) mod.update?.(frame, { ...ctx, root: obj });
  for (const k of ['head', 'face', 'hat']) if (parts[k]) parts[k][0].update?.(frame, { ...ctx, root: parts[k][1] });
  if (logSockets) {
    const body = parts.torso[1].userData.body, S = Torso.SOCKETS, pose = Limbs.poseAt(frame, parts.limbs[1].userData.track);
    body.updateMatrixWorld(true);
    const pair = { nearArm: S.shoulderR, farArm: S.shoulderL, nearLeg: S.hipR, farLeg: S.hipL }, out = [];
    for (const k in pair) {
      if (!pose[k] || !pose.visible[k]) continue;
      const a = ctx.project(new THREE.Vector3(...pair[k]).applyMatrix4(body.matrixWorld)), b = ctx.project(new THREE.Vector3(...pose[k][0]));
      out.push(`${k} ${(Math.hypot(a[0] - b[0], a[1] - b[1]) / ctx.cam.d).toFixed(2)}`);
    }
    console.log(`f${frame} socket to limb start, D: ${out.join('  ')}`);
  }
}

export default { build, update };
