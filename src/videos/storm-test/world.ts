// Storm Oil — the world pass (Agent 1). One continuous scene, one ship at the origin
// (build.ts STORM anchors, world frame): deck top y = D0 = 0, waterline y = -1.6, bow -Z, stern +Z
// (the ship group is rotated +90 deg about Y from its build-local X axis; see the buildStormShip call).
// Night storm lighting (target 16), the ship-deck prop kit (target 17) and the water system
// (target 18: displaced wave mesh + foam/whitecap marks + spray + depth gradient + golden oil sheen).
// Dynamic world beats (posed here every frame): the storm sea (wave amplitude per shot, calming
// under the oil in S5-S6), the spray, the oil sheen spreading from the pour rail in S4-S6, the
// pour stream itself (S4), and the lantern pools flickering on the deck.
// Characters are placed by the CHAR pass (cast.ts stage()); this file only poses the world and calls stage().
// Public interface kept from Abu Simbel: `World`, `loadKit`, `World.update(id, f, cam, scene) -> focus`.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { V, buildStormShip, buildHeldOilCan, STORM, Kit, Ray, kitClone, lam } from "./build";
import { ctex, cloudHD, seaNearStorm, seaFarStorm, sprayTex, oilSheenTex, oilSheenTile, oilSheenBig, lanternGlowTex, rep, beam, CLOUD_STORM_LIT } from "./paint";
import { LIGHTS, LOOK, LightPreset, WorldLook } from "./lights";
import { TONE, CHAR, LFB, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, camAt, bridgeState, BridgeState, V3, smooth, clamp01, FOREGROUND, ShotDef, OIL_CAN } from "./story";
import { applyCam } from "../common/applyCam";
import { effectMaterial } from "../common/effectMaterial";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => {
        const missing = list.filter((e) => !e[1]).map(([n]) => n);
        if (missing.length > 0) {
          console.warn(`[loadKit] WARNING: ${missing.length} Kenney kit assets failed to load and will use procedural fallbacks:`, missing);
        }
        return Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit;
      });
  }
  return kitP;
};

/** Night fallback preset (target 16) — used ONLY when the POST pass's lights.ts has no "night"
 *  entry yet; when it does, the preset from lights.ts wins. Values are the spec's own:
 *  sky top #23235e-horizon #4a4a8a, moon key cool #8a8fb8, warm practicals #ffb36b. */
const NIGHT_LIGHT: LightPreset = {
  interior: false,
  az: 35, el: 38,
  lit: [0.85, 0.9, 1.25], shade: [0.16, 0.18, 0.32], lift: [0.05, 0.05, 0.1], lambert: 0.35, sideK: 0.84, term: 0.2,
  charTint: [0.95, 0.97, 1.15], charShade: 0.9, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.85, 0.88, 1.05],
  blob: [0.4, 0.42, 0.6], actorShadow: true,
  top: "#23235e", hor: "#4a4a8a", skyCurve: [0.0, 0.5, 0.6], fog: "#4a4a8a", fogNear: 30, fogFar: 420, sunDisc: "#e8ecff",
  sunCol: "#8a8fb8", sunI: 1.8, sky: "#4a4a8a", ground: "#1c1c38", hemiI: 0.5,
  bias: -0.00025, normalBias: 0.015,
};
const NIGHT_LOOK: WorldLook = {
  sky: { c: ["#4a4a8a", "#3d3d7a", "#32326a", "#2a2a60", "#23235e"], e: [0, 3, 8, 16, 40] },
  water: { near: "#141c38", mid: "#232c5e", far: "#4a4a8a", crest: "#9fb2e8", trough: "#0c1226", glint: "#dfe6ff", shade: [0.5, 0.55, 0.75] },
  cloud: { lit: "#b9c0e8", mid: "#6a6fae", shade: "#3a3a6e" },
  bounce: [0.04, 0.025, 0.01],
  sat: 0.9,
};
/** Calm payoff water (S6): the sea goes quiet and golden — lerped in across S5-S6 from the storm palette. */
const CALM_WATER = { near: "#1e2447", mid: "#33336a", far: "#6a5a8a", crest: "#c8b8e8", trough: "#141a33", glint: "#ffe0a0" };
/** Wave amplitude (m) and spray strength per shot (S5 damps across the shot as the oil lays the water flat).
 *  PASS 2: v1 amplitudes (0.4-0.55 m) read as a flat calm sea at range — storm seas are 1.0-1.6 m here
 *  (crests at y ~0, kissing the horizon line from the low S5 cameras). S5 still damps 1.8 -> 0.12 and
 *  S6 stays flat at 0.06: the oil-calming story is unchanged, only the storm before it is bigger. */
