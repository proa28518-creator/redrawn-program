// world/look/glb.js: a tiny GLB reader, geometry and material names only (no importmap on the stage page, so no GLTFLoader; no textures, no
// animation, no compression). readGlb(THREE, url) -> { roots: [{ name, prims: [{ node, geometry, material, color }] }] } or null when the file
// is not there. Geometry comes back in the ROOT node's own space (the root's transform is `root.matrix`), `world` = the same with the root's too.
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export async function readGlb(THREE, url) {
  let res; try { res = await fetch(url); } catch { return null; }
  if (!res.ok) return null;
  const buf = await res.arrayBuffer(), dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('readGlb: not a GLB: ' + url);
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  const acc = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], C = COMP[a.componentType], n = SIZE[a.type];
    const start = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0, bytes = C.BYTES_PER_ELEMENT;
    if (!stride || stride === n * bytes) return { array: new C(bin.slice(start, start + a.count * n * bytes)), n, normalized: !!a.normalized };
    const out = new C(a.count * n), src = new DataView(bin), get = { 5126: 'getFloat32', 5125: 'getUint32', 5123: 'getUint16', 5122: 'getInt16', 5121: 'getUint8', 5120: 'getInt8' }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) out[k * n + j] = src[get](start + k * stride + j * bytes, true);
    return { array: out, n, normalized: !!a.normalized }; };
  const geomOf = p => { const g = new THREE.BufferGeometry();
    for (const [name, key] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0'], ['aTone', 'COLOR_0']]) if (p.attributes[key] != null) { const a = acc(p.attributes[key]); g.setAttribute(name, new THREE.BufferAttribute(a.array, a.n, a.normalized)); }
    if (p.indices != null) { const a = acc(p.indices); g.setIndex(new THREE.BufferAttribute(a.array, 1)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    return g; };
  const localOf = n => { const m = new THREE.Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1])));
    return m; };
  const roots = [], scene = json.scenes?.[json.scene ?? 0];
  for (const ri of scene?.nodes || []) {
    const rn = json.nodes[ri], root = { name: rn.name || `node${ri}`, matrix: localOf(rn), prims: [] };
    const walk = (i, parent) => { const n = json.nodes[i], m = i === ri ? new THREE.Matrix4() : new THREE.Matrix4().multiplyMatrices(parent, localOf(n));
      if (n.mesh != null) for (const p of json.meshes[n.mesh].primitives) {
        const g = geomOf(p); g.applyMatrix4(m);
        const M = p.material != null ? json.materials[p.material] : null, f = M?.pbrMetallicRoughness?.baseColorFactor;
        root.prims.push({ node: n.name || '', geometry: g, material: M?.name || '', color: f ? [f[0], f[1], f[2]] : null, emissive: M?.emissiveFactor || null });
      }
      for (const c of n.children || []) walk(c, m); };
    walk(ri, null);
    roots.push(root);
  }
  return { roots };
}
