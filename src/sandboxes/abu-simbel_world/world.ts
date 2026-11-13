// OWNER: abu-simbel_world agent branch — do NOT merge into src/videos/abu-simbel/ without audit. Merged truth lives in the main video.
// Abu Simbel — the world pass (Agent 1). One continuous scene, four locations at x offsets (ABU in build.ts):
//   old temple site x = 0 (shots 1-6), home room x = 80 (shot 7),
//   new site on higher ground x = 160 (shots 8-11), sanctuary interior x = 240 (shot 12).
// The cliff face is the plane z = -18; the Nile runs toward +z; rooms are open toward +z (camera side).
// Dynamic world beats (posed here every frame): the Nile creeping up in shot 2, the chalk cut-grid and the
// marked "30 t" block (shots 3-6), loose cut blocks (shots 5+), the gantry lift (shot 6), white dust at the
// cutting line (shot 5) and faint dust at the rebuild (shots 8-9), the sun shaft in the sanctuary (shot 12).
// Characters are placed by the CHAR pass (cast.ts stage()); this file only poses the world and calls stage().
// Public interface kept from the bridge: `World`, `loadKit`, `World.update(id, f, cam, scene) -> focus`.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Strand, V, lam, buildAbuSimbel, ABU, Kit, Ray, kitClone } from "./build";
import { ctex, beam, sandHD, bed, stoneHD, waterNear, waterFar, cloudHD, dustTex, cutOverlayTex, chalkBlockTex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, camAt, bridgeState, BridgeState, V3, smooth, FOREGROUND, ShotDef } from "./story";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};
/** sun disc (solid, soft rim) and the flat golden halo (lighting.md 6 / depth.md 6.4: r50 13-26 % of the frame width) */
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-shot sun override (lighting.md 9.1 notes): shot 1 low dawn sun; shot 12 sun behind the camera (az 180),
 *  low, so it shines straight through the sanctuary door onto the inner statues — the real alignment. */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 1: { az: 25, el: 14 }, 12: { az: 180, el: 9 } };

