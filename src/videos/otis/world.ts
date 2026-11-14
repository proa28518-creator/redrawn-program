// Complete 3D scene for "Otis" (1854 NY Crystal Palace & Manhattan skyline).
// Pure function of (id, f): World.update(id, f, cam, scene) poses all dynamic props,
// lights, sky, fog, X-ray cutaway rig (ONLY in shots 23-29), 3D numbers/price tags, and 2D cast.

import * as THREE from "three";
import {
  Batch, V, lam, ub, buildOtisSets, addDollar3D, addDigit3D, Kit, Ray,
} from "./build";
import { ctex, grassHD, cloudHD, planksHD, stoneHD, brick, rep } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, D0, SHOTS, camAt, bridgeState, smooth, clamp01, easeOut, ShotDef, V3,
  X_PALACE, X_STREET, X_SHOP, X_XRAY, X_BELT, X_CITY,
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

  // Dynamic Zone 1: Crystal Palace Platform, Hoist Rope, Recoil Ends, Rim-Lit Axe & God Rays
  private platform = new THREE.Group();
  private platClawL = new THREE.Mesh();
  private platClawR = new THREE.Mesh();
  private hoistRopeBot = new THREE.Mesh();
  private hoistRopeTop = new THREE.Mesh();
  private recoilTop = new THREE.Group();
  private recoilBot = new THREE.Group();
  private chopAxe = new THREE.Group();
  private chopFibers = new THREE.Group();
  private godRays = new THREE.Group();

  // Dynamic Zone 2: 1854 Flashback Old Wooden Box & Wreckage (Shots 4-6)
  private oldBox = new THREE.Group();
  private oldRopeTop = new THREE.Mesh();
  private oldRopeBot = new THREE.Mesh();
  private oldBoxWreck = new THREE.Group();

  // Dynamic Zone 4: Small Box Dangling on a Thin Thread (Shot 11)
  private threadPivot = new THREE.Group();

  // Dynamic Zone 5: Dedicated X-Ray / Cross-Section Reveal Rig (Shots 23-29 ONLY)
  private xrayGroup = new THREE.Group();
  private xraySolidCover = new THREE.Mesh();
  private xrayLeaves: THREE.Mesh[] = [];
  private xrayDrawbar = new THREE.Mesh();
  private xrayRopeTop = new THREE.Mesh();
  private xrayRopeBot = new THREE.Mesh();
  private xrayClawL = new THREE.Group();
  private xrayClawR = new THREE.Group();
  private xrayArrowsUp = new THREE.Group();
  private xrayGapGlow = new THREE.Group();
  private xraySnapRing = new THREE.Group();
  private xrayArrowsOut = new THREE.Group();
  private xrayLockGlow = new THREE.Group();

  // Dynamic Zone 6: Clean 3D Seatbelt Lock & Ratchet Prop (Shot 30)
  private beltGroup = new THREE.Group();
  private beltTongue = new THREE.Group();
  private beltWheel = new THREE.Group();
  private beltPawl = new THREE.Group();
  private beltClickGlow = new THREE.Group();

  // Dynamic Zone 7: Rising High-Rise Floors, 3D Price Tag Props & Manhattan Skyscrapers (Shots 31-34)
  private cityHeroFloors: THREE.Group[] = [];
  private priceTags3D: THREE.Group[] = [];
  private skyscrapers: { grp: THREE.Group; fullH: number; idx: number }[] = [];

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

    // Ground plane
    const gb = new Batch();
    gb.add(quadUp(-900, 900, -900, 900, 450, 450, -0.05), lam("grassHD", () => ({ map: grassHD() })));
    gb.build(R, false);

    // Static architecture across all 7 zones
    buildOtisSets(R, kit, []);

    // Build Dynamic Groups
    this.buildCrystalPalaceDynamics(R);
    this.buildFlashbackHoistDynamics(R);
    this.buildThreadBoxDynamics(R);
    this.buildXrayRevealRig(R);
    this.buildSeatbeltProp(R);
    this.buildCitySkylineDynamics(R);
  }

  // ---------------- 1. Crystal Palace Platform, Rope, Axe & God Rays ----------------
  private buildCrystalPalaceDynamics(R: THREE.Object3D) {
    const wood = lam("oWood", () => ({ map: planksHD(), color: "#c9935b" }));
    const timber = lam("oTimber", () => ({ color: "#8a5e3b" }));
    const iron = lam("oIron", () => ({ color: "#343a46" }));
    const gold = lam("oGold", () => ({ color: "#e5b842" }));
    const ropeMat = lam("oRope", () => ({ color: "#c2a370" }));
    const bladeRimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.6) }); // HDR rim light on axe blade!

    // Platform deck & frame
    const pb = new Batch();
    const id = new THREE.Matrix4();
    ub(pb, wood, id, -1.45, 1.45, -0.12, 0.14, -1.05, 1.05);
    ub(pb, timber, id, -1.52, 1.52, -0.16, 0.02, -1.10, -0.98);
    ub(pb, timber, id, -1.52, 1.52, -0.16, 0.02, 0.98, 1.10);
    // Side upright stiles
    for (const sx of [-1.45, 1.45]) {
      ub(pb, timber, id, sx - 0.08, sx + 0.08, 0.14, 2.55, -0.12, 0.12);
      // Diagonal side knee braces
      ub(pb, iron, id, sx - 0.05, sx + 0.05, 0.14, 0.95, -0.65, -0.52);
    }
    // Overhead crosshead roof beam housing the brake
    ub(pb, timber, id, -1.55, 1.55, 2.35, 2.60, -0.22, 0.22);
    // Visible leaf spring & shackle at top of crosshead
    ub(pb, iron, id, -1.15, 1.15, 2.24, 2.35, -0.12, 0.12);
    ub(pb, gold, id, -0.14, 0.14, 2.32, 2.75, -0.14, 0.14);
    // Freight crate & barrel props on rear corners of platform (keeping Otis in center clear)
    ub(pb, timber, id, -1.28, -0.68, 0.14, 0.72, -0.92, -0.32);
    pb.add(new THREE.CylinderGeometry(0.26, 0.28, 0.68, 12).translate(1.02, 0.48, -0.62), timber);
    pb.build(this.platform);

    // Dynamic left/right iron brake claws on platform crosshead
    const clawGeo = new THREE.BoxGeometry(0.36, 0.14, 0.18);
    this.platClawL = new THREE.Mesh(clawGeo, iron);
    this.platClawR = new THREE.Mesh(clawGeo, iron);
    this.platClawL.position.set(-1.42, 2.32, 0);
    this.platClawR.position.set(1.42, 2.32, 0);
    this.platform.add(this.platClawL, this.platClawR);
    R.add(this.platform);

    // Hoist Rope (split at y = 14.85m chopping block)
    const rGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 10);
    this.hoistRopeBot = new THREE.Mesh(rGeo, ropeMat);
    this.hoistRopeTop = new THREE.Mesh(rGeo, ropeMat);
    R.add(this.hoistRopeBot, this.hoistRopeTop);

    // Severed recoiling rope ends (for Shots 16 & 17)
    for (let i = 0; i < 5; i++) {
      const segT = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.22, 8), ropeMat);
      const segB = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.22, 8), ropeMat);
      this.recoilTop.add(segT);
      this.recoilBot.add(segB);
    }
    R.add(this.recoilTop, this.recoilBot);

    // 3D Axe with Rim-Lit Steel Blade (for Shots 1, 3, 14, 15, 16)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 1.05, 10), timber);
    handle.position.set(0.42, 0, 0);
    handle.rotation.z = Math.PI / 2;
    const headBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.07), iron);
    headBody.position.set(-0.02, -0.10, 0);
    // Gleaming rim-lit bevel edge on the blade
    const headEdge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.08), bladeRimMat);
    headEdge.position.set(-0.02, -0.26, 0);
    this.chopAxe.add(handle, headBody, headEdge);
    this.chopAxe.position.set(0.55, 14.92, 0.06);
    R.add(this.chopAxe);

    // Flying hemp fibers on rope chop (Shot 16)
    for (let i = 0; i < 10; i++) {
      const fib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), ropeMat);
      this.chopFibers.add(fib);
    }
    this.chopFibers.position.set(0, 14.85, 0.1);
    R.add(this.chopFibers);

    // Crystal Palace God Rays sunbeam shafts (Shot 12)
    const rayMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.4, 1.25, 0.85),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    for (const [rx, ry, rz, sx] of [[-5.5, 11.5, -2.5, 2.2], [0, 12.0, -1.5, 2.8], [5.5, 11.5, -2.5, 2.2]]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.45, sx * 1.35, 18.0, 14, 1, true), rayMat);
      cone.position.set(rx, ry, rz);
      cone.rotation.z = -0.26;
      cone.layers.set(NOINK);
      this.godRays.add(cone);
    }
    R.add(this.godRays);
  }

  // ---------------- 2. Flashback Old Wooden Box Hoist (Shots 4-6) ----------------
  private buildFlashbackHoistDynamics(R: THREE.Object3D) {
    const wood = lam("oWood", () => ({ map: planksHD(), color: "#b57e46" }));
    const timberDark = lam("oTimberDark", () => ({ color: "#5e3e24" }));
    const ropeMat = lam("oRope", () => ({ color: "#c2a370" }));

    const bb = new Batch();
    const id = new THREE.Matrix4();
    // Open-front rickety wooden box
    ub(bb, wood, id, -1.1, 1.1, 0, 0.16, -0.85, 0.85); // floor
    ub(bb, wood, id, -1.1, 1.1, 2.25, 2.42, -0.85, 0.85); // roof
    ub(bb, wood, id, -1.1, -0.95, 0.16, 2.25, -0.85, 0.85); // left wall
    ub(bb, wood, id, 0.95, 1.1, 0.16, 2.25, -0.85, 0.85); // right wall
    ub(bb, timberDark, id, -1.1, 1.1, 0.16, 2.25, -0.85, -0.72); // back wall
    bb.build(this.oldBox);
    this.oldBox.position.set(X_STREET, 8.2, 0);
    R.add(this.oldBox);

    const rGeo = new THREE.CylinderGeometry(0.048, 0.048, 1, 8);
    this.oldRopeTop = new THREE.Mesh(rGeo, ropeMat);
    this.oldRopeBot = new THREE.Mesh(rGeo, ropeMat);
    R.add(this.oldRopeTop, this.oldRopeBot);

    // Wrecked box pile at bottom of shaft for Shot 6
    const wb = new Batch();
    ub(wb, wood, id, -1.45, 1.45, 0, 0.18, -1.1, 1.1);
    for (const [x, y, z, rz, rx] of [
      [-0.8, 0.35, 0.2, 0.45, 0.2],
      [0.85, 0.42, 0.15, -0.52, -0.15],
      [0.0, 0.58, -0.2, 0.18, 0.35],
      [-0.4, 0.72, 0.35, -0.38, -0.28],
      [0.5, 0.25, 0.65, 0.82, 0.1],
    ]) {
      const m = new THREE.Matrix4()
        .makeTranslation(x, y, z)
        .multiply(new THREE.Matrix4().makeRotationZ(rz))
        .multiply(new THREE.Matrix4().makeRotationX(rx));
      ub(wb, x < 0 ? wood : timberDark, m, -0.95, 0.95, -0.08, 0.08, -0.45, 0.45);
    }
    wb.build(this.oldBoxWreck);
    this.oldBoxWreck.position.set(X_STREET, 0.05, 0);
    R.add(this.oldBoxWreck);
  }

  // ---------------- 3. Small Box on a Thin Thread (Shot 11) ----------------
  private buildThreadBoxDynamics(R: THREE.Object3D) {
    const wood = lam("oWood", () => ({ map: planksHD(), color: "#c9935b" }));
    const timber = lam("oTimber", () => ({ color: "#8a5e3b" }));
    const threadMat = new THREE.MeshBasicMaterial({ color: "#f5efe0" });

    // Thin thread hanging from pivot (0, 0, 0) down to y = -2.1m
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.1, 8), threadMat);
    thread.position.set(0, -1.05, 0);
    this.threadPivot.add(thread);

    const tb = new Batch();
    const id = new THREE.Matrix4();
    ub(tb, wood, id, -0.58, 0.58, -2.95, -2.82, -0.48, 0.48); // floor
    ub(tb, wood, id, -0.58, 0.58, -2.18, -2.05, -0.48, 0.48); // roof
    ub(tb, timber, id, -0.58, -0.48, -2.82, -2.18, -0.48, 0.48); // left
    ub(tb, timber, id, 0.48, 0.58, -2.82, -2.18, -0.48, 0.48); // right
    ub(tb, timber, id, -0.58, 0.58, -2.82, -2.18, -0.48, -0.38); // back
    tb.build(this.threadPivot);

    this.threadPivot.position.set(X_SHOP + 28, 8.25, 0);
    R.add(this.threadPivot);
  }

  // ---------------- 4. Dedicated X-Ray / Cross-Section Reveal Rig (Shots 23-29 ONLY) ----------------
  private buildXrayRevealRig(R: THREE.Object3D) {
    this.xrayGroup.position.set(X_XRAY, 8.0, 0);

    // Translucent cyan cutaway shell of the platform roof crosshead
    const ghostMat = new THREE.MeshBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const wireMat = new THREE.MeshBasicMaterial({ color: "#7dd3fc" });
    const timberSolidMat = lam("oTimber", () => ({ color: "#8a5e3b" }));
    const steelSpringMat = twoTone(new THREE.MeshLambertMaterial({ color: "#93c5fd" }));
    const clawMat = twoTone(new THREE.MeshLambertMaterial({ color: "#e2e8f0" }));
    const brassMat = twoTone(new THREE.MeshLambertMaterial({ color: "#fbbf24" }));
    const ropeMat = twoTone(new THREE.MeshLambertMaterial({ color: "#fcd34d" }));
    const greenGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 0.9) });
    const orangeGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.2) });
    const redGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.4, 0.3) });

    // Translucent crosshead box + glowing cyan edge bars
    const ghostBox = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 0.68), ghostMat);
    ghostBox.layers.set(NOINK);
    this.xrayGroup.add(ghostBox);

    const wb = new Batch();
    const id = new THREE.Matrix4();
    for (const sy of [-0.36, 0.36]) {
      for (const sz of [-0.34, 0.34]) {
        ub(wb, wireMat, id, -1.7, 1.7, sy - 0.02, sy + 0.02, sz - 0.02, sz + 0.02);
      }
    }
    for (const sx of [-1.7, 1.7]) {
      for (const sz of [-0.34, 0.34]) {
        ub(wb, wireMat, id, sx - 0.02, sx + 0.02, -0.36, 0.36, sz - 0.02, sz + 0.02);
      }
    }
    wb.build(this.xrayGroup, false);

    // Solid timber front cover that slides/fades away during Shot 23 transition
    this.xraySolidCover = new THREE.Mesh(new THREE.BoxGeometry(3.44, 0.76, 0.72), timberSolidMat);
    this.xrayGroup.add(this.xraySolidCover);

    // Multi-Leaf Steel Wagon Spring (5 stacked arched leaves)
    const leafWidths = [2.45, 2.10, 1.72, 1.32, 0.90];
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafWidths[i], 0.055, 0.28), steelSpringMat);
      this.xrayLeaves.push(leaf);
      this.xrayGroup.add(leaf);
    }

    // Central Drawbar Rod & Brass Shackle
    this.xrayDrawbar = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.85, 12), brassMat);
    this.xrayGroup.add(this.xrayDrawbar);

    // Hoist Rope above drawbar (splits in Shot 27)
    this.xrayRopeBot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.65, 12), ropeMat);
    this.xrayRopeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 12), ropeMat);
    this.xrayGroup.add(this.xrayRopeBot, this.xrayRopeTop);

    // Left & Right Pivoting Claw / Pawl Bars
    const buildClawArm = (dir: number) => {
      const g = new THREE.Group();
      const cb = new Batch();
      // Main heavy steel lever bar from center to ratchet rail
      ub(cb, clawMat, id, 0, dir * 1.48, -0.08, 0.08, -0.14, 0.14);
      // Hooked ratchet tooth dog at the outer tip
      ub(cb, brassMat, id, dir * 1.32, dir * 1.66, -0.18, 0.09, -0.16, 0.16);
      cb.build(g);
      // Pivot pin cylinder
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 12).rotateX(Math.PI / 2), brassMat);
      pin.position.set(dir * 0.95, -0.02, 0);
      g.add(pin);
      return g;
    };
    this.xrayClawL = buildClawArm(-1);
    this.xrayClawR = buildClawArm(1);
    this.xrayGroup.add(this.xrayClawL, this.xrayClawR);

    // Helper to build a 3D Arrow (stem + chevron head from boxes)
    const addArrow3D = (b: Batch, mat: THREE.Material, cx: number, cy: number, cz: number, rotZ: number, sc = 1) => {
      const m = new THREE.Matrix4().makeTranslation(cx, cy, cz).multiply(new THREE.Matrix4().makeRotationZ(rotZ));
      ub(b, mat, m, -0.045 * sc, 0.045 * sc, -0.26 * sc, 0.12 * sc, -0.04 * sc, 0.04 * sc);
      const mL = m.clone().multiply(new THREE.Matrix4().makeTranslation(-0.07 * sc, 0.14 * sc, 0)).multiply(new THREE.Matrix4().makeRotationZ(-0.65));
      const mR = m.clone().multiply(new THREE.Matrix4().makeTranslation(0.07 * sc, 0.14 * sc, 0)).multiply(new THREE.Matrix4().makeRotationZ(0.65));
      ub(b, mat, mL, -0.04 * sc, 0.04 * sc, -0.12 * sc, 0.12 * sc, -0.045 * sc, 0.045 * sc);
      ub(b, mat, mR, -0.04 * sc, 0.04 * sc, -0.12 * sc, 0.12 * sc, -0.045 * sc, 0.045 * sc);
    };

    // Shot 24 & 25: Glowing Green Upward Tension Arrows
    const abUp = new Batch();
    addArrow3D(abUp, greenGlow, -0.42, 0.58, 0.38, 0, 1.0);
    addArrow3D(abUp, greenGlow, 0.42, 0.58, 0.38, 0, 1.0);
    addArrow3D(abUp, greenGlow, 0.0, 0.95, 0.38, 0, 1.15);
    abUp.build(this.xrayArrowsUp, false);
    this.xrayGroup.add(this.xrayArrowsUp);

    // Shot 26: Glowing Green Clearance Gap Marker between Right Claw (x = +1.48) and Ratchet Rail (x = +1.82)
    const gbGap = new Batch();
    ub(gbGap, greenGlow, id, 1.48, 1.78, -0.32, 0.24, 0.22, 0.28);
    ub(gbGap, greenGlow, id, -1.78, -1.48, -0.32, 0.24, 0.22, 0.28);
    gbGap.build(this.xrayGapGlow, false);
    this.xrayGroup.add(this.xrayGapGlow);

    // Shot 27: Red/Orange Rope Snap Ring & Fibers at y = +1.05
    const sbSnap = new Batch();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const m = new THREE.Matrix4()
        .makeTranslation(Math.cos(ang) * 0.28, 1.05 + Math.sin(ang) * 0.28, 0.25)
        .multiply(new THREE.Matrix4().makeRotationZ(ang));
      ub(sbSnap, redGlow, m, -0.14, 0.14, -0.035, 0.035, -0.035, 0.035);
    }
    sbSnap.build(this.xraySnapRing, false);
    this.xrayGroup.add(this.xraySnapRing);

    // Shot 28: Orange/Gold Spring Release & Outward Claw Arrows
    const abOut = new Batch();
    addArrow3D(abOut, orangeGlow, 0, 0.32, 0.38, Math.PI, 1.05); // Spring pushing DOWN
    addArrow3D(abOut, orangeGlow, -0.95, -0.26, 0.38, Math.PI / 2, 1.0); // Left claw pushing LEFT
    addArrow3D(abOut, orangeGlow, 0.95, -0.26, 0.38, -Math.PI / 2, 1.0); // Right claw pushing RIGHT
    abOut.build(this.xrayArrowsOut, false);
    this.xrayGroup.add(this.xrayArrowsOut);

    // Shot 29: Golden-Emerald Lock Impact Highlight on the Ratchet Teeth (x = ±1.78)
    const lbLock = new Batch();
    for (const sx of [-1, 1]) {
      ub(lbLock, greenGlow, id, sx * 1.55, sx * 1.92, -0.28, 0.16, -0.22, 0.26);
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const m = new THREE.Matrix4()
          .makeTranslation(sx * 1.75 + Math.cos(ang) * 0.26, -0.06 + Math.sin(ang) * 0.26, 0.28)
          .multiply(new THREE.Matrix4().makeRotationZ(ang));
        ub(lbLock, orangeGlow, m, -0.14, 0.14, -0.03, 0.03, -0.03, 0.03);
      }
    }
    lbLock.build(this.xrayLockGlow, false);
    this.xrayGroup.add(this.xrayLockGlow);

    R.add(this.xrayGroup);
  }

  // ---------------- 5. Clean 3D Seatbelt Buckle & Inertia Ratchet Prop (Shot 30) ----------------
  private buildSeatbeltProp(R: THREE.Object3D) {
    this.beltGroup.position.set(X_BELT, 2.5, 0);
    const id = new THREE.Matrix4();
    const darkCasing = lam("beltDark", () => ({ color: "#252932" }));
    const redBtn = lam("beltRed", () => ({ color: "#d93438" }));
    const chrome = lam("beltChrome", () => ({ color: "#d8e0ea" }));
    const strapMat = lam("beltStrap", () => ({ color: "#344663" }));
    const goldMat = lam("oGold", () => ({ color: "#e5b842" }));
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 0.6) });

    // Left: 3D Seatbelt Buckle Receiver Housing (at x = -0.65)
    const bb = new Batch();
    ub(bb, darkCasing, id, -1.15, -0.15, -0.95, 0.25, -0.22, 0.22);
    // Red release button on top of buckle
    ub(bb, redBtn, id, -0.95, -0.35, -0.05, 0.22, 0.12, 0.26);
    // Lower anchor strap
    ub(bb, strapMat, id, -0.92, -0.38, -1.85, -0.95, -0.08, 0.08);
    bb.build(this.beltGroup);

    // Sliding Metal Tongue Plate + Upper Webbing Strap
    const tb = new Batch();
    ub(tb, chrome, id, -0.90, -0.40, 0.18, 0.85, -0.05, 0.05);
    ub(tb, darkCasing, id, -0.78, -0.52, 0.32, 0.56, -0.06, 0.06); // Latch cutout slot
    ub(tb, chrome, id, -1.02, -0.28, 0.78, 1.02, -0.08, 0.08); // Shoulder bar
    ub(tb, strapMat, id, -0.96, -0.34, 0.98, 2.25, -0.05, 0.05); // Upper webbing strap
    tb.build(this.beltTongue);
    this.beltGroup.add(this.beltTongue);

    // Right: 3D Inertia Ratchet Gear Wheel & Locking Pawl (at x = +0.72, y = 0)
    const wb = new Batch();
    wb.add(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 24).rotateX(Math.PI / 2), chrome);
    wb.add(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16).rotateX(Math.PI / 2), goldMat);
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12;
      const m = new THREE.Matrix4()
        .makeTranslation(Math.cos(ang) * 0.66, Math.sin(ang) * 0.66, 0)
        .multiply(new THREE.Matrix4().makeRotationZ(ang + 0.25));
      ub(wb, chrome, m, -0.09, 0.09, -0.09, 0.09, -0.10, 0.10);
    }
    wb.build(this.beltWheel);
    this.beltWheel.position.set(0.72, -0.05, 0);
    this.beltGroup.add(this.beltWheel);

    // Pivoting Locking Pawl above the ratchet gear
    const pb = new Batch();
    ub(pb, redBtn, id, -0.52, 0.12, -0.08, 0.08, -0.12, 0.12);
    ub(pb, goldMat, id, -0.55, -0.35, -0.22, 0.02, -0.13, 0.13);
    pb.build(this.beltPawl);
    this.beltPawl.position.set(1.18, 0.58, 0);
    this.beltGroup.add(this.beltPawl);

    // Click burst rays when buckle & pawl lock
    const cb = new Batch();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const m = new THREE.Matrix4()
        .makeTranslation(-0.65 + Math.cos(ang) * 0.42, 0.22 + Math.sin(ang) * 0.42, 0.28)
        .multiply(new THREE.Matrix4().makeRotationZ(ang));
      ub(cb, glowMat, m, -0.14, 0.14, -0.03, 0.03, -0.03, 0.03);
    }
    cb.build(this.beltClickGlow, false);
    this.beltGroup.add(this.beltClickGlow);

    R.add(this.beltGroup);
  }

  // ---------------- 6. Rising High-Rise, 3D Price Tags & Skyscraper Skyline (Shots 31-34) ----------------
  private buildCitySkylineDynamics(R: THREE.Object3D) {
    const id = new THREE.Matrix4();
    const stone = lam("oStone", () => ({ map: stoneHD("oStoneHD") }));
    const brickMat = lam("oBrick", () => ({ map: rep(brick(), 2, 1) }));
    const cream = lam("oCream", () => ({ color: "#efe4ce" }));
    const gold = lam("oGold", () => ({ color: "#e5b842" }));
    const plaqueDark = lam("oPlaqueDark", () => ({ color: "#1e2638" }));
    const plaqueCrimson = lam("oBannerRed", () => ({ color: "#a82830" }));
    const winLit = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.18, 0.62) });

    // Hero Rising High-Rise Building at (X_CITY, 0, 0) — 8 stacked floors (Shots 31 & 32)
    for (let fl = 0; fl < 8; fl++) {
      const grp = new THREE.Group();
      const fb = new Batch();
      const h = 2.8;
      ub(fb, fl % 2 === 0 ? brickMat : stone, id, -2.6, 2.6, 0, h - 0.22, -2.2, 2.2);
      ub(fb, cream, id, -2.75, 2.75, h - 0.22, h, -2.35, 2.35); // Cornice ledge
      // Windows across front facade
      for (const wx of [-1.6, 0, 1.6]) {
        ub(fb, cream, id, wx - 0.42, wx + 0.42, 0.45, 2.15, 2.18, 2.26);
        ub(fb, winLit, id, wx - 0.34, wx + 0.34, 0.55, 2.05, 2.22, 2.28);
      }
      // 3D Floor Number on left pier (1..8)
      if (fl < 6) {
        addDigit3D(fb, String(fl + 1), -2.15, 1.35, 2.32, 0.42, 0.65, 0.12, gold);
      }
      fb.build(grp);
      grp.position.set(X_CITY, fl * h, 0);
      this.cityHeroFloors.push(grp);
      R.add(grp);
    }

    // 4 Floating 3D Price Tag Props alongside the rising floors (Shot 32: $ -> $$ -> $$$ -> $$$$)
    const tagHeights = [5.2, 10.4, 15.6, 20.6];
    for (let k = 0; k < 4; k++) {
      const count = k + 1;
      const sc = 0.85 + k * 0.14;
      const tGrp = new THREE.Group();
      const tb = new Batch();
      const gap = 0.54 * sc;
      const totalW = count * gap + 0.48 * sc;
      const ph = 1.02 * sc;
      ub(tb, gold, id, -totalW / 2 - 0.07 * sc, totalW / 2 + 0.07 * sc, -ph / 2 - 0.07 * sc, ph / 2 + 0.07 * sc, -0.08, 0.08);
      ub(tb, k === 3 ? plaqueCrimson : plaqueDark, id, -totalW / 2, totalW / 2, -ph / 2, ph / 2, -0.06, 0.10);
      for (let i = 0; i < count; i++) {
        const dx = (i - (count - 1) / 2) * gap;
        addDollar3D(tb, dx, 0, 0.14, 0.44 * sc, 0.66 * sc, 0.16 * sc, gold);
      }
      tb.build(tGrp);
      tGrp.position.set(X_CITY + 4.2, tagHeights[k], 1.2);
      this.priceTags3D.push(tGrp);
      R.add(tGrp);
    }

    // 14 Manhattan Skyscrapers around X_CITY for Shots 33 & 34
    const towerSpecs: [number, number, number, number, number][] = [
      [-16, -8, 4.8, 26, 0],
      [-10, -12, 5.2, 34, 1],
      [-4, -14, 5.6, 42, 2],
      [4, -14, 5.4, 38, 3],
      [11, -11, 5.0, 31, 4],
      [17, -7, 4.6, 25, 5],
      [-21, -16, 5.5, 29, 6],
      [-13, -22, 6.0, 44, 7],
      [-5, -24, 6.4, 52, 8],
      [3, -23, 6.2, 48, 9],
      [12, -20, 5.8, 39, 10],
      [20, -15, 5.2, 30, 11],
      [-7, -5, 4.2, 20, 12],
      [8, -5, 4.2, 22, 13],
    ];
    const towerCols = ["#7a889b", "#c29b78", "#8e7f74", "#66788c", "#b58969"];
    towerSpecs.forEach(([dx, dz, w, h, idx]) => {
      const grp = new THREE.Group();
      const sb = new Batch();
      const tMat = lam(`skyT_${idx % 5}`, () => ({ color: towerCols[idx % 5] }));
      const hw = w / 2;
      // Main shaft
      ub(sb, tMat, id, -hw, hw, 0, h * 0.72, -hw, hw);
      // Setback upper tier
      ub(sb, tMat, id, -hw * 0.72, hw * 0.72, h * 0.72, h * 0.92, -hw * 0.72, hw * 0.72);
      // Crown & spire
      ub(sb, cream, id, -hw * 0.45, hw * 0.45, h * 0.92, h, -hw * 0.45, hw * 0.45);
      sb.add(new THREE.CylinderGeometry(0.06, 0.18, h * 0.18, 8).translate(0, h + h * 0.09, 0), gold);
      // Lit window bands up the tower
      for (let wy = 2.5; wy < h * 0.88; wy += 2.6) {
        const tierW = wy < h * 0.72 ? hw : hw * 0.72;
        for (const s of [-0.55, 0, 0.55]) {
          ub(sb, winLit, id, s * tierW - 0.32, s * tierW + 0.32, wy, wy + 1.35, tierW - 0.02, tierW + 0.05);
        }
      }
      sb.build(grp);
      grp.position.set(X_CITY + dx, 0, dz);
      this.skyscrapers.push({ grp, fullH: h, idx });
      R.add(grp);
    });
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
    const t = f / FPS, s = SHOTS[id - 1] ?? SHOTS[0], b = bridgeState(id, t), L = LIGHTS[s.light];
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

    // ---- Pose Zone 1: Crystal Palace Platform, Rope, Recoil, Axe & God Rays ----
    this.platform.position.set(X_PALACE, b.platY, 0);
    this.platClawL.position.x = -1.42 - 0.22 * b.clawsOut;
    this.platClawR.position.x = 1.42 + 0.22 * b.clawsOut;
    this.godRays.visible = id === 12 || id === 13;

    const shackleY = b.platY + 2.68;
    const cutY = 14.85;
    const pulleyY = 16.15;
    if (!b.ropeCut) {
      this.hoistRopeBot.visible = true;
      this.hoistRopeTop.visible = true;
      this.recoilTop.visible = false;
      this.recoilBot.visible = false;
      const lenBot = Math.max(0.1, cutY - shackleY);
      this.hoistRopeBot.position.set(0, shackleY + lenBot / 2, 0);
      this.hoistRopeBot.scale.set(1, lenBot, 1);
      const lenTop = Math.max(0.1, pulleyY - cutY);
      this.hoistRopeTop.position.set(0, cutY + lenTop / 2, 0);
      this.hoistRopeTop.scale.set(1, lenTop, 1);
    } else {
      // Rope severed (Shots 16..22)!
      const recoilU = clamp01((f - 756) / 48);
      this.hoistRopeBot.visible = false;
      this.hoistRopeTop.visible = false;
      this.recoilTop.visible = id === 16 || id === 17;
      this.recoilBot.visible = id === 16 || id === 17;
      this.recoilTop.children.forEach((seg, i) => {
        const u = recoilU * (1 + i * 0.25);
        seg.position.set(-0.08 * u * (i + 1), cutY + 0.12 + i * 0.2 + 0.35 * recoilU, 0.05 * Math.sin(i + u * 4));
        seg.rotation.z = 0.25 * (i + 1) * recoilU;
      });
      this.recoilBot.children.forEach((seg, i) => {
        const u = recoilU * (1 + i * 0.25);
        seg.position.set(0.08 * u * (i + 1), cutY - 0.12 - i * 0.2 - 0.35 * recoilU, -0.05 * Math.sin(i + u * 4));
        seg.rotation.z = -0.25 * (i + 1) * recoilU;
      });
    }

    // 3D Axe pose (Shots 1, 3, 14, 15, 16, 17)
    this.chopAxe.visible = id === 1 || id === 3 || id === 14 || id === 15 || id === 16 || id === 17;
    if (id === 15) {
      // Swinging down onto the rope!
      const u = smooth((f - 729) / 27);
      this.chopAxe.rotation.z = 0.72 * (1 - u);
      this.chopAxe.position.set(0.45 - 0.38 * u, 15.15 - 0.30 * u, 0.06);
    } else if (id === 16 || id === 17) {
      this.chopAxe.rotation.z = -0.05;
      this.chopAxe.position.set(0.05, 14.82, 0.06);
    } else {
      // Raised high above rope with rim light gleaming on the blade
      this.chopAxe.rotation.z = 0.68 + 0.05 * Math.sin(t * 4);
      this.chopAxe.position.set(0.48, 15.18, 0.06);
    }

    // Flying hemp fibers in Shot 16
    this.chopFibers.visible = id === 16 || id === 17;
    if (this.chopFibers.visible) {
      const fu = clamp01((f - 756) / 36);
      this.chopFibers.children.forEach((fib, i) => {
        const ang = (i / 10) * Math.PI * 2 + 0.3;
        const r = 0.12 + 0.85 * easeOut(fu);
        fib.position.set(Math.cos(ang) * r, Math.sin(ang) * r - 0.25 * fu * fu, (i % 3 - 1) * 0.15 * fu);
        fib.rotation.set(fu * 3 * (i % 2 ? 1 : -1), fu * 2, ang + fu * 4);
      });
    }

    // ---- Pose Zone 2: 1854 Flashback Old Hoist Box & Crash (Shots 4-6) ----
    if (id === 4) {
      this.oldBox.visible = true;
      this.oldBoxWreck.visible = false;
      const sway = 0.07 * Math.sin(t * 6.5);
      this.oldBox.position.set(X_STREET + sway * 1.2, 8.2, 0);
      this.oldBox.rotation.z = sway;
      this.oldRopeTop.visible = true;
      this.oldRopeBot.visible = false;
      this.oldRopeTop.position.set(X_STREET + sway * 0.6, 12.4, 0);
      this.oldRopeTop.scale.set(1, 3.8, 1);
    } else if (id === 5) {
      this.oldBox.visible = true;
      this.oldBoxWreck.visible = false;
      const snapU = clamp01((f - 222) / 38);
      const boxY = 8.2 - 5.8 * snapU * snapU;
      this.oldBox.position.set(X_STREET, boxY, 0);
      this.oldBox.rotation.z = -0.06 * snapU;
      this.oldRopeTop.visible = true;
      this.oldRopeBot.visible = true;
      this.oldRopeTop.position.set(X_STREET - 0.08 * snapU, 12.7 + 0.4 * snapU, 0);
      this.oldRopeTop.scale.set(1, 2.6, 1);
      this.oldRopeTop.rotation.z = 0.22 * snapU;
      this.oldRopeBot.position.set(X_STREET + 0.06 * snapU, boxY + 2.65, 0);
      this.oldRopeBot.scale.set(1, 0.55, 1);
      this.oldRopeBot.rotation.z = -0.25 * snapU;
    } else if (id === 6) {
      this.oldBox.visible = false;
      this.oldRopeTop.visible = false;
      this.oldRopeBot.visible = false;
      this.oldBoxWreck.visible = true;
    } else {
      this.oldBox.visible = false;
      this.oldRopeTop.visible = false;
      this.oldRopeBot.visible = false;
      this.oldBoxWreck.visible = false;
    }

    // ---- Pose Zone 4: Small Box on a Thin Thread (Shot 11) ----
    if (id === 11) {
      this.threadPivot.visible = true;
      this.threadPivot.rotation.z = 0.14 * Math.sin(t * 4.2);
    } else {
      this.threadPivot.visible = false;
    }

    // ---- Pose Zone 5: X-Ray / Cross-Section Reveal Rig (ONLY IN SHOTS 23-29, Rule 4!) ----
    const isXray = id >= 23 && id <= 29;
    this.xrayGroup.visible = isXray;
    if (isXray) {
      // Shot 23: Solid timber cover slides upward/fades away to reveal the X-ray interior
      if (id === 23) {
        const u23 = smooth((f - 1120) / 32);
        this.xraySolidCover.visible = u23 < 0.92;
        this.xraySolidCover.position.set(0, u23 * 1.35, 0);
        this.xraySolidCover.scale.set(1, Math.max(0.05, 1 - u23), 1);
      } else {
        this.xraySolidCover.visible = false;
      }

      // Spring arch & claw extension state across Shots 23..29:
      // Shots 23..26: rope intact -> spring flexed UP (+0.24), claws retracted (0)
      // Shot 27: rope snaps at f1332 -> spring starts releasing
      // Shot 28: slow-mo spring flattens & drives claws outward (0 -> 0.88)
      // Shot 29: claws slam into ratchet teeth and lock solid (1.0)
      let springArch = 0.24;
      let clawExt = 0.0;
      let ropeSplit = 0.0;

      if (id === 25) {
        springArch = 0.26 + 0.02 * Math.sin(t * 8);
      } else if (id === 27) {
        ropeSplit = smooth((f - 1330) / 28);
        springArch = 0.24 * (1 - 0.35 * ropeSplit);
      } else if (id === 28) {
        ropeSplit = 1.0;
        const u28 = smooth((f - 1363) / 43);
        springArch = 0.16 * (1 - u28) - 0.04 * u28;
        clawExt = 0.88 * u28;
      } else if (id === 29) {
        ropeSplit = 1.0;
        springArch = -0.05;
        clawExt = 1.0;
      }

      // Pose the 5 stacked steel leaf spring plates
      this.xrayLeaves.forEach((leaf, i) => {
        const frac = 1 - i * 0.14;
        leaf.position.set(0, -0.06 + i * 0.062 + springArch * frac, 0);
      });
      this.xrayDrawbar.position.set(0, 0.22 + springArch, 0);
      this.xrayRopeBot.position.set(0, 0.68 + springArch, 0);
      this.xrayRopeTop.position.set(0.12 * ropeSplit, 1.55 + 0.45 * ropeSplit, 0);
      this.xrayRopeTop.rotation.z = -0.22 * ropeSplit;

      // Pose Left & Right Pivoting Claw Arms
      this.xrayClawL.position.set(-0.08 - 0.26 * clawExt, -0.05 - 0.04 * clawExt, 0);
      this.xrayClawL.rotation.z = 0.14 * (1 - clawExt);
      this.xrayClawR.position.set(0.08 + 0.26 * clawExt, -0.05 - 0.04 * clawExt, 0);
      this.xrayClawR.rotation.z = -0.14 * (1 - clawExt);

      // Indicator overlays per X-ray shot
      this.xrayArrowsUp.visible = id === 24 || id === 25;
      this.xrayGapGlow.visible = id === 26;
      this.xraySnapRing.visible = id === 27 && f >= 1328;
      this.xrayArrowsOut.visible = id === 28;
      this.xrayLockGlow.visible = id === 29;
    }

    // ---- Pose Zone 6: Clean 3D Seatbelt Buckle & Inertia Ratchet Prop (Shot 30) ----
    this.beltGroup.visible = id === 30;
    if (id === 30) {
      const lockU = smooth((f - 1456) / 18);
      // Metal tongue slides down into the buckle receiver and locks
      this.beltTongue.position.set(0, 0.55 * (1 - lockU), 0);
      // Ratchet wheel turns until the locking pawl drops into a tooth
      this.beltWheel.rotation.z = -0.65 * lockU;
      this.beltPawl.rotation.z = -0.28 + 0.34 * lockU;
      this.beltClickGlow.visible = f >= 1470;
    }

    // ---- Pose Zone 7: Rising High-Rise, 3D Price Tags & Skyscraper Skyline (Shots 31-34) ----
    const isCity = id >= 31 && id <= 34;
    this.cityHeroFloors.forEach((grp, fl) => {
      grp.visible = isCity;
      if (!isCity) return;
      if (id === 31) {
        // Floors 2..7 stack/extrude upward sequentially during Shot 31 Fast Tilt Up
        const uFl = fl < 2 ? 1 : smooth((f - (1500 + (fl - 2) * 5.5)) / 12);
        grp.scale.set(1, Math.max(0.01, uFl), 1);
        grp.visible = uFl > 0.02;
      } else {
        grp.scale.set(1, 1, 1);
      }
    });

    this.priceTags3D.forEach((tGrp, k) => {
      tGrp.visible = id === 31 || id === 32;
      if (id === 32) {
        const pop = smooth((f - (1546 + k * 5)) / 10);
        const pulse = 1 + 0.08 * Math.sin(t * 7 + k);
        tGrp.scale.setScalar(Math.max(0.01, pop * pulse));
      } else {
        tGrp.scale.setScalar(0.85);
      }
    });

    this.skyscrapers.forEach(({ grp, idx }) => {
      grp.visible = id === 33 || id === 34;
      if (id === 33) {
        // Skyscrapers sprout and grow upward around the city in Shot 33
        const growU = smooth((f - (1579 + (idx % 6) * 3.5)) / 24);
        grp.scale.set(1, 0.25 + 0.75 * growU, 1);
      } else if (id === 34) {
        grp.scale.set(1, 1, 1);
      }
    });

    // ---- Stage 2D Cast & FX ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, b, { pos: cam.position, right });
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
