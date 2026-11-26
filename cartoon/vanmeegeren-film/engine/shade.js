// shade.js: inverted-hull outline only. Stable API, other parts depend on it.
//
//   outline(mesh, { width, color, zBias })  adds a hull as a child of mesh, returns it. Sharing the geometry, it follows
//                                           mesh's transform, visibility, skinning and morphs.
//     width  outline thickness as a fraction of the head diameter (default .06, the median of his head ink in truth)
//     color  anything THREE.Color takes (default #3a2a34, his ink's median); change: hull.material.uniforms.uColor.value
//     zBias  how far the hull sits behind its mesh, in outline widths (default .5)
//   outlineAll(root, opts)                  outline() on every mesh under root except those with userData.noOutline.
//   setHeadDiameter(worldUnits)             world size of one head diameter for all outlines (default 1 = bench units).
//
// The offset is applied in view space, after the model transform, along the screen direction of a welded normal: any
// scale on the mesh or its parents (non-uniform too) leaves it unchanged, split normals don't tear the hull, and a coarse
// mesh gets the full width. It is a world length, so on screen it stays width * head diameter however far the camera is
// (it differs by depth only as the geometry does: about 5 % per head diameter of depth at this bench's 26 degree lens).
import * as THREE from './three.js';

const UNIT = { value: 1 };
export function setHeadDiameter(worldUnits) { UNIT.value = worldUnits; }

function hullNormals(geo) {
  if (geo.attributes.hullNormal) return;
  const p = geo.attributes.position, idx = geo.index, tris = idx ? idx.count : p.count, sum = new Map(), keys = new Array(p.count);
  const key = i => keys[i] ??= `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tris; t += 3) {
    const i = idx ? idx.getX(t) : t, j = idx ? idx.getX(t + 1) : t + 1, k = idx ? idx.getX(t + 2) : t + 2;
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, j); c.fromBufferAttribute(p, k);
    const n = b.sub(a).cross(c.sub(a)); // area-weighted
    for (const v of [i, j, k]) { const K = key(v); const s = sum.get(K); if (s) s.add(n); else sum.set(K, n.clone()); }
  }
  const out = new Float32Array(p.count * 3), n = new THREE.Vector3();
  for (let v = 0; v < p.count; v++) { n.copy(sum.get(key(v)) || n.set(0, 0, 0)).normalize(); out.set([n.x, n.y, n.z], v * 3); }
  geo.setAttribute('hullNormal', new THREE.BufferAttribute(out, 3));
}

const VERT = `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
attribute vec3 hullNormal;
uniform float uWidth, uUnit, uBias;
void main() {
  vec3 objectNormal = hullNormal;
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vec3 n = normalMatrix * objectNormal;
  float l = length(n.xy), t = uWidth * uUnit;
  if (l > 1e-5) mv.xy += n.xy / l * t;
  mv.z -= t * uBias;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;

export function outline(mesh, { width = .06, color = 0x3a2a34, zBias = .5 } = {}) {
  hullNormals(mesh.geometry);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide,
    uniforms: { uWidth: { value: width }, uUnit: UNIT, uBias: { value: zBias }, uColor: { value: new THREE.Color(color) } },
  });
  const hull = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, mat) : new THREE.Mesh(mesh.geometry, mat);
  if (mesh.isSkinnedMesh) hull.bind(mesh.skeleton, mesh.bindMatrix);
  hull.morphTargetInfluences = mesh.morphTargetInfluences;
  hull.morphTargetDictionary = mesh.morphTargetDictionary;
  hull.userData.noOutline = true; hull.name = (mesh.name || 'mesh') + '.outline';
  mesh.add(hull);
  return hull;
}

export function outlineAll(root, opts) {
  const list = [];
  root.traverse(o => { if (o.isMesh && !o.userData.noOutline) list.push(o); });
  return list.map(m => outline(m, opts));
}