/** every lens position of the film looking at its subject: centre, sides and top of frame (props there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private nileOld: THREE.Mesh; private nileNew: THREE.Mesh;
  private dust: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; base: V3; k: number; shots: number[] }[] = [];
  private cutOverlay: THREE.Mesh; private markedBlock: THREE.Mesh;
  private looseBlocks = new THREE.Group();
  private gantry = new THREE.Group();
  private liftBlock: THREE.Mesh; private liftBlob: THREE.Mesh;
  private ropes: Strand[] = [];
  private shaft: THREE.Mesh; private shaftPatch: THREE.Mesh; private doorGlow: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d + 120, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- desert ground, river beds and banks (static, world coords) ----
    // Sand plain in pieces so it never covers the two Nile channels (old: x -140..60, z -14..150;
    // new: x 100..320, z 60..170). The Nile surface sits 1.2 m below the old bank so the water reads
    // right at the temples' feet, and 5.4 m below the new-site plain, far below the terrace.
    M.sand = lam("sandHD", () => ({ map: sandHD() }));
    M.bedM = lam("bed", () => ({ map: bed() }));
    const sand = (x0: number, x1: number, z0: number, z1: number) => {
      const g = quadUp(x0, x1, z0, z1, (x1 - x0) / 8, (z1 - z0) / 8);
      const mesh = new THREE.Mesh(g, M.sand); mesh.receiveShadow = true; R.add(mesh);
    };
    sand(-400, -140, -40, 400);
    sand(-140, 60, 150, 400);
    sand(60, 400, -40, 60);
    sand(60, 100, 60, 170);
    sand(320, 400, 60, 170);
    sand(100, 320, 170, 400);
    sand(-140, 60, -20, -14); // bank strip in front of the cliff, where the worksite stands
    // river beds (below the water) + bank walls down to them
    const bedQ = (x0: number, x1: number, z0: number, z1: number, dy: number) => {
      const mesh = new THREE.Mesh(quadUp(x0, x1, z0, z1, (x1 - x0) / 4, (z1 - z0) / 4, dy), M.bedM);
      mesh.receiveShadow = true; R.add(mesh);
    };
    bedQ(-140, 60, -14, 150, -2.4);
    bedQ(100, 320, 60, 170, -6.4);
    for (const [x0, x1, z, dir, y0] of [[-140, 60, -14, 1, D0 - 2.4], [-140, 60, 150, -1, D0 - 2.4], [100, 320, 60, 1, D0 - 6.4], [100, 320, 170, -1, D0 - 6.4]] as const)
      R.add(new THREE.Mesh(wallQuad(x0, x1, z, dir, y0), M.sand));
    for (const [x, z0, z1, dir, y0] of [[-140, -14, 150, 1, D0 - 2.4], [60, -14, 150, -1, D0 - 2.4], [100, 60, 170, 1, D0 - 6.4], [320, 60, 170, -1, D0 - 6.4]] as const)
      R.add(new THREE.Mesh(wallQuadZ(x, z0, z1, dir, y0), M.sand));

    buildAbuSimbel(R, kit, sightLines());

    // ---- the Nile (one water material, two meshes so the old level can creep up in shot 2) ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "river1";
    this.nileOld = new THREE.Mesh(quadUp(-140, 60, -14, 150, 1, 1, -1.2), waterM);
    this.nileNew = new THREE.Mesh(quadUp(100, 320, 60, 170, 1, 1, -5.4), waterM);
    for (const wm of [this.nileOld, this.nileNew]) { wm.receiveShadow = true; R.add(wm); }

    // ---- dynamic world props (visibility + pose set in update()) ----
    // chalk cut-grid overlay on the great facade (shots 5-6 only; NOINK so the ink pass never rims it)
    this.cutOverlay = new THREE.Mesh(new THREE.PlaneGeometry(ABU.greatW, 16),
      new THREE.MeshBasicMaterial({ map: cutOverlayTex(), transparent: true, opacity: 0.92, depthWrite: false }));
    this.cutOverlay.position.set(ABU.greatX, D0 + 10, ABU.cliffZ + 0.35);
    this.cutOverlay.layers.set(NOINK); this.cutOverlay.visible = false;
    R.add(this.cutOverlay);
    // the marked block, proud of the facade (shots 3-6)
    this.markedBlock = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 0.5),
      lam("chalkBlock", () => ({ map: chalkBlockTex() })));
    this.markedBlock.position.set(ABU.markX, D0 + ABU.markY + 1.2, ABU.cliffZ + 0.35);
    this.markedBlock.castShadow = true; this.markedBlock.visible = false;
    R.add(this.markedBlock);
    // loose cut blocks on the ground in front of the facade (shots 5+)
    const looseM = lam("abuLoose", () => ({ map: stoneHD("abuLoose", ["#d3bd96", "#c8ae85", "#dcc49e", "#bfa37a"], "#a5875e") }));
    for (const [x, z, yaw, w, h, d] of [[-20, -6, 0.1, 2.6, 1.6, 2.0], [-14, -4.5, -0.15, 2.2, 1.4, 1.8], [-9, -7, 0.25, 2.4, 1.5, 1.9], [-17, -3, 0.05, 2.0, 1.3, 1.7]] as const) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), looseM);
      blk.position.set(x, D0 + h / 2, z); blk.rotation.y = yaw; blk.castShadow = true; blk.receiveShadow = true;
      this.looseBlocks.add(blk);
    }
    this.looseBlocks.visible = false;
    R.add(this.looseBlocks);
    // gantry crane over the lift (shot 6 only): two A-frames + top beam, ropes + block posed per frame
    const woodM = lam("abuGantryWood", () => ({ map: beam() }));
    const ironM = twoTone(new THREE.MeshPhongMaterial({ color: "#3d414c", specular: "#8a8a8a", shininess: 60 }), 0.15);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(beamBetween(V(ABU.liftX + sx * 1.8, D0, ABU.liftZ + sz * 1.3), V(ABU.liftX + sx * 1.8, D0 + 7, ABU.liftZ), 0.18), woodM);
      leg.castShadow = true; this.gantry.add(leg);
    }
    const topBeam = new THREE.Mesh(beamBetween(V(ABU.liftX - 2.0, D0 + 7, ABU.liftZ), V(ABU.liftX + 2.0, D0 + 7, ABU.liftZ), 0.22), woodM);
    topBeam.castShadow = true; this.gantry.add(topBeam);
    this.gantry.visible = false;
    R.add(this.gantry);
    this.liftBlock = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.0),
      lam("abuLiftBlock", () => ({ map: stoneHD("abuLift", ["#d3bd96", "#c8ae85", "#dcc49e", "#bfa37a"], "#a5875e") })));
    this.liftBlock.castShadow = true; this.liftBlock.receiveShadow = true; this.liftBlock.visible = false;
    R.add(this.liftBlock);
    for (let i = 0; i < 2; i++) {
      const rope = new Strand(4, 0.06, 0.06, ironM, 1);
      rope.mesh.visible = false; this.ropes.push(rope); R.add(rope.mesh);
    }
    const blobG = new THREE.CircleGeometry(1.7, 24); blobG.rotateX(-Math.PI / 2);
    this.liftBlob = new THREE.Mesh(blobG, new THREE.MeshBasicMaterial({ color: "#2e2118", transparent: true, opacity: 0.4, depthWrite: false }));
    this.liftBlob.position.set(ABU.liftX, D0 + 0.04, ABU.liftZ); this.liftBlob.visible = false;
    R.add(this.liftBlob);
    // white dust at the cutting line (shot 5) + faint dust at the rebuild (shots 8-9)
    const dustT = dustTex();
    const dustDefs: { base: V3; k: number; shots: number[]; size: number }[] = [
      { base: [-22, D0 + 3, -12], k: 0, shots: [5], size: 5 },
      { base: [-16, D0 + 5, -11], k: 0.33, shots: [5], size: 6.5 },
      { base: [-10, D0 + 2.5, -12], k: 0.66, shots: [5], size: 4.5 },
      { base: [-26, D0 + 6, -13], k: 0.2, shots: [5], size: 5.5 },
      { base: [ABU.newX - 18, D0 + ABU.terraceY + 2, -8], k: 0.5, shots: [8, 9], size: 6 },
      { base: [ABU.newX + 10, D0 + ABU.terraceY + 3, -6], k: 0.8, shots: [8, 9], size: 5 },
    ];
    for (const d of dustDefs) {
      const mat = new THREE.MeshLambertMaterial({ map: dustT, transparent: true, depthWrite: false, opacity: 0 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size, d.size * 0.7), mat);
      m.layers.set(NOINK); m.position.set(...d.base);
      this.dust.push({ m, mat, base: d.base, k: d.k, shots: d.shots }); R.add(m);
    }
    // sanctuary sun shaft (shot 12 only): slanted additive plane from the door top to the statues,
    // a bright patch on the floor by the statues, and the glowing doorway itself
    const SX = ABU.sanctX;
    this.shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 11.5),
      new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.shaft.position.set(SX, D0 + 2.5, 1);
    this.shaft.rotation.x = Math.atan2(11, 3.4);
    this.shaft.layers.set(NOINK); this.shaft.renderOrder = 5;
    R.add(this.shaft);
    const patchG = new THREE.CircleGeometry(2.2, 24); patchG.rotateX(-Math.PI / 2);
    this.shaftPatch = new THREE.Mesh(patchG,
      new THREE.MeshBasicMaterial({ color: 0xffdf9e, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shaftPatch.position.set(SX, D0 + 0.18, -4.2);
    this.shaftPatch.layers.set(NOINK); this.shaftPatch.renderOrder = 5;
    R.add(this.shaftPatch);
    this.doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2),
      new THREE.MeshBasicMaterial({ color: 0xffedb5, side: THREE.DoubleSide }));
    this.doorGlow.position.set(SX, D0 + 2.1, 6.4);
    this.doorGlow.layers.set(NOINK);
    R.add(this.doorGlow);
    // the CAM agent's near framing objects: built once, never passed through the sight-line filter, toggled per frame
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const ss = s as ShotDef & { sunAz?: number; sunEl?: number };
    const az = THREE.MathUtils.degToRad(ss.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(ss.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az); // screen right = (-fz, fx)
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], b = bridgeState(id, t), L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK); // sky, clouds, dust and sun sprites live on the no-ink layer but are still rendered
    // ---- light rig (lighting.md 9.4): camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0; // not used by the two-tone shading
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog (colour = horizon colour, linear fogNear -> fogFar), sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- river colours (on-screen targets, tone-map-inverted) ----
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    // ---- foreground framing objects: inside their frames AND their own shot (so a crossfade layer never shows them) ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- Abu Simbel dynamics ----
    const prog = smooth((f - s.a) / Math.max(1, s.b - s.a)); // 0..1 across the shot
    const env = Math.max(0, Math.min(1, (f - s.a) / 15, (s.b - f) / 15)); // fade in/out over 15 f at the shot edges
    // the Nile creeping toward the stone (shot 2), holding the crept level through shots 3-6
    this.nileOld.position.y = id === 2 ? 0.5 * prog : (id >= 3 && id <= 6 ? 0.5 : 0);
    // chalk cut-grid (shots 5-6), the marked block (shots 3-6), loose cut blocks (shots 5+)
    this.cutOverlay.visible = id === 5 || id === 6;
    this.markedBlock.visible = id >= 3 && id <= 6;
    this.looseBlocks.visible = id >= 5;
    // the gantry lift (shot 6): the block rises 3.4 m over the shot, ropes follow, contact blob fades + spreads
    const lifting = id === 6;
    this.gantry.visible = lifting;
    this.liftBlock.visible = lifting;
    this.liftBlob.visible = lifting;
    for (const rope of this.ropes) rope.mesh.visible = lifting;
    if (lifting) {
      const by = D0 + 1.4 + 3.4 * prog;
      this.liftBlock.position.set(ABU.liftX, by, ABU.liftZ);
      for (let k = 0; k < 2; k++) {
        const z = ABU.liftZ + (k === 0 ? -0.5 : 0.5);
        const pts = [0, 1, 2, 3].map((j) => V(ABU.liftX, D0 + 7 + (by + 1.1 - (D0 + 7)) * (j / 3), z));
        this.ropes[k].set(pts);
      }
      (this.liftBlob.material as THREE.MeshBasicMaterial).opacity = 0.42 - 0.22 * prog;
      this.liftBlob.scale.setScalar(1 + 0.7 * prog);
    }
    // white dust: full at the cutting line (shot 5), faint at the rebuild (shots 8-9)
    for (const d of this.dust) {
      const on = d.shots.includes(id);
      d.mat.opacity = on ? (d.shots[0] === 5 ? 0.7 : 0.25) * env : 0;
      d.m.position.set(d.base[0] + Math.sin(t * 0.7 + d.k * 9) * 0.4, d.base[1] + Math.sin(t * 0.5 + d.k * 7) * 0.25, d.base[2]);
      d.m.quaternion.copy(cam.quaternion);
    }
    // the sun shaft in the sanctuary (shot 12 only)
    const inSanct = id === 12;
    this.shaft.visible = inSanct; this.shaftPatch.visible = inSanct; this.doorGlow.visible = inSanct;
    // ---- cast + effects (CHAR pass) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, b, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint); // legacy emissive card until the CHAR agent's cardShade lands
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));       // depression angle of the view ray
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);         // 1 at the horizon .. 0 at 24 deg down
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.35 * wTime, 0.0);           // slow river along +x
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;

/** horizontal quad facing up at height D0 + dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
/** bank wall from y0 to the bank top D0 at z, facing +z (dir 1) or -z (dir -1); y0 is absolute */
function wallQuad(x0: number, x1: number, z: number, dir: number, y0: number) {
  const g = new THREE.BufferGeometry(), y1 = D0;
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 0, dir]).flat(), 3));
  const u = Math.abs(x1 - x0) / 4, v = (y1 - y0) / 4;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
/** bank wall along z at x, from y0 to the bank top D0, facing +x (dir 1) or -x (dir -1) */
function wallQuadZ(x: number, z0: number, z1: number, dir: number, y0: number) {
  const g = new THREE.BufferGeometry(), y1 = D0;
  g.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, z0, x, y0, z1, x, y1, z1, x, y0, z0, x, y1, z1, x, y1, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([dir, 0, 0]).flat(), 3));
  const u = Math.abs(z1 - z0) / 4, v = (y1 - y0) / 4;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