const WAVE_AMP: Record<number, number> = { 1: 1.6, 2: 1.3, 3: 1.0, 4: 1.5, 5: 1.8, 6: 0.06 };
const SPRAY_K: Record<number, number> = { 1: 1.0, 2: 0.9, 3: 0.6, 4: 1.0, 5: 0.5, 6: 0.05 };

/** moon disc (solid, soft rim) and the flat halo */
const discTex = () => ctex("moonDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("moonHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

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

/** sheen edge wobble (v3): radius factor by angle around Y (theta = atan2(x, z), 0 = +z, the
 *  near / camera side). Three incommensurate sines break the rim into lobes (radius 0.33-0.67 of
 *  the unit disc) so the film edge never reads as a straight line at shallow angles. */
const sheenEdgeR = (th: number) => 0.5 * (1 + 0.16 * Math.sin(3 * th + 1.3) + 0.11 * Math.sin(5 * th + 2.1) + 0.07 * Math.sin(9 * th + 0.4));
/** flat wobbled disc in the XZ plane (unit: radius ~0.5), centre + 2 rings x 64 segments, uv 0..1
 *  across. Shared by the sheen base / detail / big-swirl layers so all three share one irregular edge. */
const wobbleDiscGeo = () => {
  const SEG = 64, pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5); nor.push(0, 1, 0); // centre vertex 0
  for (const f of [0.5, 1]) {
    for (let i = 0; i <= SEG; i++) {
      const th = (i / SEG) * Math.PI * 2, r = sheenEdgeR(th) * f;
      const x = r * Math.sin(th), z = r * Math.cos(th);
      pos.push(x, 0, z); uv.push(x + 0.5, z + 0.5); nor.push(0, 1, 0);
    }
  }
  for (let i = 0; i < SEG; i++) {
    idx.push(0, 1 + i, 1 + i + 1);
    const a = 1 + i, b = 1 + i + 1, c = 66 + i, d = 66 + i + 1;
    idx.push(a, c, d, a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
};
/** bright glint ribbon hugging the sheen's near (+z) edge: phi -1.2..1.2 rad around +z, band from
 *  0.84 to 1.0 of the wobbled edge radius, in the same unit-disc space as wobbleDiscGeo so it
 *  scales with the sheen. The near edge is the edge the S4/S5/S6 cameras face. */
const sheenGlintGeo = () => {
  const SEG = 40, pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const ph = -1.2 + (2.4 * i) / SEG, r = sheenEdgeR(ph);
    for (const f of [0.84, 1.0]) {
      const x = r * f * Math.sin(ph), z = r * f * Math.cos(ph);
      pos.push(x, 0, z); uv.push(i / SEG, f); nor.push(0, 1, 0);
    }
  }
  for (let i = 0; i < SEG; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#4a4a8a", 30, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<string, THREE.Texture[]>;
  private stormMaps: THREE.Texture[];
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private seaFar: THREE.Mesh;
  private wave: THREE.Mesh; private waveBase: Float32Array; private wavePos: THREE.BufferAttribute;
  private sheen: THREE.Mesh; private sheenMat: THREE.MeshBasicMaterial;
  private sheenDetail: THREE.Mesh; private sheenDetailMat: THREE.MeshBasicMaterial;
  private sheenSwirl: THREE.Mesh; private sheenSwirlMat: THREE.MeshBasicMaterial; // v3: large broken arcs, survive foreshortening
  private sheenGlint: THREE.Mesh; private sheenGlintMat: THREE.MeshBasicMaterial; // v3: bright rim on the near edge
  private bowlFilm: THREE.Mesh; // v3: gold film disc in the macro bowl (S5)
  private heldCan: THREE.Group; // v3: the cook's held oil can as a real 3D mesh (target 2)
  private pour: THREE.Mesh; private pourMat: THREE.MeshBasicMaterial;
  private spray: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: V3; phase: number; size: number; speed: number }[] = [];
  private pools: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
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
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(1.8, 1.9, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#4a4a8a", "#1c1c38", 0.5);
    this.sun = new THREE.DirectionalLight("#8a8fb8", 1.8); // the moon: cool key, shadow caster
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    // cloud palettes per light key; night falls back to the moonlit palette when the POST pass
    // has not added its own night entry to LOOK yet
    this.cloudMaps = {};
    for (const key of ["day", "golden", "dawn", "sanctuary", "night"]) {
      const pal = (LOOK as unknown as Record<string, WorldLook | undefined>)[key]?.cloud ?? NIGHT_LOOK.cloud;
      this.cloudMaps[key] = [0, 1, 2, 3].map((k) => cloudHD(k, pal));
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), effectMaterial("soft", { map: this.cloudMaps.night[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, alphaTest: 0 }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    // ---- near storm ring (PASS 2 + v3): the v1 sky had one soft blob — six closer, lower, darker
    // storm clouds (d 300-420, y 55-115, CLOUD_STORM_LIT palette) layer in front of the far ring so the
    // sky reads as layered weather. Marked userData.storm so update() keeps their dark maps (see below).
    // v3: the ring is now 10 clouds and uses the MOONLIT-TOP palette (CLOUD_STORM_LIT) — the v2 lit
    // crown (#8f97c8) was too dark to separate from the night sky. Material colour lifted 0.9 -> 1.05
    // for the same reason. The 4 extra clouds sit toward the sea/bow azimuth (~4.1 rad, where the
    // S1/S6 wides look): v2 spread 15 clouds over 360 deg, so only ~2 fell in the ~27 deg portrait
    // view cone. ----
    this.stormMaps = [0, 1, 2, 3].map((k) => cloudHD(10 + k, CLOUD_STORM_LIT));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.9, d = 300 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), effectMaterial("soft", { map: this.stormMaps[i % 4], color: new THREE.Color(1.05, 1.05, 1.15), transparent: true, depthWrite: false, alphaTest: 0 }));
      const w = 120 + (i % 3) * 45;
      m.position.set(Math.cos(a) * d, 55 + (i % 3) * 30, Math.sin(a) * d); m.scale.set(w, w / 2.2, 1);
      m.layers.set(NOINK); m.userData.storm = true;
      this.clouds.push(m); R.add(m);
    }
    for (let i = 0; i < 4; i++) { // v3: near-ring extras toward the sea azimuth (4.1 rad)
      const a = [3.8, 4.15, 4.5, 4.85][i], d = 320 + (i % 2) * 50;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), effectMaterial("soft", { map: this.stormMaps[i % 4], color: new THREE.Color(1.05, 1.05, 1.15), transparent: true, depthWrite: false, alphaTest: 0 }));
      const w = 130 + (i % 2) * 45;
      m.position.set(Math.cos(a) * d, 70 + (i % 2) * 35, Math.sin(a) * d); m.scale.set(w, w / 2.2, 1);
      m.layers.set(NOINK); m.userData.storm = true;
      this.clouds.push(m); R.add(m);
    }
    // ---- mid ring (v3): 4 clouds between the far and near rings (d 480-540, y 100-155, the
    // moonlit CLOUD_NIGHT palette) so the sky reads as three layered bands, not two. Also
    // clustered toward the sea azimuth. Not userData.storm: update() gives them the light-preset maps. ----
    for (let i = 0; i < 4; i++) {
      const a = [3.9, 4.2, 4.5, 4.8][i], d = 480 + (i % 2) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), effectMaterial("soft", { map: this.cloudMaps.night[i % 4], color: new THREE.Color(1.1, 1.1, 1.15), transparent: true, depthWrite: false, alphaTest: 0 }));
      const w = 160 + (i % 2) * 40;
      m.position.set(Math.cos(a) * d, 100 + (i % 2) * 55, Math.sin(a) * d); m.scale.set(w, w / 2.1, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    // ---- far-ring extras (v3): 5 more far clouds (d 680-760, y 150-240) toward the sea azimuth,
    // so the S1/S6 wides see a layered sky instead of 2 clouds over an empty horizon. ----
    for (let i = 0; i < 5; i++) {
      const a = [3.7, 4.0, 4.3, 4.6, 4.9][i], d = 680 + (i % 3) * 40;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), effectMaterial("soft", { map: this.cloudMaps.night[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, alphaTest: 0 }));
      const w = 150 + (i % 3) * 50;
      m.position.set(Math.cos(a) * d, 150 + (i % 3) * 45, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    // Total clouds: 9 far + 5 far extras + 4 mid + 10 near storm = 28 (v2: 15).

    // ---- the ship (build.ts) ----
    // MERGE (coordinator): the ship is built in build.ts local coords (long axis X, bow +X);
    // story.ts/cast.ts stage the film on the Z axis (bow -Z, stern +Z). Rotate the whole ship
    // group +90 deg about Y and shift +1 m in z so the mast lands at z = -1.5 and the wheel
    // lands exactly on story.ts WHEEL_PT [0, 1.1, 10.5]; STORM anchors in build.ts are the
    // rotated/world values. (Sight-culling boxes inside buildStormShip are still ship-local;
    // only loose props — verified on the stills.)
    const ship = buildStormShip(R, kit, sightLines());
    ship.rotation.y = Math.PI / 2;
    ship.position.z = 1;

    // ---- the sea (target 18): one shader material, two meshes — a flat far plane to the
    // horizon and a displaced wave mesh around the ship (wave crests are real geometry) ----
    const wNear = seaNearStorm(), wFar = seaFarStorm();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.55, 0.75) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
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
    waterM.customProgramCacheKey = () => "stormSea1";
    this.seaFar = new THREE.Mesh(quadUp(-400, 400, -400, 400, 1, 1, STORM.waterY - D0), waterM);
    this.seaFar.receiveShadow = true; R.add(this.seaFar);
    // wave mesh: 140 x 140 m around the ship, 5 cm above the far plane at rest so the two
    // never z-fight; displaced every frame in update() (crest-sharpened sines, edge falloff).
    // PASS 2: 56 -> 80 segments (1.75 m quads) so the bigger storm crests stay smooth, not stepped.
    const waveGeo = new THREE.PlaneGeometry(140, 140, 80, 80);
    waveGeo.rotateX(-Math.PI / 2);
    this.wave = new THREE.Mesh(waveGeo, waterM);
    this.wave.position.y = STORM.waterY + 0.05;
    this.wave.receiveShadow = true; this.wave.frustumCulled = false;
    R.add(this.wave);
    const wp = waveGeo.attributes.position as THREE.BufferAttribute;
    this.wavePos = wp;
    this.waveBase = new Float32Array(wp.count * 2);
    for (let i = 0; i < wp.count; i++) { this.waveBase[i * 2] = wp.getX(i); this.waveBase[i * 2 + 1] = wp.getZ(i); }

    // ---- golden oil sheen (S4-S6): flat golden film just above the water off the pour rail ----
    // v3: the sheen is a WOBBLED DISC (wobbleDiscGeo), not a rectangle — the v1/v2 plane's straight
    // edges were a large part of the "straight gold stripe" read. The base + detail + big-swirl
    // layers share the one irregular edge. All three use DoubleSide: the disc winding is upward,
    // but a missed face at a glancing angle would read as a hole in the film.
    // SCALE-AXIS FIX (v3, root cause of the v2 stripe residual): the v1/v2 code did
    // mesh.scale.set(len, len*0.62, 1) on a plane whose height had been baked into Z by
    // rotateX(-PI/2) — so scale.y stretched the zero Y dimension and the z-extent stayed 1 m:
    // the film really was a len x 1 m stripe (40 x 1 m in S6). The correct scale is
    // (len, 1, len*0.62), applied in update() below. ----
    this.sheenMat = effectMaterial("soft", { map: oilSheenTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0 });
    this.sheen = new THREE.Mesh(wobbleDiscGeo(), this.sheenMat);
    this.sheen.position.set(...STORM.sheen); this.sheen.layers.set(NOINK); this.sheen.renderOrder = 2;
    this.sheen.visible = false; this.sheen.frustumCulled = false;
    R.add(this.sheen);
    // ---- golden oil sheen, DETAIL layer (PASS 2): the tileable swirl texture over the same plane,
    // 3 cm above the base film so the two never z-fight; tiled + drifted per frame in update() ----
    this.sheenDetailMat = effectMaterial("soft", { map: oilSheenTile(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0 });
    this.sheenDetail = new THREE.Mesh(wobbleDiscGeo(), this.sheenDetailMat);
    this.sheenDetail.position.set(...STORM.sheen); this.sheenDetail.position.y += 0.03;
    this.sheenDetail.layers.set(NOINK); this.sheenDetail.renderOrder = 3;
    this.sheenDetail.visible = false; this.sheenDetail.frustumCulled = false;
    R.add(this.sheenDetail);
    // ---- golden oil sheen, BIG-SWIRL layer (v3): large broken arcs tiled at ~18 m, so the swirls
    // are 2-4 m long on the water and survive foreshortening in the shallow-angle wides, where the
    // 9 m detail tile foreshortens to a line. 6 cm above the base film. ----
    this.sheenSwirlMat = effectMaterial("soft", { map: oilSheenBig(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0 });
    this.sheenSwirl = new THREE.Mesh(wobbleDiscGeo(), this.sheenSwirlMat);
    this.sheenSwirl.position.set(...STORM.sheen); this.sheenSwirl.position.y += 0.06;
    this.sheenSwirl.layers.set(NOINK); this.sheenSwirl.renderOrder = 3;
    this.sheenSwirl.visible = false; this.sheenSwirl.frustumCulled = false;
    R.add(this.sheenSwirl);
    // ---- golden oil sheen, GLINT RIM (v3): a bright HDR gold ribbon hugging the wobbled near
    // (+z, camera-side) edge of the film — the hard bright line that stops the sheen reading as a
    // flat stripe at range. 9 cm above the base film; additive, so it glows over dark water and
    // blooms (colour channels > 1.0 trip the bloom threshold). ----
    this.sheenGlintMat = effectMaterial("additive", { color: new THREE.Color(2.4, 1.7, 0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0 });
    this.sheenGlint = new THREE.Mesh(sheenGlintGeo(), this.sheenGlintMat);
    this.sheenGlint.position.set(...STORM.sheen); this.sheenGlint.position.y += 0.09;
    this.sheenGlint.layers.set(NOINK); this.sheenGlint.renderOrder = 4;
    this.sheenGlint.visible = false; this.sheenGlint.frustumCulled = false;
    R.add(this.sheenGlint);
    // ---- pour stream (S4 only): thin golden thread from the rail down to the water ----
    this.pourMat = effectMaterial("soft", { color: new THREE.Color(1.9, 1.25, 0.35), transparent: true, opacity: 0, alphaTest: 0 });
    const pourTop = V(4.2, 0.05, 2), pourBot = V(4.6, -1.5, 2.2); // from the rail at STORM.pour [4,0,2]
    const pourLen = pourTop.distanceTo(pourBot);
    const pourGeo = new THREE.CylinderGeometry(0.045, 0.07, pourLen, 8);
    this.pour = new THREE.Mesh(pourGeo, this.pourMat);
    this.pour.position.copy(pourTop).add(pourBot).multiplyScalar(0.5);
    this.pour.quaternion.setFromUnitVectors(V(0, 1, 0), pourBot.clone().sub(pourTop).normalize());
    this.pour.layers.set(NOINK); this.pour.visible = false; this.pour.frustumCulled = false;
    R.add(this.pour);
    // ---- spray: billboards at the bow, along both rails, and over the foreground crests ----
    // PASS 2: v1 had 36 puffs of 1.2-2.6 m at the wrong place (bow cluster at x 11-17, off the
    // starboard beam, not the bow) and they were invisible against the night sea. Now 64 puffs of
    // 2-4 m: 20 at the bow (world z -13..-19, where the bow meets the sea), 24 along the rails,
    // 20 over the three foreground crests, so spray reads in the storm wides and the deck shots.
    const sprayT = sprayTex();
    const hh = (i: number, s: number) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
    const CREST_SPOTS: [number, number][] = [[14, 12], [6, 18], [6.5, 11]];
    for (let i = 0; i < 64; i++) {
      let bx: number, bz: number;
      if (i < 20) { bx = (hh(i, 1) - 0.5) * 10; bz = -13 - hh(i, 2) * 6; } // bow
      else if (i < 44) { bx = -11 + hh(i, 1) * 22; bz = (hh(i, 2) < 0.5 ? -1 : 1) * (4.5 + hh(i, 3) * 2); } // rails
      else { const [ax, az] = CREST_SPOTS[i % 3]; bx = ax + (hh(i, 1) - 0.5) * 6; bz = az + (hh(i, 2) - 0.5) * 6; } // crests
      const size = 2.0 + hh(i, 4) * 2.0;
      const mat = new THREE.MeshBasicMaterial({ map: sprayT, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      m.layers.set(NOINK); m.frustumCulled = false;
      this.spray.push({ m, mat, base: [bx, -1.2, bz], phase: hh(i, 5), size, speed: 0.4 + hh(i, 6) * 0.3 });
      R.add(m);
    }
    // ---- warm lantern pools on the deck (target 16): additive radial glows under the two deck lanterns ----
    const glowT = lanternGlowTex();
    for (let i = 0; i < 2; i++) {
      const [lx, , lz] = STORM.lanterns[i];
      const mat = new THREE.MeshBasicMaterial({ map: glowT, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
      const pg = new THREE.PlaneGeometry(6, 6); pg.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(pg, mat);
      m.position.set(lx, D0 + 0.04, lz); m.layers.set(NOINK); m.renderOrder = 3; m.frustumCulled = false;
      this.pools.push({ m, mat, phase: i * 2.1 });
      R.add(m);
    }
    // ---- macro bowl set (v3, shot-5 analogy + top-down macro): a wooden bowl of black water on a
    // crate at the starboard rail. FIXED world positions — the CAM agent frames exactly these, so
    // they are built here in world space (NOT inside the rotated ship group in build.ts) and never
    // sight-culled: crate at [3.8, 0, 1.4], 0.9 m tall; bowl on top, centre [3.8, 0.9, 1.4],
    // rim radius ~0.35 m. Crate corners + top rim carry dark battens so the ink read holds; the
    // bowl is a lathe (outer wall, over the rim, inner wall down to the inner bottom), the water
    // a near-black disc, and the gold film (this.bowlFilm, below) spreads across it in S5. ----
    {
      const crateM = lam("macroCrate", () => ({ map: beam() }));
      const darkM = lam("stormWoodDark", () => ({ color: "#4a3220" }));
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateM);
      crate.position.set(3.8, 0.45, 1.4); crate.castShadow = false; crate.receiveShadow = true;
      R.add(crate);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // dark corner battens (ink read)
        const bat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), darkM);
        bat.position.set(3.8 + sx * 0.43, 0.45, 1.4 + sz * 0.43); bat.castShadow = false; bat.receiveShadow = true;
        R.add(bat);
      }
      for (const [w, d, x, z] of [[0.94, 0.07, 3.8, 0.98], [0.94, 0.07, 3.8, 1.82], [0.07, 0.94, 3.38, 1.4], [0.07, 0.94, 4.22, 1.4]] as const) {
        const rimB = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), darkM);
        rimB.position.set(x, 0.875, z); rimB.castShadow = false; rimB.receiveShadow = true;
        R.add(rimB);
      }
      const bowlPts = [ // outer bottom -> outer rim -> inner rim -> inner bottom (world y = local + 0.9)
        new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.22, 0.0), new THREE.Vector2(0.30, 0.02),
        new THREE.Vector2(0.345, 0.08), new THREE.Vector2(0.35, 0.14), new THREE.Vector2(0.335, 0.155),
        new THREE.Vector2(0.32, 0.13), new THREE.Vector2(0.30, 0.07), new THREE.Vector2(0.24, 0.045),
        new THREE.Vector2(0.0, 0.04),
      ];
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 24),
        lam("macroBowl", () => ({ map: beam(), side: THREE.DoubleSide })));
      bowl.position.set(3.8, 0.9, 1.4); bowl.castShadow = false; bowl.receiveShadow = true;
      R.add(bowl);
      const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 8, 28).rotateX(Math.PI / 2),
        lam("macroBowlRim", () => ({ color: "#3a2415" })));
      bowlRim.position.set(3.8, 1.05, 1.4); bowlRim.castShadow = false; bowlRim.receiveShadow = true;
      R.add(bowlRim);
      const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.325, 28).rotateX(-Math.PI / 2),
        lam("macroWater", () => ({ color: "#06070d" })));
      bowlWater.position.set(3.8, 1.03, 1.4); bowlWater.receiveShadow = true;
      R.add(bowlWater);
      // gold oil film: a disc of the swirl texture, radius driven per frame in update() (S5 only);
      // rep() clones the texture so the sheen's per-frame repeat/offset drift never touches this disc.
      this.bowlFilm = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: rep(oilSheenTile(), 1, 1), transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide }));
      this.bowlFilm.position.set(3.8, 1.038, 1.4);
      this.bowlFilm.layers.set(NOINK); this.bowlFilm.renderOrder = 3; this.bowlFilm.frustumCulled = false;
      this.bowlFilm.visible = false;
      R.add(this.bowlFilm);
    }
    // ---- held oil can (v3, target 2): the cook's can as a real 3D toon-shaded mesh (build.ts
    // buildHeldOilCan), posed per frame in update() — S2 upright in his hands at OIL_CAN, S4
    // tilted over the rail as he pours. Hidden in S1/S3/S5/S6 (no can in his hands there). ----
    this.heldCan = buildHeldOilCan();
    this.heldCan.visible = false; this.heldCan.frustumCulled = false;
    R.add(this.heldCan);
    // the CAM agent's near framing objects: built once, never passed through the sight-line filter, toggled per frame
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      // mute the cartoon greens: lam() materials are shared, so clone each mesh material here and pull its
      // colour toward grey-green — the shrub reads as foliage, not a neon blob eating the frame bottom.
      // PASS 2: skip the mute for the storm foreground props (kitClone marks userData.noMute) — the
      // pale wave crest must stay pale, or the foreground reads as a grey-green blob instead of foam.
      if (!o.userData.noMute) o.traverse((x) => {
        const m = x as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        m.material = (Array.isArray(m.material)
          ? mats.map((mm) => {
              const c = (mm as THREE.MeshLambertMaterial).clone();
              if ((c as THREE.MeshLambertMaterial).color) (c as THREE.MeshLambertMaterial).color.setRGB(0.72, 0.76, 0.68);
              return c;
            })
          : (() => {
              const c = (mats[0] as THREE.MeshLambertMaterial).clone();
              if ((c as THREE.MeshLambertMaterial).color) (c as THREE.MeshLambertMaterial).color.setRGB(0.72, 0.76, 0.68);
              return c;
            })()) as typeof m.material;
      });
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative moon, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
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
    const az = THREE.MathUtils.degToRad(ss.sunAz ?? L.az), el = THREE.MathUtils.degToRad(ss.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az); // screen right = (-fz, fx)
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], b = bridgeState(id, t);
    // the POST pass owns lights.ts; until its "night" entry lands, the local NIGHT fallbacks carry the spec values
    const lightKey = s.light as string;
    const L: LightPreset = (LIGHTS as unknown as Record<string, LightPreset | undefined>)[lightKey] ?? NIGHT_LIGHT;
    const K: WorldLook = (LOOK as unknown as Record<string, WorldLook | undefined>)[lightKey] ?? NIGHT_LOOK;
    const isNight = lightKey === "night";
    // ---- camera ----
    const c = camAt(id, f);
    applyCam(cam, c, f);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK); // sky, clouds, spray, sheen and moon sprites live on the no-ink layer but are still rendered
    // ---- light rig (lighting.md 9.4): camera-relative moon frozen per shot, two-tone uniforms, shadow fit ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0; // not used by the two-tone shading
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog (colour = horizon colour, linear fogNear -> fogFar), moon disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    // the moon shows on night shots (and the old day presets keep Abu Simbel's sun behaviour);
    // it is cool and small (1.3 deg disc) where the day sun was warm and 1.7 deg
    const showMoon = isNight; // MERGE: Light is now "night" | "calm" only; the calm payoff has no moon disc
    this.sunDisc.visible = this.sunHalo.visible = showMoon;
    if (showMoon) {
      (this.sunDisc.material as THREE.SpriteMaterial).color.set(isNight ? 1.8 : 6.0, isNight ? 1.9 : 4.4, isNight ? 2.4 : 2.4);
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(isNight ? 1.3 : 1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(isNight ? 16 : 24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    const cloudTex = this.cloudMaps[lightKey] ?? this.cloudMaps.night;
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      // storm-ring clouds keep their dark maps; the far ring follows the light preset
      mat.map = m.userData.storm ? this.stormMaps[i % 4] : cloudTex[i % 4];
    }
    // ---- storm dynamics ----
    const prog = smooth((f - s.a) / Math.max(1, s.b - s.a)); // 0..1 across the shot
    // the sea calms under the oil: S5 damps from storm to flat, S6 stays flat and golden
    const calmK = id === 6 ? 1 : id === 5 ? prog : 0;
    const amp = id === 5 ? 1.8 + (0.12 - 1.8) * prog : WAVE_AMP[id] ?? 0.5;
    const sprayK = id === 5 ? 0.5 + (0.1 - 0.5) * prog : SPRAY_K[id] ?? 0.8;
    // ---- sea colours (on-screen targets, tone-map-inverted), lerped toward the calm gold in S5-S6 ----
    const W = this.WU, wc = K.water;
    const cA = new THREE.Color(), cB = new THREE.Color();
    const wcol = (key: "near" | "mid" | "far" | "crest" | "trough" | "glint", out: THREE.Color) => {
      if (calmK <= 0) return untone(wc[key], out);
      cA.set(wc[key]); cB.set(CALM_WATER[key]);
      out.lerpColors(cA, cB, calmK);
      return untone(out, out);
    };
    wcol("near", W.wNearC.value); wcol("mid", W.wMidC.value); wcol("far", W.wFarC.value);
    wcol("crest", W.wCrest.value); wcol("trough", W.wTrough.value); wcol("glint", W.wGlint.value);
    W.wShade.value.set(0.5, 0.55 - 0.05 * calmK, 0.75 - 0.05 * calmK); W.wTime.value = t;
    // ---- displaced wave mesh: crest-sharpened sines, falling off to flat at the 70 m edge ----
    {
      const arr = this.wavePos.array as Float32Array;
      for (let i = 0; i < this.wavePos.count; i++) {
        const x = this.waveBase[i * 2], z = this.waveBase[i * 2 + 1];
        const d = Math.max(Math.abs(x), Math.abs(z));
        const fall = 1 - smooth((d - 55) / 15);
        // PASS 2: keep the big storm seas OUT of the hull footprint (ellipse |x| < 6.5, |z| < 17) so
        // 1.6 m crests never poke through the deck — the sea breaks against the bow instead of
        // clipping through the planks. Full height abeam and ahead from ~15 m out.
        const shipD = Math.max(Math.abs(x) / 6.5, Math.abs(z) / 17);
        const shipFall = smooth((shipD - 1) / 0.6);
        const sv = 0.6 * Math.sin(0.35 * x + 0.5 * z - 1.9 * t)
          + 0.35 * Math.sin(0.22 * x - 0.31 * z + 1.3 * t)
          + 0.25 * Math.sin(0.5 * z - 0.8 * x + 2.3 * t);
        arr[i * 3 + 1] = amp * fall * shipFall * Math.sign(sv) * Math.pow(Math.abs(sv), 1.4) / 1.3;
      }
      this.wavePos.needsUpdate = true;
    }
    // ---- golden oil sheen: grows from the pour rail in S4, spreads in S5, covers the calm sea in S6 ----
    // PASS 2: base opacity 0.55 -> 0.85 (S4) / 0.6 -> 0.75 (S5-S6) — the v1 film was too transparent
    // over the dark water and read brown; the tileable detail layer (above) breaks the slab up.
    // v3: scale is (len, 1, len*0.62) — the v2 (len, len*0.62, 1) stretched the zero Y dimension
    // and left the z-extent at 1 m, so the film really was a len x 1 m stripe. The wobbled disc
    // edge, the 18 m big-swirl layer and the bright near-edge glint rim are what keep it from
    // reading as a stripe at the shallow-angle wides. Opacities unchanged from v2. ----
    if (id >= 4) {
      const len = id === 4 ? 2 + 12 * prog : id === 5 ? 14 + 12 * prog : 40;
      const wid = len * 0.62;
      this.sheen.visible = this.sheenDetail.visible = this.sheenSwirl.visible = this.sheenGlint.visible = true;
      for (const m of [this.sheen, this.sheenDetail, this.sheenSwirl, this.sheenGlint]) m.scale.set(len, 1, wid);
      this.sheenMat.opacity = id === 4 ? 0.85 * prog : 0.75;
      const dt = this.sheenDetailMat.map as THREE.Texture;
      dt.repeat.set(Math.max(1, len / 9), Math.max(1, wid / 9));
      dt.offset.set(t * 0.015, t * 0.008);
      this.sheenDetailMat.opacity = id === 4 ? 0.5 * prog : 0.55;
      const sw = this.sheenSwirlMat.map as THREE.Texture;
      sw.repeat.set(Math.max(1, len / 18), Math.max(1, wid / 18));
      sw.offset.set(t * 0.01, -t * 0.006);
      this.sheenSwirlMat.opacity = id === 4 ? 0.5 * prog : 0.55;
      this.sheenGlintMat.opacity = id === 4 ? 0.85 * prog : 0.7;
    } else this.sheen.visible = this.sheenDetail.visible = this.sheenSwirl.visible = this.sheenGlint.visible = false;
    // ---- macro bowl film (v3): the gold film spreads across the black bowl water through S5,
    // radius 0.05 m at f505 -> 0.33 m at f535, clamped outside that window; hidden outside S5
    // (the analogy beat — in other shots the bowl holds plain black water). ----
    this.bowlFilm.visible = id === 5;
    if (id === 5) {
      const filmR = 0.05 + 0.28 * smooth(clamp01((f - 505) / 30));
      this.bowlFilm.scale.set(filmR, 1, filmR);
    }
    // ---- held oil can (v3, target 2): S2 upright in the cook's hands at OIL_CAN [3.2, 1.0, 2],
    // S4 over the rail at [4.0, 1.0, 2], tilting from -8 deg to -70 deg as he pours (f348+,
    // ~30 f settle, mirroring the CHAR pass's pourK). Offset +0.25 m toward the camera (+z) so
    // the mesh sits in front of his hands, not inside the character card. Yaw -0.3 in S2 for a
    // 3/4 read; 0 in S4 so the spout points straight outboard along the pour stream. ----
    const canShot = id === 2 || id === 4;
    this.heldCan.visible = canShot;
    if (canShot) {
      const tiltK = id === 4 ? smooth(clamp01((f - 348) / 30)) : 0;
      this.heldCan.position.set(id === 4 ? 4.0 : OIL_CAN[0], 1.02, 2.25);
      this.heldCan.rotation.order = "YXZ";
      this.heldCan.rotation.set(0, id === 4 ? 0 : -0.3, -THREE.MathUtils.degToRad(8 + 62 * tiltK));
    }
    // ---- pour stream: only while the cook is pouring (S4, f 330-400) ----
    const pouring = id === 4 && f >= 330 && f < 400;
    this.pour.visible = pouring;
    if (pouring) this.pourMat.opacity = 0.9 * smooth((f - 330) / 8) * (1 - smooth((f - 392) / 8));
    // ---- spray: rise + drift downwind, fade with the storm ----
    // PASS 2: bigger, brighter, higher — v1 puffs (0.75 peak, 2.2 m rise) were invisible at range.
    for (const p of this.spray) {
      const life = (t * p.speed + p.phase) % 1;
      p.mat.opacity = sprayK * 0.9 * (1 - life) * smooth(life / 0.1);
      p.m.position.set(p.base[0] + life * 3.5, p.base[1] + life * 3.5, p.base[2]);
      p.m.scale.setScalar(0.7 + 1.0 * life);
      p.m.quaternion.copy(cam.quaternion);
    }
    // ---- lantern pools flicker on the deck ----
    for (const p of this.pools)
      p.mat.opacity = Math.max(0.3, 0.55 + 0.12 * Math.sin(t * 9.3 + p.phase) + 0.06 * Math.sin(t * 23.7 + p.phase * 2.5));
    // ---- foreground framing objects: inside their frames AND their own shot (so a crossfade layer never shows them) ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- cast + effects (CHAR pass) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, b, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "calm" ? "#ffcf9e" : "#ffffff"; // MERGE: the calm payoff is the golden shot, so it takes the warm tint
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
  vec2 wp = vWP.xz + vec2(0.35 * wTime, 0.0);           // slow drift along +x
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.45);
  wc = mix(wc, wGlint, mk.b * (0.15 + 0.25 * wf));
  diffuseColor.rgb = wc;`;

/** horizontal quad facing up at height D0 + dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
