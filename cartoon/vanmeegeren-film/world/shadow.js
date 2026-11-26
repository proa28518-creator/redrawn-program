// world/shadow.js: character (and prop) shadows that sit in the set. attachShadows(THREE, scene, renderer, characters, lightDir, opts) -> { update() }.
// How: not a flattened copy of the meshes. The characters are 2.5D (their shape depends on the camera: rules.js), and their shaders
// move vertices, so a re-projected copy of the geometry would be wrong. Instead the shadow is "the character as the SUN sees it":
// each frame every character is updated once for a near-orthographic sun camera (update() is pure in (pose, camera)), drawn into a
// depth target with the set's casters, then updated again for the real camera. The set's materials (sets.js) read that depth map with a
// 5x5 soft compare, so the shadow is one flat cool colour on the ground AND on walls/props behind (no double darkening: one depth map),
// and it is depth-correct (nothing in front of a character is shadowed). A soft contact blob under each planted foot adds the contact.
// Requirement: call shadows.update() AFTER the host's ch.update(pose, t, camera, W, H) for the frame and BEFORE renderer.render.
const LAYER = 7;

function blobTexture(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

/**
 * characters: objects from createCharacter() (their update is wrapped to remember the last main-camera call).
 * lightDir: direction TO the sun (set.lightDir).
 * opts: { set (the buildSet result: its uniforms receive the map, its casters cast, its bounds frame the map), size 2048, bounds {x:[a,b], z:[a,b]},
 *         casters [objects], blob: { color, opacity, size }, soft 1.2 (PCF radius in texels), bias .0006 }
 */
export function attachShadows(THREE, scene, renderer, characters, lightDir, opts = {}) {
  const set = opts.set || null, size = opts.size || 2048;
  const L = new THREE.Vector3(...lightDir).normalize();
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  rt.depthTexture = new THREE.DepthTexture(size, size); rt.depthTexture.type = THREE.UnsignedIntType;
  rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
  // the sun camera: perspective with a tiny fov from far away (character.js needs a fov), framing the set's action bounds
  const b = opts.bounds || set?.bounds || { x: [-8, 8], z: [-6, 6] };
  const center = new THREE.Vector3((b.x[0] + b.x[1]) / 2, 1.4, (b.z[0] + b.z[1]) / 2);
  const radius = opts.radius || Math.hypot(b.x[1] - b.x[0], b.z[1] - b.z[0]) / 2 + 3, dist = 220;
  const lcam = new THREE.PerspectiveCamera(2 * Math.atan(radius / dist) * 180 / Math.PI, 1, dist - radius - 15, dist + radius + 15);
  lcam.position.copy(center).addScaledVector(L, dist);
  lcam.up.set(0, Math.abs(L.y) > .98 ? 0 : 1, Math.abs(L.y) > .98 ? -1 : 0);
  lcam.lookAt(center); lcam.updateMatrixWorld(true); lcam.layers.set(LAYER);
  const shadowMatrix = new THREE.Matrix4().multiplyMatrices(lcam.projectionMatrix, lcam.matrixWorldInverse);
  const recv = [];
  const receive = U => { U.uShadowMap.value = rt.depthTexture; U.uShadowMatrix.value.copy(shadowMatrix); U.uShadowOn.value = 1; U.uShadowTexel.value = 1 / size;
    if (opts.soft) U.uShadowSoft.value = opts.soft; if (opts.bias) U.uShadowBias.value = opts.bias; recv.push(U); };
  if (set) receive(set.uniforms);
  const enable = o => o.traverse(m => m.layers.enable(LAYER));
  for (const o of [...(set?.casters || []), ...(opts.casters || [])]) enable(o);

  // remember each character's last main-camera update so we can restore it after the sun pass
  const rec = new Map(), orig = new Map();
  for (const ch of characters) {
    const f = ch.update; orig.set(ch, f);
    ch.update = (...a) => { rec.set(ch, a); return f(...a); };
    enable(ch.root);
  }

  // contact blobs: one per foot, soft, fading as the foot lifts
  const BT = blobTexture(THREE), bo = opts.blob || {};
  const bmat = () => new THREE.MeshBasicMaterial({ map: BT, color: bo.color || '#2e2a40', transparent: true, opacity: bo.opacity ?? .42, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const blobs = characters.map(() => [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bmat()); m.rotation.x = -Math.PI / 2; m.renderOrder = -1; scene.add(m); return m; }));

  let ms = 0;
  // SPEED (2026-11-04): u = { skip: Set, hide: Set } from the host (lab/stage.html). A skipped character is outside this sun camera's
  // frustum: no sun update and no main update again (2 of his 3 updates a frame), and he is left out of the depth pass, where his sun
  // shape drew nothing anyway. A hidden one (culled by the host, not updated this frame) gets no blobs. No u = every character, as before.
  function update(u) {
    const t0 = performance.now(), skip = u?.skip, hide = u?.hide;
    const off = skip ? characters.filter(ch => skip.has(ch) && ch.root.visible) : [];
    for (const ch of characters) { if (skip?.has(ch)) continue; const a = rec.get(ch); if (a) { orig.get(ch)(a[0], a[1], lcam, size, size); enable(ch.root); } }
    for (const ch of off) ch.root.visible = false;
    const bg = scene.background, prev = renderer.getRenderTarget();
    scene.background = null;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, lcam);
    renderer.setRenderTarget(prev); scene.background = bg;
    for (const ch of off) ch.root.visible = true;
    for (const ch of characters) { if (skip?.has(ch)) continue; const a = rec.get(ch); if (a) orig.get(ch)(...a); }
    characters.forEach((ch, i) => {
      if (hide?.has(ch)) { for (const m of blobs[i]) m.visible = false; return; }
      const w = ch.where();
      w.feet.forEach((f, j) => {
        const fl = w.floor || 0, m = blobs[i][j], lift = Math.max(0, f.y - fl - (ch.rest.ankleY || 0)), k = Math.max(0, 1 - lift / .5);
        m.visible = k > 0; m.position.set(f.x, fl + .003, f.z); const s = (bo.size || .62) * (1 + lift * .6); m.scale.set(s, s * .8, 1); m.material.opacity = (bo.opacity ?? .42) * k;
      });
    });
    ms = performance.now() - t0;
  }
  return { update, camera: lcam, target: rt, ms: () => ms, receive, dispose() { rt.dispose(); for (const [ch, f] of orig) ch.update = f; blobs.flat().forEach(m => scene.remove(m)); } };
}

export default { attachShadows };
