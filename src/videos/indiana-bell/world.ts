// Complete 3D scene for "Indiana Bell" (1930 Indianapolis building rotation).
// Pure function of (id, f): World.update(id, f, cam, scene) poses the hero building
// (lift + 90-degree rotation), the plan-table model, office/switchboard interiors,
// the imagination rig, the underground cross-section (ONLY in shots 20-22), the
// entrance bridge, and the 2D cast.

import * as THREE from "three";
import {
  Batch, V, lam, ub, buildIndianaSets, addDigit3D, addNumberPlaque3D, Kit,
} from "./build";
import { ctex, grassHD, cloudHD, brick, rep, stoneHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, D0, SHOTS, camAt, buildingState, smooth, clamp01, easeOut, ShotDef, V3,
  X_SITE, X_PLAN, X_OFFICE, X_SWITCH, X_MEET, X_IMAGINE, X_XRAY, X_DOOR,
} from "./story";
import { applyCam } from "../common/applyCam";

// No external GLBs required; procedural geometry & textures handle everything cleanly
export const loadKit = (): Promise<Kit> => Promise.resolve({});

const discTex = () =>
  ctex("sunDisc", 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });

const haloTex = () =>
  ctex("sunHalo", 256, 256, (g) => {
    const im = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const u = Math.hypot(x - 127.5, y - 127.5) / 128;
        const a =
          (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) *
          (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
        const i = (y * 256 + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
        im.data[i + 3] = Math.round(255 * Math.min(1, a));
      }
    g.putImageData(im, 0, 0);
  });

function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private pitLight: THREE.PointLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 35, 360);
  private sunDisc: THREE.Sprite;
  private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "dusk", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sph = new THREE.Sphere();

  // Dynamic groups
  private buildingGroup = new THREE.Group();   // the hero 8-storey building (X_SITE)
  private planModel = new THREE.Group();       // rotating model on the blueprint table (X_PLAN)
  private planArrow = new THREE.Group();       // green 90-degree arc arrow + digits (shot 9)
  private counter600 = new THREE.Group();      // floating 3D "600" counter (shot 5)
  private counter18 = new THREE.Group();       // floating 3D "18" counter (shot 14)
  private clockHands = { hour: new THREE.Mesh(), minute: new THREE.Mesh() };
  private silhouette = new THREE.Group();      // tower silhouette outside the office window
  private switchLights: THREE.Mesh[] = [];     // blinking switchboard lamps (shot 6)
  private xSign = new THREE.Group();           // red X on the elevation board (shots 7-8)
  private waterBurst = new THREE.Group();      // imagined pipe-burst droplets (shot 12)
  private crackGroup = new THREE.Group();      // growing wall cracks (shot 13)
  private crackSegs: THREE.Mesh[] = [];
  private calendarPages: THREE.Group[] = [];   // flipping calendar pages (shot 16)
  private rulerMarker = new THREE.Mesh();      // creeping marker on the 15 IN/HR ruler (shot 17)
  private xrayGroup = new THREE.Group();       // cross-section dynamics (shots 20-22 ONLY)
  private xrayGhost = new THREE.Group();
  private slideBeam = new THREE.Mesh();
  private flexPipes = new THREE.Group();
  private xrayMarkers: THREE.Group[] = [];
  private doorBridge = new THREE.Group();      // wheeled steel entrance bridge (shot 23)
  private hqGroup = new THREE.Group();         // new HQ rising beside the moved building (shot 26)
  private settleGlow = new THREE.Mesh();       // precision glow on the ground line (shot 25)

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color() },
        c1: { value: new THREE.Color() },
        c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() },
        c4: { value: new THREE.Color() },
        e: { value: new THREE.Vector4() },
      },
      vertexShader:
        "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.sky.layers.set(NOINK);
    R.add(this.sky);

    this.sunDisc = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }),
    );
    this.sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTex(),
        color: new THREE.Color(1, 1, 1),
        fog: false,
        depthWrite: false,
        depthTest: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sunDisc.renderOrder = -0.5;
    this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) {
      m.frustumCulled = false;
      m.layers.set(NOINK);
      R.add(m);
    }

    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    // Cool work-light inside the X-ray pit (visible in beat-4 shots only)
    this.pitLight = new THREE.PointLight("#cfeaff", 600, 42, 1.5);
    this.pitLight.position.set(X_XRAY, 2.5, 0.5);
    this.pitLight.visible = false;
    R.add(this.pitLight);

    this.cloudMaps = {
      day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)),
      golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      dusk: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.dusk.cloud)),
    };
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: this.cloudMaps.day[i % 4],
          color: new THREE.Color(1.1, 1.1, 1.1),
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d);
      m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m);
      R.add(m);
    }

    // Ground plane — built from 4 quads leaving a hole over the X-ray pit
    // (X_XRAY: x 262..278, z -2.5..3.5) so the cross-section stays visible
    const gb = new Batch();
    const grass = lam("grassHD", () => ({ map: grassHD() }));
    gb.add(quadUp(-900, X_XRAY - 8, -900, 900, 450, 450, -0.05), grass);
    gb.add(quadUp(X_XRAY + 8, 900, -900, 900, 450, 450, -0.05), grass);
    gb.add(quadUp(X_XRAY - 8, X_XRAY + 8, -900, -2.5, 8, 450, -0.05), grass);
    gb.add(quadUp(X_XRAY - 8, X_XRAY + 8, 3.5, 900, 8, 450, -0.05), grass);
    gb.build(R, false);

    // Static architecture across all 8 zones
    buildIndianaSets(R, kit, []);

    // Build dynamic groups
    this.buildHeroBuilding(R);
    this.buildPlanModel(R);
    this.buildOfficeDynamics(R);
    this.buildMeetDynamics(R);
    this.buildImagineDynamics(R);
    this.buildSiteProps(R);
    this.buildXrayDynamics(R);
    this.buildDoorAndCity(R);
  }

  // ---------------- 1. The hero building: 8 brick storeys on a stone skirt ----------------
  private buildHeroBuilding(R: THREE.Object3D) {
    const b = new Batch();
    const id = new THREE.Matrix4();
    const brickMat = lam("iBrickTall", () => ({ map: rep(brick(), 6, 3) }));
    const cream = lam("iCream", () => ({ color: "#efe4ce" }));
    const stone = lam("iStone", () => ({ map: stoneHD("iStoneHD") }));
    const glass = lam("iWinGlass", () => ({ color: "#bfe0f2" }));
    const winLit = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.18, 0.62) });
    const dark = lam("iPhone", () => ({ color: "#1c1e24" }));

    // Stone skirt that reaches the foundation when lowered (local y -0.7..0.2)
    ub(b, stone, id, -6.6, 6.6, -0.7, 0.2, -4.6, 4.6);
    // 8 floors of brick with cream string courses
    for (let fl = 0; fl < 8; fl++) {
      const y0 = 0.2 + fl * 2.7;
      ub(b, brickMat, id, -6.5, 6.5, y0, y0 + 2.52, -4.5, 4.5);
      ub(b, cream, id, -6.62, 6.62, y0 + 2.52, y0 + 2.7, -4.62, 4.62);
      // Front (+z) windows: 6 per floor
      for (let wi = 0; wi < 6; wi++) {
        const wx = -5.0 + wi * 2.0;
        ub(b, cream, id, wx - 0.52, wx + 0.52, y0 + 0.55, y0 + 2.05, 4.5, 4.6);
        ub(b, (fl * 6 + wi) % 3 === 0 ? winLit : glass, id, wx - 0.4, wx + 0.4, y0 + 0.68, y0 + 1.92, 4.58, 4.64);
      }
      // Back (-z) windows: 6 per floor
      for (let wi = 0; wi < 6; wi++) {
        const wx = -5.0 + wi * 2.0;
        ub(b, cream, id, wx - 0.52, wx + 0.52, y0 + 0.55, y0 + 2.05, -4.6, -4.5);
        ub(b, glass, id, wx - 0.4, wx + 0.4, y0 + 0.68, y0 + 1.92, -4.64, -4.58);
      }
      // Side windows: 4 per floor on each flank
      for (const sx of [-1, 1]) {
        for (let wi = 0; wi < 4; wi++) {
          const wz = -3.3 + wi * 2.2;
          ub(b, cream, id, sx * 6.5, sx * 6.6, y0 + 0.55, y0 + 2.05, wz - 0.52, wz + 0.52);
          ub(b, (fl + wi) % 4 === 0 ? winLit : glass, id, sx * 6.58, sx * 6.64, y0 + 0.68, y0 + 1.92, wz - 0.4, wz + 0.4);
        }
      }
    }
    // Entrance on the front, ground floor: recessed double door + canopy
    ub(b, dark, id, -1.05, 1.05, 0.2, 2.6, 4.55, 4.72);
    ub(b, lam("iDoorWood", () => ({ color: "#4a3220" })), id, -0.92, -0.06, 0.2, 2.5, 4.6, 4.68);
    ub(b, lam("iDoorWood", () => ({ color: "#4a3220" })), id, 0.06, 0.92, 0.2, 2.5, 4.6, 4.68);
    ub(b, cream, id, -1.5, 1.5, 2.6, 2.85, 4.5, 5.3);
    // Cornice + parapet + roof furniture (stair bulkhead & water tank)
    ub(b, cream, id, -6.95, 6.95, 21.75, 22.15, -4.95, 4.95);
    ub(b, brickMat, id, -6.6, 6.6, 22.15, 22.6, -4.6, 4.6);
    ub(b, stone, id, -6.6, 6.6, 22.6, 22.75, -4.6, 4.6);
    ub(b, brickMat, id, 2.8, 5.4, 22.75, 24.3, -1.4, 1.4);
    b.add(new THREE.CylinderGeometry(1.05, 1.05, 2.2, 14).translate(-4.2, 24.4, -2.2), lam("iTank", () => ({ color: "#7a5a38" })));
    for (const [tx, tz] of [[-4.9, -2.9], [-3.5, -2.9], [-4.9, -1.5], [-3.5, -1.5]]) {
      ub(b, dark, id, tx - 0.07, tx + 0.07, 22.75, 23.35, tz - 0.07, tz + 0.07);
    }
    b.build(this.buildingGroup);
    R.add(this.buildingGroup);
  }

  // ---------------- 2. Plan-table model + green rotation arrow ----------------
  private buildPlanModel(R: THREE.Object3D) {
    const b = new Batch();
    const id = new THREE.Matrix4();
    const brickMat = lam("iBrick", () => ({ map: rep(brick(), 5, 5) }));
    const cream = lam("iCream", () => ({ color: "#efe4ce" }));
    const glass = lam("iWinGlass", () => ({ color: "#bfe0f2" }));
    // Miniature 8-storey block (3.6 x 2.6 footprint, 2.4 high) on a timber base
    ub(b, lam("iTimberDark", () => ({ color: "#5e3e24" })), id, -2.0, 2.0, 0, 0.18, -1.5, 1.5);
    ub(b, brickMat, id, -1.8, 1.8, 0.18, 2.3, -1.3, 1.3);
    for (let fl = 0; fl < 4; fl++) {
      ub(b, cream, id, -1.86, 1.86, 0.62 + fl * 0.48, 0.7 + fl * 0.48, -1.36, 1.36);
    }
    for (let wi = 0; wi < 5; wi++) {
      ub(b, glass, id, -1.45 + wi * 0.72 - 0.2, -1.45 + wi * 0.72 + 0.2, 0.85, 2.1, 1.3, 1.38);
    }
    ub(b, cream, id, -1.95, 1.95, 2.3, 2.48, -1.45, 1.45);
    b.build(this.planModel);
    this.planModel.position.set(X_PLAN - 2.9, 0.04, -1.7);
    R.add(this.planModel);

    // Green arc arrow (flat torus arc + cone head) and "90" digits — shot 9 props
    const greenGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 2.0, 0.75) });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.1, 8, 40, 1.65), greenGlow);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = -0.35;
    arc.position.set(0, 0.12, 0);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 10), greenGlow);
    const ha = -0.35 + 1.65;
    head.position.set(Math.cos(ha) * 5.4, 0.12, -Math.sin(ha) * 5.4);
    head.rotation.z = Math.PI / 2;
    head.rotation.y = -ha;
    this.planArrow.add(arc, head);
    const db = new Batch();
    const gold = lam("iGold", () => ({ color: "#e5b842" }));
    addDigit3D(db, "9", 3.4, 0.55, 3.6, 0.85, 1.3, 0.18, gold);
    addDigit3D(db, "0", 4.5, 0.55, 3.6, 0.85, 1.3, 0.18, gold);
    // small degree ring
    const deg = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 14), gold);
    deg.position.set(5.35, 1.15, 3.6);
    db.build(this.planArrow, false);
    this.planArrow.add(deg);
    this.planArrow.position.set(X_PLAN - 2.9, 0.04, -1.7);
    R.add(this.planArrow);
  }

  // ---------------- 3. Office dynamics: 600 counter, desk clock, window silhouette, cup ----------------
  private buildOfficeDynamics(R: THREE.Object3D) {
    const id = new THREE.Matrix4();
    // Floating "600" counter (shot 5)
    {
      const b = new Batch();
      addNumberPlaque3D(b, "600", 0, 0, 0, 0.85, 1.4, lam("iPlaqueDark", () => ({ color: "#1e2638" })), lam("iCream", () => ({ color: "#efe4ce" })), lam("iGold", () => ({ color: "#e5b842" })));
      b.build(this.counter600, false);
      this.counter600.position.set(X_OFFICE, 5.4, -3.2);
      R.add(this.counter600);
    }
    // Desk clock with spinning hands (shot 10) on the desk at (X_OFFICE-2.5, z 1.5)
    {
      const b = new Batch();
      const dark = lam("iPhone", () => ({ color: "#1c1e24" }));
      const cream = lam("iCream", () => ({ color: "#efe4ce" }));
      b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateX(Math.PI / 2), dark);
      b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.11, 20).rotateX(Math.PI / 2), cream);
      ub(b, dark, id, -0.2, 0.2, -0.62, -0.4, -0.05, 0.05);
      b.build(this.clockGroupFix);
      // Hands (separate meshes, posed in update)
      const handMat = new THREE.MeshBasicMaterial({ color: "#1c1e24" });
      this.clockHands.hour = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.21, 0.02), handMat);
      this.clockHands.hour.geometry.translate(0, 0.09, 0);
      this.clockHands.minute = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.31, 0.02), handMat);
      this.clockHands.minute.geometry.translate(0, 0.14, 0);
      this.clockHands.hour.position.set(0, 0, 0.07);
      this.clockHands.minute.position.set(0, 0, 0.08);
      this.clockGroupFix.add(this.clockHands.hour, this.clockHands.minute);
      this.clockGroupFix.position.set(X_OFFICE - 3.6, 1.32, 1.62);
      R.add(this.clockGroupFix);
    }
    // Tower outside the window desk bay (shots 18-19): slides as the world turns.
    // Window grid + cornice on the front face so it reads as a building through
    // glass, not a flat overlay panel.
    {
      const b = new Batch();
      const sil = lam("iSilBody", () => ({ color: "#6d89ad" }));
      const silSide = lam("iSilSide", () => ({ color: "#546f8f" }));
      const silGlass = lam("iSilGlass", () => ({ color: "#b9d2ea" }));
      const silLit = new THREE.MeshBasicMaterial({ color: "#ffd98a" });
      ub(b, sil, id, -1.3, 0.6, 0, 3.9, -0.1, 0.1);
      ub(b, silSide, id, 0.75, 1.55, 0, 2.6, -0.1, 0.1);
      ub(b, silSide, id, -0.9, 0.2, 3.9, 4.25, -0.1, 0.1);
      for (const wx of [-0.85, 0.15]) for (const wy of [0.75, 1.65, 2.55, 3.35]) {
        const lit = (wx < 0 && wy === 1.65) || (wx > 0 && wy === 3.35);
        ub(b, lit ? silLit : silGlass, id, wx - 0.17, wx + 0.17, wy - 0.25, wy + 0.25, 0.1, 0.145);
      }
      b.build(this.silhouette, false);
      this.silhouette.position.set(X_OFFICE + 3.2, 0.35, -2.7);
      R.add(this.silhouette);
    }
    // The coffee cup on the window desk (shots 18-19): white cup, still dark surface
    {
      const b = new Batch();
      const cupMat = lam("iCup", () => ({ color: "#f4f1ea" }));
      b.add(new THREE.CylinderGeometry(0.09, 0.07, 0.13, 14).translate(0, 0.065, 0), cupMat);
      b.add(new THREE.TorusGeometry(0.055, 0.016, 6, 14).translate(0.1, 0.07, 0), cupMat);
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.078, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#3a2410" }));
      coffee.position.set(0, 0.128, 0);
      const cupGroup = new THREE.Group();
      b.build(cupGroup, false);
      cupGroup.add(coffee);
      cupGroup.position.set(X_OFFICE + 3.35, 0.86, 0.95);
      R.add(cupGroup);
    }
    // Blinking switchboard lamps: two rows of small amber lamps on the panel (shot 6)
    {
      const lampGeo = new THREE.BoxGeometry(0.17, 0.17, 0.06);
      for (let i = 0; i < 28; i++) {
        const m = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.3) }));
        const col = i % 14, row = Math.floor(i / 14);
        m.position.set(X_SWITCH - 9.4 + col * 1.45, 4.05 - row * 0.5, -4.38);
        this.switchLights.push(m);
        R.add(m);
      }
    }
  }
  private clockGroupFix = new THREE.Group();

  // ---------------- 4. Meeting dynamics: the red X that gets wiped ----------------
  private buildMeetDynamics(R: THREE.Object3D) {
    const b = new Batch();
    const redGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.25, 0.2) });
    const m1 = new THREE.Matrix4().makeRotationZ(0.72);
    const m2 = new THREE.Matrix4().makeRotationZ(-0.72);
    ub(b, redGlow, m1, -0.14, 0.14, -1.05, 1.05, -0.05, 0.05);
    ub(b, redGlow, m2, -0.14, 0.14, -1.05, 1.05, -0.05, 0.05);
    b.build(this.xSign, false);
    // Board centre is (X_MEET+1.6, ~1.9, -1.40); the X sits on its face
    this.xSign.position.set(X_MEET + 1.6, 1.95, -1.33);
    R.add(this.xSign);
  }

  // ---------------- 5. Imagination dynamics: water burst & wall cracks ----------------
  private buildImagineDynamics(R: THREE.Object3D) {
    // Droplets: small blue boxes sprayed from the ground pipe run (shot 12)
    const dropMat = new THREE.MeshBasicMaterial({ color: "#7cc4ff" });
    const dropGeo = new THREE.SphereGeometry(0.09, 8, 6);
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(dropGeo, dropMat);
      this.waterBurst.add(d);
    }
    const spray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.85, 1.7, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1.15), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }),
    );
    spray.position.set(0, 0.8, 0);
    spray.name = "spray";
    this.waterBurst.add(spray);
    this.waterBurst.position.set(X_IMAGINE - 2.2, 0.75, 2.9);
    R.add(this.waterBurst);

    // Crack segments on the brick wall face (shot 13): jagged thin dark boxes that grow
    const crackMat = new THREE.MeshBasicMaterial({ color: "#180f0a" });
    const segs: [number, number, number, number, number][] = [
      // cx, cy, len, width, rotZ  (wall face at z = -0.68, wall centre x = X_IMAGINE+10)
      [9.6, 4.9, 1.5, 0.09, 0.5],
      [9.95, 4.15, 1.3, 0.08, -0.35],
      [10.15, 3.45, 1.2, 0.075, 0.42],
      [10.5, 2.85, 1.1, 0.07, -0.3],
      [10.3, 4.6, 0.9, 0.06, 1.15],
      [9.75, 3.6, 0.85, 0.06, -1.2],
      [10.05, 5.3, 0.8, 0.055, 1.25],
      [9.35, 3.9, 0.75, 0.055, -1.05],
    ];
    for (const [cx, cy, len, w, rz] of segs) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.04), crackMat);
      seg.geometry.translate(0, -len / 2, 0); // grow downward from the top joint
      seg.position.set(X_IMAGINE + cx, cy + len / 2, -0.66);
      seg.rotation.z = rz;
      this.crackSegs.push(seg);
      this.crackGroup.add(seg);
    }
    R.add(this.crackGroup);
  }

  // ---------------- 6. Site props: calendar, ruler & marker, "18" counter, settle glow ----------------
  private buildSiteProps(R: THREE.Object3D) {
    const id = new THREE.Matrix4();
    // Calendar on a stand (shot 16): back board + 6 flipping pages with red header bands
    {
      const stand = new THREE.Group();
      const b = new Batch();
      const dark = lam("iTimberDark", () => ({ color: "#5e3e24" }));
      ub(b, dark, id, -0.95, 0.95, 0.9, 3.1, -0.09, 0.03);
      ub(b, dark, id, -0.8, -0.62, 0, 0.95, -0.06, 0.06);
      ub(b, dark, id, 0.62, 0.8, 0, 0.95, -0.06, 0.06);
      b.build(stand);
      const pageMat = lam("iPage", () => ({ color: "#f7f2e4" }));
      const bandMat = lam("iRed", () => ({ color: "#c22e2e" }));
      for (let i = 0; i < 6; i++) {
        const page = new THREE.Group();
        const pb = new Batch();
        ub(pb, pageMat, id, -0.82, 0.82, -1.85, 0, -0.012 - i * 0.004, 0.012 - i * 0.004);
        ub(pb, bandMat, id, -0.82, 0.82, -0.32, 0, -0.014 - i * 0.004, 0.014 - i * 0.004);
        pb.build(page, false);
        page.position.set(0, 2.92, 0.06 + i * 0.006);
        stand.add(page);
        this.calendarPages.push(page);
      }
      stand.position.set(11.8, 0, 8.6);
      stand.rotation.y = -0.5;
      stand.name = "calendarStand";
      R.add(stand);
      this.calendarStand = stand;
    }
    // The 15 IN/HR ruler + creeping marker (shot 17). Grouped and parked at the
    // front-right corner (radius 8.7 from the building centre, bar end touching
    // the shot-25 settle line) so the building's 90° rotation can never swallow
    // it — at the old base-centre spot the rotated skirt buried it in shot 17.
    {
      const ruler = new THREE.Group();
      const b = new Batch();
      const cream = lam("iCream", () => ({ color: "#efe4ce" }));
      const dark = lam("iPhone", () => ({ color: "#1c1e24" }));
      ub(b, cream, id, -1.7, 1.7, 0.6, 0.7, -0.11, 0.11);
      for (let i = 0; i <= 15; i++) {
        const tx = -1.55 + i * 0.207;
        ub(b, dark, id, tx - 0.016, tx + 0.016, 0.7, i % 5 === 0 ? 0.86 : 0.78, -0.07, 0.07);
      }
      addNumberPlaque3D(b, "15", 2.45, 0.68, 0, 0.34, 0.55, lam("iPlaqueDark", () => ({ color: "#1e2638" })), cream, lam("iGold", () => ({ color: "#e5b842" })));
      b.build(ruler, false);
      this.rulerMarker = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.3, 0.2) }));
      this.rulerMarker.position.set(-1.55, 0.82, 0);
      ruler.add(this.rulerMarker);
      ruler.position.set(5.7, 0, 6.6);
      ruler.rotation.y = 0.85;
      R.add(ruler);
    }
    // Floating "18" counter (shot 14)
    {
      const b = new Batch();
      addNumberPlaque3D(b, "18", 0, 0, 0, 0.8, 1.3, lam("iPlaqueDark", () => ({ color: "#1e2638" })), lam("iCream", () => ({ color: "#efe4ce" })), lam("iGold", () => ({ color: "#e5b842" })));
      b.build(this.counter18, false);
      this.counter18.position.set(0, 3.9, 7.4);
      R.add(this.counter18);
    }
    // Precision glow strip on the ground line at the settled corner (shot 25)
    this.settleGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 5.5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 0.9), transparent: true, opacity: 0.85 }),
    );
    this.settleGlow.position.set(4.5, 0.1, 6.6);
    R.add(this.settleGlow);
  }
  private calendarStand = new THREE.Group();

  // ---------------- 7. Cross-section dynamics (SHOTS 20-22 ONLY) ----------------
  private buildXrayDynamics(R: THREE.Object3D) {
    const id = new THREE.Matrix4();
    // Ghost of the building's lower floors above the pit (translucent cyan shell)
    {
      const ghostMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
      const edgeMat = new THREE.MeshBasicMaterial({ color: "#7dd3fc" });
      const b = new Batch();
      ub(b, ghostMat, id, -6.5, 6.5, 0.1, 5.6, -4.5, 4.5);
      for (const fy of [0.1, 2.8, 5.6]) {
        ub(b, edgeMat, id, -6.6, 6.6, fy - 0.05, fy + 0.05, 4.55, 4.65);
        ub(b, edgeMat, id, -6.6, 6.6, fy - 0.05, fy + 0.05, -4.65, -4.55);
      }
      b.build(this.xrayGhost, false);
      this.xrayGhost.position.set(X_XRAY, 0, 0);
      this.xrayGroup.add(this.xrayGhost);
    }
    // Sliding steel beam under the left column footing (shot 21 glide)
    this.slideBeam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.7), twoTone(new THREE.MeshLambertMaterial({ color: "#c8d4e2" })));
    this.slideBeam.position.set(X_XRAY - 2.4, -1.3, 0);
    this.xrayGroup.add(this.slideBeam);
    // Flexible utility pipes across the pit floor (shot 22): pre-bent chains of cylinders
    {
      const runs: [number, string, number][] = [
        [-2.45, "#3f8fe0", 0],   // water (blue)
        [-2.75, "#f5b921", 0.9], // gas (yellow)
        [-2.2, "#5a6474", 1.8],  // telephone cable bundle (dark)
      ];
      for (const [py, col, ph] of runs) {
        const mat = twoTone(new THREE.MeshLambertMaterial({ color: col }));
        const run = new THREE.Group();
        for (let i = 0; i < 8; i++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.95, 8), mat);
          const sx = -7 + i * 2.0;
          seg.rotation.z = Math.PI / 2;
          seg.position.set(sx, Math.sin(i * 1.1 + ph) * 0.14, 0);
          seg.rotation.y = Math.sin(i * 1.1 + ph) * 0.16;
          run.add(seg);
        }
        run.position.set(X_XRAY, py, 0.2);
        this.flexPipes.add(run);
      }
      this.xrayGroup.add(this.flexPipes);
    }
    // Three glowing numbered secret markers (shot 20): 1 rollers, 2 flex pipes, 3 bridge link
    {
      const spots: [number, number, number, string][] = [
        [-2.4, -1.55, 1.6, "1"],
        [0.6, -2.5, 1.6, "2"],
        [5.2, -1.9, 1.6, "3"],
      ];
      const gold = lam("iGold", () => ({ color: "#e5b842" }));
      for (const [mx, my, mz, digit] of spots) {
        const g = new THREE.Group();
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.1, 1.1) }));
        g.add(glow);
        const db = new Batch();
        addDigit3D(db, digit, 0, 1.05, 0, 0.66, 1.05, 0.16, gold);
        db.build(g, false);
        g.position.set(X_XRAY + mx, my, mz);
        this.xrayMarkers.push(g);
        this.xrayGroup.add(g);
      }
    }
    this.xrayGroup.visible = false;
    R.add(this.xrayGroup);
  }

  // ---------------- 8. Entrance bridge (shot 23) + new HQ (shot 26) ----------------
  private buildDoorAndCity(R: THREE.Object3D) {
    const id = new THREE.Matrix4();
    // Wheeled steel bridge spanning the gap trench at the door
    {
      const b = new Batch();
      const steel = lam("iSteel", () => ({ color: "#9aa7b8" }));
      const iron = lam("iIron", () => ({ color: "#343a46" }));
      // Deck plate (spans z 0.1..3.3 at y 0.52..0.64)
      ub(b, steel, id, -1.15, 1.15, 0.52, 0.64, 0.1, 3.3);
      // Side trusses
      for (const sx of [-1.15, 1.15]) {
        ub(b, iron, id, sx - 0.07, sx + 0.07, 0.64, 1.2, 0.15, 3.25);
        ub(b, iron, id, sx - 0.07, sx + 0.07, 1.2, 1.32, 0.15, 3.25);
        for (let ti = 0; ti < 4; ti++) {
          const m = new THREE.Matrix4().makeTranslation(sx, 0.92, 0.6 + ti * 0.8).multiply(new THREE.Matrix4().makeRotationX(0.7));
          ub(b, iron, m, -0.05, 0.05, -0.42, 0.42, -0.05, 0.05);
        }
      }
      b.build(this.doorBridge);
      // Wheels under the deck ends
      const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12).rotateZ(Math.PI / 2);
      const wheelMat = lam("iIron", () => ({ color: "#343a46" }));
      for (const [wx, wz] of [[-1.0, 0.5], [1.0, 0.5], [-1.0, 2.9], [1.0, 2.9]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.3, wz);
        this.doorBridge.add(w);
      }
      this.doorBridge.position.set(X_DOOR, 0, 0);
      R.add(this.doorBridge);
    }
    // The new HQ tower rising on the foundation plot (shot 26)
    {
      const b = new Batch();
      const stone = lam("iStone", () => ({ map: stoneHD("iStoneHD") }));
      const cream = lam("iCream", () => ({ color: "#efe4ce" }));
      const winLit = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.2, 0.6) });
      const glass = lam("iWinGlass", () => ({ color: "#bfe0f2" }));
      // Stepped art-deco massing: 3 tiers
      ub(b, stone, id, -6, 6, 0, 13, -4.5, 4.5);
      ub(b, stone, id, -4.6, 4.6, 13, 21, -3.6, 3.6);
      ub(b, stone, id, -3.2, 3.2, 21, 26.5, -2.6, 2.6);
      ub(b, cream, id, -3.5, 3.5, 26.5, 27.1, -2.9, 2.9);
      b.add(new THREE.CylinderGeometry(0.07, 0.2, 2.6, 8).translate(0, 28.4, 0), lam("iGold", () => ({ color: "#e5b842" })));
      // Lit window columns up the front
      for (let fl = 0; fl < 9; fl++) {
        const wy = 1.2 + fl * 2.7;
        const halfW = wy < 13 ? 6 : wy < 21 ? 4.6 : 3.2;
        for (let wi = 0; wi < 5; wi++) {
          const wx = -halfW + 1.2 + wi * ((halfW * 2 - 2.4) / 4);
          ub(b, (fl * 5 + wi) % 3 === 0 ? glass : winLit, id, wx - 0.34, wx + 0.34, wy, wy + 1.5, 4.52, 4.58);
          if (wy < 13) ub(b, (fl + wi) % 4 === 0 ? winLit : glass, id, wx - 0.34, wx + 0.34, wy, wy + 1.5, -4.58, -4.52);
        }
      }
      b.build(this.hqGroup);
      this.hqGroup.position.set(22.5, 0.1, 0);
      this.hqGroup.visible = false;
      R.add(this.hqGroup);
    }
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1] ?? SHOTS[0], bs = buildingState(id, t), L = LIGHTS[s.light];
    const c = camAt(id, f);
    applyCam(cam, c, f);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);

    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 35);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220);
    this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias;
    this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0;

    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);

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
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.9)));
      this.sunHalo.position.copy(this.sunDisc.position);
      this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(26)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.35);
    }

    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
      m.visible = !s.xray;
    }

    // ---- Pose the hero building (site shots only) ----
    const siteShots = id === 1 || id === 2 || id === 3 || (id >= 14 && id <= 17) || id >= 24;
    this.buildingGroup.visible = siteShots;
    if (siteShots) {
      this.buildingGroup.position.set(X_SITE + bs.drift, 0.43 + bs.lift, 0);
      this.buildingGroup.rotation.y = bs.rot;
    }

    // ---- Plan-table model & arrow (shots 4 & 9) ----
    this.planModel.visible = id === 4 || id === 9;
    this.planArrow.visible = id === 9;
    if (id === 9) {
      this.planModel.rotation.y = (Math.PI / 2) * smooth((f - 555) / 70);
      const pop = easeOut((f - 576) / 16);
      this.planArrow.scale.setScalar(Math.max(0.01, pop));
    } else if (id === 4) {
      this.planModel.rotation.y = 0;
    }

    // ---- Office dynamics ----
    this.counter600.visible = id === 5;
    if (id === 5) {
      const pop = easeOut((f - 282) / 26);
      this.counter600.scale.setScalar(Math.max(0.01, pop) * (1 + 0.05 * Math.sin(t * 6)));
    }
    // Desk clock hands spin (shot 10 hero; harmless in other office shots)
    this.clockHands.minute.rotation.z = -t * 2.4;
    this.clockHands.hour.rotation.z = -t * 0.4;
    // Silhouette outside the window slides as the building turns (shots 18-19)
    if (id === 18) this.silhouette.position.x = X_OFFICE + 3.2 + 0.55 * smooth((f - 1140) / 75);
    else if (id === 19) this.silhouette.position.x = X_OFFICE + 3.2 + 0.55 + 0.3 * smooth((f - 1215) / 75);
    else this.silhouette.position.x = X_OFFICE + 3.2;
    // Switchboard lamps blink in overlapping waves (shot 6)
    if (id === 6) {
      this.switchLights.forEach((m, i) => {
        m.visible = ((f >> 2) + i * 3) % 5 < 3;
      });
    }

    // ---- The red X: full in shot 7, wiped away during shot 8 ----
    this.xSign.visible = id === 7 || id === 8;
    if (id === 8) {
      const u = smooth((f - 500) / 42);
      this.xSign.scale.set(Math.max(0.02, 1 - u), 1, 1);
      this.xSign.position.x = X_MEET + 1.6 + u * 1.1;
      this.xSign.visible = u < 0.98;
    } else if (id === 7) {
      this.xSign.scale.set(1, 1, 1);
      this.xSign.position.x = X_MEET + 1.6;
    }

    // ---- Imagination: pipe burst spray (shot 12) & wall cracks (shot 13) ----
    this.waterBurst.visible = id === 12 && f >= 758;
    if (this.waterBurst.visible) {
      this.waterBurst.children.forEach((d, i) => {
        if (d.name === "spray") {
          const sp = 0.8 + 0.25 * Math.sin(t * 22);
          d.scale.set(sp, 1 + 0.15 * Math.sin(t * 17), sp);
          return;
        }
        const u = ((f - 758) / 34 + i * 0.17) % 1;
        const ang = (i / 16) * Math.PI * 2;
        const r = 0.25 + 1.5 * easeOut(u);
        d.position.set(Math.cos(ang) * r * 0.8, 0.35 + 1.6 * u - 1.15 * u * u, Math.sin(ang) * r * 0.45);
        d.rotation.set(u * 4 * (i % 2 ? 1 : -1), u * 3, ang);
      });
    }
    this.crackGroup.visible = id === 13;
    if (id === 13) {
      this.crackSegs.forEach((seg, i) => {
        const u = smooth((f - (818 + i * 4)) / 12);
        seg.scale.set(1, Math.max(0.01, u), 1);
      });
    }

    // ---- Site props: calendar flips (16), ruler marker creeps (17), "18" pops (14), settle glow (25) ----
    this.calendarStand.visible = id === 16;
    if (id === 16) {
      this.calendarPages.forEach((page, i) => {
        const u = smooth((f - (996 + i * 11)) / 10);
        page.rotation.x = -2.45 * u;
        page.visible = u < 0.995 || i === this.calendarPages.length - 1;
      });
    }
    if (id === 17) {
      this.rulerMarker.position.x = -1.55 + 3.1 * smooth((f - 1065) / 75);
    }
    this.counter18.visible = id === 14;
    if (id === 14) {
      const pop = easeOut((f - 876) / 16);
      this.counter18.scale.setScalar(Math.max(0.01, pop));
    }
    this.settleGlow.visible = id === 25;
    if (id === 25) {
      const pulse = 0.8 + 0.3 * Math.sin(t * 9);
      this.settleGlow.scale.set(pulse, 1, 1);
    }

    // ---- Cross-section rig (SHOTS 20-22 ONLY) ----
    const isXray = id >= 20 && id <= 22;
    this.xrayGroup.visible = isXray;
    this.pitLight.visible = isXray;
    if (isXray) {
      // Ghost building inches along as the turn continues below it
      this.xrayGhost.position.x = X_XRAY + 0.14 * Math.sin(t * 0.6);
      // Shot 21: the footing beam glides over the rollers
      if (id === 21) this.slideBeam.position.x = X_XRAY - 2.4 - 0.3 + 0.6 * smooth((f - 1350) / 60);
      // Shot 22: the flexible runs stretch with the rotation
      const stretch = id === 22 ? 1 + 0.045 * smooth((f - 1410) / 75) : 1;
      this.flexPipes.scale.set(stretch, 1, 1);
      this.flexPipes.position.x = X_XRAY * (stretch - 1) * -1;
      // Shot 20: the three secret markers pop in one by one
      this.xrayMarkers.forEach((g, i) => {
        const pop = easeOut((f - (1298 + i * 14)) / 12);
        g.visible = id === 20 && pop > 0;
        g.scale.setScalar(Math.max(0.01, pop) * (1 + 0.08 * Math.sin(t * 5 + i)));
      });
    }

    // ---- Entrance bridge gently rides with the building (shot 23) ----
    if (id === 23) {
      this.doorBridge.position.y = 0.02 * Math.sin(t * 2.1);
      this.doorBridge.position.z = 0.05 * Math.sin(t * 0.8);
    }

    // ---- New HQ rises for the golden finale (shot 26) ----
    this.hqGroup.visible = id === 26;
    if (id === 26) {
      const grow = 0.45 + 0.55 * smooth((f - 1725) / 46);
      this.hqGroup.scale.set(1, grow, 1);
    }

    // ---- Stage 2D Cast & FX ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, bs, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 4.0))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;

    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h) + 1.0))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else {
        e2.mesh.quaternion.copy(cam.quaternion);
        e2.mesh.rotateZ(p.rot ?? 0);
      }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;

    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();

    return focus;
  }
}
