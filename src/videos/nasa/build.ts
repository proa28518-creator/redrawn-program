// Deterministic geometry helpers, seeded PRNG, cached materials, and module-level singleton
// canvas textures for "NasaOrbiter". ZERO per-frame canvas or texture allocations.
import React, { useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";

export function h<K extends keyof ThreeElements>(
  type: K,
  props: ThreeElements[K] | null,
  ...children: React.ReactNode[]
): React.ReactElement;
export function h<P extends object>(
  type: React.ComponentType<P>,
  props: P | null,
  ...children: React.ReactNode[]
): React.ReactElement;
export function h(
  type: React.ElementType,
  props: Record<string, unknown> | null,
  ...children: React.ReactNode[]
): React.ReactElement {
  return React.createElement(type, props, ...children);
}
import { twoTone } from "../indiana-bell/shade";
import { NOINK } from "../indiana-bell/ink";
import { clamp01, lerpVec3, smoothstep, V3 } from "./story";

export { clamp01, lerpVec3, smoothstep };

// ---------------- Deterministic Seeded PRNG ----------------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- Shared Cached Materials ----------------
const MAT_CACHE = new Map<string, THREE.Material>();

export function toonLam(
  key: string,
  make: () => THREE.MeshLambertMaterialParameters,
  liftK = 1,
): THREE.MeshLambertMaterial {
  let m = MAT_CACHE.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = twoTone(new THREE.MeshLambertMaterial(make()), liftK);
    MAT_CACHE.set(key, m);
  }
  return m;
}

export function basicMat(
  key: string,
  make: () => THREE.MeshBasicMaterialParameters,
): THREE.MeshBasicMaterial {
  let m = MAT_CACHE.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial(make());
    MAT_CACHE.set(key, m);
  }
  return m;
}

// ---------------- Module-Level Singleton Canvas Texture Cache ----------------
export type DiegeticTexId =
  | "weather_big_screen"
  | "cost_board_125m"
  | "cost_board_lost"
  | "calendar_23sep1999"
  | "lockheed_blueprint"
  | "lockheed_whiteboard"
  | "jpl_nav_screen"
  | "lockheed_lbfs"
  | "jpl_ns"
  | "conversion_bars"
  | "split_burn_plot"
  | "flatline_trace"
  | "ecu_datafile_final"
  | "pad_sign_lc17a"
  | "team_sign_lockheed"
  | "team_sign_jpl"
  | "handoff_banner"
  | "gate_226km"
  | "gate_57km"
  | "tag_planned_path"
  | "tag_actual_path"
  | "tag_cruise_95"
  | "plaque_showcase"
  | "sticky_note"
  | "nebula_sky"
  | "dawn_sky"
  | "mars_surface"
  | "kapton_foil"
  | "solar_cells"
  | "jpl_wall"
  | "jpl_floor"
  | "concrete_pad"
  | "office_parquet"
  | "rocket_body"
  | "sun_halo"
  | "hook_telemetry_hud"
  | "hook_warn_badge"
  | "split_left_jpl"
  | "split_right_lockheed"
  | "tag_lbfs_plug"
  | "tag_ns_socket"
  | "tag_1x_cap"
  | "tag_445x_cap";

const TEX_CACHE = new Map<string, THREE.CanvasTexture>();

function makeTex(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, r: () => number) => void,
  repeat = false,
): THREE.CanvasTexture {
  const hit = TEX_CACHE.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  }
  draw(ctx, mulberry32(hash >>> 0));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  TEX_CACHE.set(key, tex);
  return tex;
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

export function getDiegeticTexture(id: DiegeticTexId): THREE.CanvasTexture {
  switch (id) {
    case "weather_big_screen":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#10233a";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(70,180,240,0.14)");
        // Header bar
        g.fillStyle = "#1b446c";
        g.fillRect(0, 0, 1024, 84);
        g.fillStyle = "#8ce4ff";
        g.font = "bold 34px monospace";
        g.fillText("MARS CLIMATE ORBITER", 36, 42);
        g.fillStyle = "#ffd178";
        g.font = "bold 22px monospace";
        g.fillText("FIRST INTERPLANETARY WEATHER SATELLITE | DEC 1998", 36, 72);
        // Mars weather globe in center
        const cx = 360;
        const cy = 295;
        const r = 148;
        const grd = g.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, r);
        grd.addColorStop(0, "#f29d63");
        grd.addColorStop(0.65, "#c45d34");
        grd.addColorStop(1, "#7b2e19");
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fillStyle = grd;
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = "#62d8ff";
        g.stroke();
        // Atmospheric circulation bands
        g.strokeStyle = "#9ef5ff";
        g.lineWidth = 3;
        for (const dy of [-68, -22, 24, 70]) {
          g.beginPath();
          g.ellipse(cx, cy + dy, r * 0.88, 22, 0, 0.2, Math.PI - 0.2);
          g.stroke();
        }
        // Right telemetry card
        g.fillStyle = "rgba(18,46,72,0.85)";
        g.fillRect(560, 125, 420, 340);
        g.strokeStyle = "#38d8c4";
        g.lineWidth = 3;
        g.strokeRect(560, 125, 420, 340);
        g.fillStyle = "#e2f7ff";
        g.font = "bold 26px monospace";
        g.fillText("MISSION PARAMETERS", 585, 175);
        g.fillStyle = "#7cf2c8";
        g.font = "24px monospace";
        g.fillText("LAUNCH   : DEC 1998", 585, 235);
        g.fillText("CRUISE   : 9.5 MONTHS", 585, 285);
        g.fillText("ORBIT    : 226 KM", 585, 335);
        g.fillText("BUDGET   : $125M", 585, 385);
        g.fillStyle = "#ffd178";
        g.fillText("ARRIVAL  : 23 SEP 1999", 585, 435);
      });

    case "cost_board_125m":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#102034";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(100,190,255,0.12)");
        g.strokeStyle = "#48c2ff";
        g.lineWidth = 8;
        g.strokeRect(18, 18, 988, 476);
        g.fillStyle = "#9adfff";
        g.font = "bold 38px monospace";
        g.fillText("MARS CLIMATE ORBITER", 64, 98);
        g.fillStyle = "#ffd86b";
        g.font = "bold 104px monospace";
        g.fillText("COST: $125M", 64, 245);
        g.fillStyle = "#74f2ce";
        g.font = "bold 36px monospace";
        g.fillText("LAUNCH: DEC 1998  |  CRUISE: 9.5 MO", 64, 345);
        g.fillStyle = "#c8e6ff";
        g.font = "bold 30px monospace";
        g.fillText("PLANNED CAPTURE: 226 KM", 64, 420);
      });

    case "cost_board_lost":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0b111c";
        g.fillRect(0, 0, 1024, 512);
        g.strokeStyle = "#ff5e3a";
        g.lineWidth = 10;
        g.strokeRect(20, 20, 984, 472);
        g.fillStyle = "#b8cce0";
        g.font = "bold 38px monospace";
        g.fillText("MARS CLIMATE ORBITER", 64, 102);
        g.fillStyle = "#ffbf5e";
        g.font = "bold 104px monospace";
        g.fillText("ORBITER COST: $125M", 56, 250);
        g.fillStyle = "#ff5a44";
        g.fillRect(56, 315, 912, 118);
        g.fillStyle = "#fff5f0";
        g.font = "bold 46px monospace";
        g.fillText("STATUS: LOST — 23 SEP 1999", 84, 390);
      });

    case "calendar_23sep1999":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#f2ede3";
        g.fillRect(0, 0, 1024, 512);
        g.fillStyle = "#c9382b";
        g.fillRect(0, 0, 1024, 128);
        g.fillStyle = "#ffffff";
        g.font = "bold 54px monospace";
        g.fillText("ORBIT INSERTION DAY", 155, 84);
        g.fillStyle = "#1c2430";
        g.font = "bold 124px monospace";
        g.fillText("23 SEP 1999", 95, 305);
        g.fillStyle = "#2b4d70";
        g.font = "bold 44px monospace";
        g.fillText("SIGNAL ACQUISITION  |  JPL OPS", 115, 425);
        g.strokeStyle = "#222933";
        g.lineWidth = 10;
        g.strokeRect(10, 10, 1004, 492);
      });

    case "lockheed_blueprint":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#164d8c";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 48, "rgba(210,235,255,0.22)");
        g.strokeStyle = "#e8f5ff";
        g.lineWidth = 4;
        g.strokeRect(24, 24, 976, 464);
        // Technical spacecraft schematic
        g.strokeRect(380, 175, 160, 150); // bus
        g.strokeRect(110, 200, 270, 96);  // single solar wing
        g.beginPath();
        g.arc(460, 130, 62, Math.PI, 0);
        g.stroke();
        g.fillStyle = "#e8f5ff";
        g.font = "bold 26px monospace";
        g.fillText("SINGLE SOLAR WING", 115, 185);
        g.fillText("HGA DISH", 400, 58);
        // Title block
        g.fillStyle = "#0e3766";
        g.fillRect(580, 310, 400, 160);
        g.strokeRect(580, 310, 400, 160);
        g.fillStyle = "#ffffff";
        g.font = "bold 26px monospace";
        g.fillText("LOCKHEED MARTIN", 605, 355);
        g.fillStyle = "#ffdf78";
        g.font = "bold 30px monospace";
        g.fillText("IMPULSE SPEC: lbf·s", 605, 405);
        g.fillStyle = "#bfe3ff";
        g.font = "24px monospace";
        g.fillText("LAUNCH: DEC 1998", 605, 448);
      });

    case "lockheed_whiteboard":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#f4f2eb";
        g.fillRect(0, 0, 1024, 512);
        g.strokeStyle = "#8a929e";
        g.lineWidth = 10;
        g.strokeRect(12, 12, 1000, 488);
        g.fillStyle = "#1b365d";
        g.font = "bold 46px monospace";
        g.fillText("LOCKHEED PROPULSION", 64, 96);
        g.fillStyle = "#b8401e";
        g.font = "bold 52px monospace";
        g.fillText("THRUST UNIT: lbf·s", 64, 210);
        g.fillStyle = "#264653";
        g.font = "bold 38px monospace";
        g.fillText("FILE: SM_FORCES.DAT", 64, 315);
        g.fillText("LAUNCH: DEC 1998  |  $125M", 64, 405);
      });

    case "jpl_nav_screen":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0f2238";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(80,220,255,0.16)");
        g.fillStyle = "#163d61";
        g.fillRect(0, 0, 1024, 90);
        g.fillStyle = "#76e5ff";
        g.font = "bold 36px monospace";
        g.fillText("JPL NAVIGATION — TRAJECTORY OPS", 40, 58);
        g.strokeStyle = "#3ef2c8";
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(70, 410);
        g.quadraticCurveTo(460, 210, 920, 160);
        g.stroke();
        g.fillStyle = "#ffdf78";
        g.font = "bold 42px monospace";
        g.fillText("EXPECTED THRUST UNIT: N·s", 44, 465);
      });

    case "lockheed_lbfs":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#1d160c";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(255,188,72,0.10)");
        // Header
        g.fillStyle = "#ffae38";
        g.fillRect(0, 0, 1024, 140);
        g.fillStyle = "#1c1206";
        g.font = "bold 42px monospace";
        g.fillText("LOCKHEED PROPULSION OUTPUT", 54, 64);
        g.font = "bold 32px monospace";
        g.fillText("FILE: SM_FORCES.DAT", 54, 112);

        g.fillStyle = "#ffd99c";
        g.font = "bold 36px monospace";
        g.fillText("THRUSTER IMPULSE BIT :", 54, 270);

        g.fillStyle = "#ffffff";
        g.font = "bold 120px monospace";
        g.fillText("40.90", 60, 455);

        // Highlight box around lbf·s
        g.fillStyle = "#ffb02e";
        g.fillRect(495, 335, 455, 165);
        g.strokeStyle = "#fff1c2";
        g.lineWidth = 6;
        g.strokeRect(495, 335, 455, 165);
        g.fillStyle = "#1a0e00";
        g.font = "bold 104px monospace";
        g.fillText("lbf·s", 548, 452);

        g.fillStyle = "#f2b866";
        g.font = "bold 34px monospace";
        g.fillText("UNIT SYSTEM : ENGLISH", 54, 650);
        g.fillText("(POUND-FORCE · SECOND)", 54, 710);
        g.fillStyle = "#ffe6b3";
        g.font = "28px monospace";
        g.fillText("1 lbf·s = 4.45 N·s", 54, 860);
      });

    case "jpl_ns":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#0b1a2a";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(70,220,255,0.12)");
        // Header
        g.fillStyle = "#32b8e8";
        g.fillRect(0, 0, 1024, 140);
        g.fillStyle = "#06131f";
        g.font = "bold 42px monospace";
        g.fillText("JPL NAVIGATION INGEST", 54, 64);
        g.font = "bold 32px monospace";
        g.fillText("FILE: SM_FORCES.DAT", 54, 112);

        g.fillStyle = "#9ae8ff";
        g.font = "bold 36px monospace";
        g.fillText("PARSED IMPULSE VALUE :", 54, 270);

        g.fillStyle = "#ffffff";
        g.font = "bold 120px monospace";
        g.fillText("40.90", 60, 455);

        // Highlight box around N·s
        g.fillStyle = "#22d3ee";
        g.fillRect(510, 335, 420, 165);
        g.strokeStyle = "#ff5e4a";
        g.lineWidth = 8;
        g.strokeRect(510, 335, 420, 165);
        g.fillStyle = "#041a24";
        g.font = "bold 116px monospace";
        g.fillText("N·s", 605, 455);

        g.fillStyle = "#76e4f7";
        g.font = "bold 34px monospace";
        g.fillText("EXPECTED UNIT : METRIC", 54, 650);
        g.fillText("(NEWTON · SECOND)", 54, 710);
        g.fillStyle = "#ff8570";
        g.font = "bold 32px monospace";
        g.fillText("NO UNIT CONVERSION APPLIED", 54, 860);
      });

    case "conversion_bars":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#111c2d";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(110,190,255,0.14)");
        g.fillStyle = "#1c3554";
        g.fillRect(0, 0, 1024, 130);
        g.fillStyle = "#ffe07d";
        g.font = "bold 46px monospace";
        g.fillText("UNIT CONVERSION FACTOR: × 4.45", 66, 82);
        // Scale lines
        const baseY = 850;
        const step = 128;
        g.font = "bold 28px monospace";
        for (let k = 0; k <= 5; k++) {
          const y = baseY - k * step;
          g.strokeStyle = k === 1 || k === 4 ? "rgba(255,220,120,0.45)" : "rgba(180,220,255,0.22)";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(110, y);
          g.lineTo(960, y);
          g.stroke();
          g.fillStyle = "#9fd4ff";
          g.fillText(`${k}×`, 36, y + 10);
        }
        // Labels under the two 3D bar columns
        g.fillStyle = "#4ce8f5";
        g.font = "bold 34px monospace";
        g.fillText("JPL READ", 180, 920);
        g.fillText("1 N·s", 205, 965);

        g.fillStyle = "#ff8552";
        g.fillText("ACTUAL THRUST", 575, 920);
        g.fillText("1 lbf·s = 4.45 N·s", 525, 965);
      });

    case "split_burn_plot":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0e1d30";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(90,195,255,0.16)");
        g.fillStyle = "#183657";
        g.fillRect(0, 0, 1024, 78);
        g.fillStyle = "#e8f6ff";
        g.font = "bold 34px monospace";
        g.fillText("THRUSTER BURN TELEMETRY — SM_FORCES.DAT", 40, 52);

        g.fillStyle = "#48f0d8";
        g.font = "bold 30px monospace";
        g.fillText("JPL MODELLED BURN (1.0×)", 460, 175);

        g.fillStyle = "#ff7847";
        g.font = "bold 34px monospace";
        g.fillText("REAL THRUST (4.45×)", 460, 420);
      });

    case "flatline_trace":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#10131c";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(255,95,70,0.16)");
        g.fillStyle = "#521614";
        g.fillRect(0, 0, 1024, 88);
        g.fillStyle = "#ff8f7a";
        g.font = "bold 40px monospace";
        g.fillText("CARRIER SIGNAL: LOST — 23 SEP 1999", 54, 58);
        g.fillStyle = "#cbd5e1";
        g.font = "bold 28px monospace";
        g.fillText("ALTITUDE: 57 KM  |  EXPECTED: 226 KM", 54, 468);
      });

    case "ecu_datafile_final":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#10141f";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(140,175,220,0.08)");
        g.strokeStyle = "#4d6484";
        g.lineWidth = 6;
        g.strokeRect(24, 24, 976, 976);

        g.fillStyle = "#94b8e6";
        g.font = "bold 34px monospace";
        g.fillText("FILE: SM_FORCES.DAT  [LINE 042]", 58, 118);

        g.strokeStyle = "#4d6484";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(58, 155);
        g.lineTo(966, 155);
        g.stroke();

        // Top line: OUTPUT WRITTEN 40.90 lbf·s
        g.fillStyle = "#ffd18c";
        g.font = "bold 34px monospace";
        g.fillText("OUTPUT WRITTEN : 40.90", 58, 285);
        g.fillStyle = "#ffab2e";
        g.fillRect(545, 210, 410, 155);
        g.fillStyle = "#1a1000";
        g.font = "bold 100px monospace";
        g.fillText("lbf·s", 590, 320);

        // Second line: EXPECTED SPEC 40.90 N·s
        g.fillStyle = "#9beeff";
        g.font = "bold 34px monospace";
        g.fillText("EXPECTED SPEC  : 40.90", 58, 535);
        g.fillStyle = "#2ad8f0";
        g.fillRect(545, 455, 410, 155);
        g.fillStyle = "#041a24";
        g.font = "bold 110px monospace";
        g.fillText("N·s", 640, 568);

        g.strokeStyle = "#4d6484";
        g.beginPath();
        g.moveTo(58, 705);
        g.lineTo(966, 705);
        g.stroke();

        g.fillStyle = "#ff785a";
        g.font = "bold 38px monospace";
        g.fillText("FACTOR: × 4.45  (226 KM -> 57 KM)", 58, 800);
        g.fillStyle = "#d0dbe8";
        g.font = "bold 30px monospace";
        g.fillText("23 SEP 1999  |  COST: $125M", 58, 890);
      });

    case "pad_sign_lc17a":
      return makeTex(id, 512, 256, (g) => {
        g.fillStyle = "#1d324d";
        g.fillRect(0, 0, 512, 256);
        g.strokeStyle = "#f2c14e";
        g.lineWidth = 10;
        g.strokeRect(10, 10, 492, 236);
        g.fillStyle = "#ffffff";
        g.font = "bold 48px monospace";
        g.fillText("LC-17A | DEC 1998", 30, 105);
        g.fillStyle = "#ffd166";
        g.font = "bold 36px monospace";
        g.fillText("MARS CLIMATE ORBITER", 30, 185);
      });

    case "team_sign_lockheed":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#523212";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#ffbe55";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#ffe5a3";
        g.font = "bold 32px monospace";
        g.fillText("LOCKHEED MARTIN", 96, 55);
        g.fillStyle = "#ffbd59";
        g.font = "bold 24px monospace";
        g.fillText("BUILDER  |  UNIT: lbf·s", 92, 96);
      });

    case "team_sign_jpl":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#12344d";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#4be0ff";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#dcf8ff";
        g.font = "bold 32px monospace";
        g.fillText("NASA JPL", 168, 55);
        g.fillStyle = "#5be8ff";
        g.font = "bold 24px monospace";
        g.fillText("NAVIGATION  |  UNIT: N·s", 80, 96);
      });

    case "handoff_banner":
      return makeTex(id, 1024, 192, (g) => {
        g.fillStyle = "#1b2738";
        g.fillRect(0, 0, 1024, 192);
        g.strokeStyle = "#ff9d3b";
        g.lineWidth = 8;
        g.strokeRect(8, 8, 1008, 176);
        g.fillStyle = "#ffcf70";
        g.font = "bold 42px monospace";
        g.fillText("FILE: SM_FORCES.DAT", 64, 82);
        g.fillStyle = "#7ee8ff";
        g.font = "bold 36px monospace";
        g.fillText("LOCKHEED (lbf·s)  --->  JPL (N·s)", 64, 146);
      });

    case "gate_226km":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#0e3d38";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#38f2c2";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#a8ffea";
        g.font = "bold 36px monospace";
        g.fillText("PLANNED: 226 KM", 78, 78);
      });

    case "gate_57km":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#4d140c";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#ff5a36";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#ffd6cc";
        g.font = "bold 36px monospace";
        g.fillText("ACTUAL: 57 KM", 104, 78);
      });

    case "tag_planned_path":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#0e3a38";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#3ef5c8";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#9fffe8";
        g.font = "bold 38px monospace";
        g.fillText("PLANNED PATH", 108, 78);
      });

    case "tag_actual_path":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#4d180e";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#ff5e3a";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#ffd4c8";
        g.font = "bold 38px monospace";
        g.fillText("ACTUAL PATH", 120, 78);
      });

    case "tag_cruise_95":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#162d4d";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#6edbff";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#d9f6ff";
        g.font = "bold 34px monospace";
        g.fillText("CRUISE: 9.5 MONTHS", 62, 76);
      });

    case "plaque_showcase":
      return makeTex(id, 512, 192, (g) => {
        g.fillStyle = "#182738";
        g.fillRect(0, 0, 512, 192);
        g.strokeStyle = "#f5c556";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 180);
        g.fillStyle = "#ffe59c";
        g.font = "bold 36px monospace";
        g.fillText("ORBITER COST: $125M", 44, 78);
        g.fillStyle = "#a8e6ff";
        g.font = "bold 26px monospace";
        g.fillText("SINGLE SOLAR WING | DISH", 44, 140);
      });

    case "sticky_note":
      return makeTex(id, 256, 256, (g) => {
        g.fillStyle = "#ffe76b";
        g.fillRect(0, 0, 256, 256);
        g.fillStyle = "#e8cb3d";
        g.fillRect(0, 0, 256, 36);
        g.fillStyle = "#222b38";
        g.font = "bold 28px monospace";
        g.fillText("SM_FORCES", 36, 102);
        g.fillStyle = "#a82414";
        g.font = "bold 30px monospace";
        g.fillText("lbf·s / N·s", 22, 162);
        g.fillStyle = "#1d4e78";
        g.font = "bold 28px monospace";
        g.fillText("× 4.45 ?", 56, 214);
      });

    case "nebula_sky":
      return makeTex(id, 1024, 512, (g, r) => {
        // Luminous cosmic nebula so deep-space shots maintain L* >= 50
        const grd = g.createLinearGradient(0, 0, 1024, 512);
        grd.addColorStop(0, "#46649e");
        grd.addColorStop(0.45, "#6c6199");
        grd.addColorStop(0.8, "#9c6c7c");
        grd.addColorStop(1, "#5572a6");
        g.fillStyle = grd;
        g.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 42; i++) {
          const x = r() * 1024;
          const y = r() * 512;
          const rad = 70 + r() * 160;
          const rg = g.createRadialGradient(x, y, 8, x, y, rad);
          const cols = ["rgba(182,126,132,0.28)", "rgba(130,174,230,0.26)", "rgba(225,174,132,0.22)"];
          rg.addColorStop(0, cols[i % cols.length]);
          rg.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = rg;
          g.beginPath();
          g.arc(x, y, rad, 0, Math.PI * 2);
          g.fill();
        }
        for (let i = 0; i < 240; i++) {
          g.fillStyle = i % 7 === 0 ? "#fff3c4" : "#eef6ff";
          const sz = i % 11 === 0 ? 3 : 1.8;
          g.fillRect(r() * 1024, r() * 512, sz, sz);
        }
      });

    case "dawn_sky":
      return makeTex(id, 512, 512, (g, r) => {
        const grd = g.createLinearGradient(0, 0, 0, 512);
        grd.addColorStop(0, "#4280c4");
        grd.addColorStop(0.45, "#87bae6");
        grd.addColorStop(0.82, "#f5cba2");
        grd.addColorStop(1, "#f7ae7e");
        g.fillStyle = grd;
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 16; i++) {
          g.fillStyle = "rgba(255,244,228,0.32)";
          g.beginPath();
          g.ellipse(r() * 512, 210 + r() * 170, 50 + r() * 80, 14 + r() * 16, 0, 0, Math.PI * 2);
          g.fill();
        }
      });

    case "mars_surface":
      return makeTex(id, 1024, 512, (g, r) => {
        const grd = g.createLinearGradient(0, 0, 0, 512);
        grd.addColorStop(0, "#f2ebe2"); // north polar cap
        grd.addColorStop(0.1, "#d97a46");
        grd.addColorStop(0.55, "#c45c30");
        grd.addColorStop(0.9, "#d67742");
        grd.addColorStop(1, "#efe7dd"); // south polar cap
        g.fillStyle = grd;
        g.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 85; i++) {
          g.fillStyle = i % 2 === 0 ? "rgba(155,58,28,0.32)" : "rgba(240,152,92,0.28)";
          g.beginPath();
          g.ellipse(r() * 1024, 55 + r() * 400, 28 + r() * 85, 10 + r() * 34, r() * 1.2, 0, Math.PI * 2);
          g.fill();
        }
        // Canyon scar
        g.strokeStyle = "rgba(105,36,18,0.55)";
        g.lineWidth = 14;
        g.beginPath();
        g.moveTo(220, 260);
        g.bezierCurveTo(380, 235, 560, 295, 760, 250);
        g.stroke();
        // Craters
        for (let i = 0; i < 36; i++) {
          const cx = r() * 1024;
          const cy = 60 + r() * 390;
          const cr = 8 + r() * 24;
          g.strokeStyle = "rgba(250,185,130,0.45)";
          g.lineWidth = 3;
          g.beginPath();
          g.arc(cx, cy, cr, 0, Math.PI * 2);
          g.stroke();
        }
      });

    case "kapton_foil":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#e8a832";
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 160; i++) {
          const x = r() * 512;
          const y = r() * 512;
          const w = 18 + r() * 46;
          const h = 14 + r() * 38;
          g.fillStyle = i % 3 === 0 ? "#ffd866" : i % 3 === 1 ? "#c78018" : "#f5bc42";
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + w, y + (r() - 0.5) * 14);
          g.lineTo(x + w * 0.7, y + h);
          g.closePath();
          g.fill();
        }
        g.strokeStyle = "rgba(110,64,8,0.4)";
        g.lineWidth = 2;
        for (let i = 0; i < 65; i++) {
          const x = r() * 512;
          const y = r() * 512;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
          g.stroke();
        }
      }, true);

    case "solar_cells":
      return makeTex(id, 512, 512, (g) => {
        g.fillStyle = "#1b3f7a";
        g.fillRect(0, 0, 512, 512);
        const cols = 4;
        const rows = 8;
        const cw = 512 / cols;
        const ch = 512 / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            g.fillStyle = (r + c) % 2 === 0 ? "#214b91" : "#183970";
            g.fillRect(c * cw + 4, r * ch + 4, cw - 8, ch - 8);
            g.strokeStyle = "#9dc4f2";
            g.lineWidth = 2;
            g.strokeRect(c * cw + 4, r * ch + 4, cw - 8, ch - 8);
          }
        }
        g.strokeStyle = "#d8e9ff";
        g.lineWidth = 3;
        for (let c = 1; c < cols; c++) {
          g.beginPath();
          g.moveTo(c * cw, 0);
          g.lineTo(c * cw, 512);
          g.stroke();
        }
      }, true);

    case "jpl_wall":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#ded8cc";
        g.fillRect(0, 0, 512, 512);
        for (let x = 0; x < 512; x += 128) {
          g.fillStyle = x % 256 === 0 ? "#e3ddd1" : "#d8d1c4";
          g.fillRect(x + 2, 0, 124, 512);
          g.fillStyle = "#b8b0a2";
          g.fillRect(x, 0, 3, 512);
        }
        for (let i = 0; i < 400; i++) {
          g.fillStyle = "rgba(90,82,70,0.08)";
          g.fillRect(r() * 512, r() * 512, 3, 3);
        }
      }, true);

    case "jpl_floor":
      return makeTex(id, 512, 512, (g) => {
        g.fillStyle = "#7b8896";
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 64) {
          for (let x = 0; x < 512; x += 64) {
            g.fillStyle = ((x + y) / 64) % 2 === 0 ? "#8592a0" : "#788593";
            g.fillRect(x + 2, y + 2, 60, 60);
          }
        }
      }, true);

    case "concrete_pad":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#a39f96";
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 240; i++) {
          g.fillStyle = i % 2 === 0 ? "rgba(130,124,116,0.25)" : "rgba(210,206,198,0.22)";
          g.fillRect(r() * 512, r() * 512, 12 + r() * 28, 8 + r() * 18);
        }
        // Safety hazard stripes along border
        g.fillStyle = "#e0b422";
        g.fillRect(0, 0, 512, 24);
        g.fillStyle = "#222429";
        for (let x = 0; x < 512; x += 48) {
          g.fillRect(x, 0, 24, 24);
        }
      }, true);

    case "office_parquet":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#c99a67";
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 32) {
          g.fillStyle = (y / 32) % 2 === 0 ? "#cf9f6c" : "#c2905c";
          g.fillRect(0, y + 2, 512, 28);
          g.strokeStyle = "rgba(110,68,30,0.25)";
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(0, y + 12 + r() * 8);
          g.lineTo(512, y + 12 + r() * 8);
          g.stroke();
        }
      }, true);

    case "rocket_body":
      return makeTex(id, 512, 512, (g) => {
        g.fillStyle = "#237491";
        g.fillRect(0, 0, 512, 512);
        g.fillStyle = "#f2f5f7";
        g.fillRect(0, 0, 512, 85);
        g.fillRect(0, 440, 512, 72);
        g.fillStyle = "#183e54";
        g.font = "bold 46px monospace";
        g.fillText("DELTA", 180, 210);
        g.fillStyle = "#ff5b36";
        g.font = "bold 40px monospace";
        g.fillText("NASA", 198, 280);
      });

    case "sun_halo":
      return makeTex(id, 256, 256, (g) => {
        const rg = g.createRadialGradient(128, 128, 10, 128, 128, 128);
        rg.addColorStop(0, "rgba(255,250,225,1)");
        rg.addColorStop(0.28, "rgba(255,220,145,0.75)");
        rg.addColorStop(0.65, "rgba(255,175,95,0.25)");
        rg.addColorStop(1, "rgba(255,160,80,0)");
        g.fillStyle = rg;
        g.fillRect(0, 0, 256, 256);
      });

    case "hook_telemetry_hud":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0b1c30";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(44,240,195,0.12)");
        g.strokeStyle = "#2cf2b8";
        g.lineWidth = 8;
        g.strokeRect(10, 10, 1004, 492);
        // Header
        g.fillStyle = "#123850";
        g.fillRect(14, 14, 996, 92);
        g.fillStyle = "#d8fbff";
        g.font = "bold 36px monospace";
        g.fillText("MCO TELEMETRY", 36, 72);
        // Green nominal status badge
        g.fillStyle = "#14b872";
        g.fillRect(540, 26, 444, 68);
        g.strokeStyle = "#a6ffe0";
        g.lineWidth = 4;
        g.strokeRect(540, 26, 444, 68);
        g.fillStyle = "#ffffff";
        g.font = "bold 36px monospace";
        g.fillText("STATUS: ALL OK", 582, 72);
        // Left readouts
        g.fillStyle = "#88eedc";
        g.font = "bold 26px monospace";
        g.fillText("PLANNED ALTITUDE", 40, 158);
        g.fillStyle = "#48ffbe";
        g.font = "bold 88px monospace";
        g.fillText("226 KM", 38, 246);
        g.fillStyle = "#c9f2ff";
        g.font = "bold 28px monospace";
        g.fillText("CRUISE: 9.5 MONTHS", 40, 308);
        // Steady signal bars
        g.fillStyle = "#88eedc";
        g.font = "bold 26px monospace";
        g.fillText("SIGNAL:", 40, 412);
        for (let b = 0; b < 5; b++) {
          const bh = 28 + b * 14;
          g.fillStyle = "#2cf59b";
          g.fillRect(175 + b * 34, 448 - bh, 22, bh);
        }
        g.fillStyle = "#48ffbe";
        g.font = "bold 28px monospace";
        g.fillText("LOCKED", 365, 412);
        // Right mini-trajectory card
        g.fillStyle = "#081422";
        g.fillRect(548, 128, 436, 344);
        g.strokeStyle = "#22c49e";
        g.lineWidth = 4;
        g.strokeRect(548, 128, 436, 344);
        g.fillStyle = "#48ffbe";
        g.font = "bold 26px monospace";
        g.fillText("TRAJECTORY: TRUE", 574, 170);
        // Mini Mars globe in corner
        const mg = g.createRadialGradient(845, 365, 10, 845, 365, 78);
        mg.addColorStop(0, "#f59d62");
        mg.addColorStop(1, "#a6401e");
        g.beginPath();
        g.arc(845, 365, 78, 0, Math.PI * 2);
        g.fillStyle = mg;
        g.fill();
        g.strokeStyle = "#f4a261";
        g.lineWidth = 3;
        g.stroke();
        // Safe green planned curve passing well ABOVE Mars
        g.strokeStyle = "#2cf5a8";
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(576, 345);
        g.quadraticCurveTo(718, 225, 956, 204);
        g.stroke();
        g.fillStyle = "#2cf5a8";
        g.beginPath();
        g.arc(845, 222, 9, 0, Math.PI * 2);
        g.fill();
        g.font = "bold 22px monospace";
        g.fillText("226 KM", 805, 198);
      });

    case "hook_warn_badge":
      return makeTex(id, 256, 128, (g) => {
        g.fillStyle = "#4a100c";
        g.fillRect(0, 0, 256, 128);
        g.strokeStyle = "#ff5a36";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 244, 116);
        // Warning triangle graphic
        g.fillStyle = "#ffd038";
        g.beginPath();
        g.moveTo(64, 22);
        g.lineTo(108, 102);
        g.lineTo(20, 102);
        g.closePath();
        g.fill();
        g.fillStyle = "#1c0a04";
        g.font = "bold 54px monospace";
        g.fillText("!", 48, 92);
        g.fillStyle = "#ff6d4a";
        g.font = "bold 46px monospace";
        g.fillText("ERR!", 124, 82);
      });

    case "split_left_jpl":
      return makeTex(id, 512, 1024, (g) => {
        g.fillStyle = "#0a1e33";
        g.fillRect(0, 0, 512, 1024);
        drawGrid(g, 512, 1024, 64, "rgba(54,227,245,0.14)");
        g.fillStyle = "#124168";
        g.fillRect(0, 0, 512, 156);
        g.strokeStyle = "#36e3f5";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 1012);
        g.fillStyle = "#9ef5ff";
        g.font = "bold 48px monospace";
        g.fillText("JPL READ", 138, 68);
        g.fillStyle = "#36e3f5";
        g.font = "bold 44px monospace";
        g.fillText("UNIT: N·s", 132, 128);
        // Scale lines
        const baseY = 920;
        const step = 128;
        g.font = "bold 28px monospace";
        for (let k = 0; k <= 5; k++) {
          const y = baseY - k * step;
          g.strokeStyle = k === 1 ? "rgba(54,227,245,0.75)" : "rgba(120,215,255,0.22)";
          g.lineWidth = k === 1 ? 4 : 2;
          g.beginPath();
          g.moveTo(88, y);
          g.lineTo(486, y);
          g.stroke();
          g.fillStyle = "#7ef2ff";
          g.fillText(`${k}×`, 22, y + 10);
        }
        g.fillStyle = "#7ef2ff";
        g.font = "bold 30px monospace";
        g.fillText("1 N·s (METRIC)", 122, 985);
      });

    case "split_right_lockheed":
      return makeTex(id, 512, 1024, (g) => {
        g.fillStyle = "#24130a";
        g.fillRect(0, 0, 512, 1024);
        drawGrid(g, 512, 1024, 64, "rgba(255,140,65,0.14)");
        g.fillStyle = "#5c2612";
        g.fillRect(0, 0, 512, 156);
        g.strokeStyle = "#ff6e38";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 500, 1012);
        g.fillStyle = "#ffd6a3";
        g.font = "bold 48px monospace";
        g.fillText("ACTUAL", 162, 68);
        g.fillStyle = "#ff9d42";
        g.font = "bold 44px monospace";
        g.fillText("UNIT: lbf·s", 104, 128);
        const baseY = 920;
        const step = 128;
        g.font = "bold 28px monospace";
        for (let k = 0; k <= 5; k++) {
          const y = baseY - k * step;
          g.strokeStyle = "rgba(255,165,105,0.22)";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(26, y);
          g.lineTo(426, y);
          g.stroke();
          g.fillStyle = "#ffaa70";
          g.fillText(`${k}×`, 442, y + 10);
        }
        // 4.45x target line
        const y445 = baseY - 4.45 * step;
        g.strokeStyle = "#ff6633";
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(26, y445);
        g.lineTo(426, y445);
        g.stroke();
        g.fillStyle = "#ffdf78";
        g.font = "bold 28px monospace";
        g.fillText("4.45", 430, y445 + 10);
        g.fillStyle = "#ffb878";
        g.font = "bold 28px monospace";
        g.fillText("1 lbf·s = 4.45 N·s", 96, 985);
      });

    case "tag_lbfs_plug":
      return makeTex(id, 256, 128, (g) => {
        g.fillStyle = "#ffb02e";
        g.fillRect(0, 0, 256, 128);
        g.strokeStyle = "#1c1204";
        g.lineWidth = 10;
        g.strokeRect(5, 5, 246, 118);
        g.fillStyle = "#1c1204";
        g.font = "bold 66px monospace";
        g.fillText("lbf·s", 26, 86);
      });

    case "tag_ns_socket":
      return makeTex(id, 256, 128, (g) => {
        g.fillStyle = "#2ad8f0";
        g.fillRect(0, 0, 256, 128);
        g.strokeStyle = "#041c24";
        g.lineWidth = 10;
        g.strokeRect(5, 5, 246, 118);
        g.fillStyle = "#041c24";
        g.font = "bold 74px monospace";
        g.fillText("N·s", 58, 88);
      });

    case "tag_1x_cap":
      return makeTex(id, 256, 96, (g) => {
        g.fillStyle = "#0e3a4d";
        g.fillRect(0, 0, 256, 96);
        g.strokeStyle = "#36e3f5";
        g.lineWidth = 8;
        g.strokeRect(4, 4, 248, 88);
        g.fillStyle = "#8ef6ff";
        g.font = "bold 54px monospace";
        g.fillText("1.0×", 62, 66);
      });

    case "tag_445x_cap":
      return makeTex(id, 256, 96, (g) => {
        g.fillStyle = "#52180c";
        g.fillRect(0, 0, 256, 96);
        g.strokeStyle = "#ff6633";
        g.lineWidth = 8;
        g.strokeRect(4, 4, 248, 88);
        g.fillStyle = "#ffe07d";
        g.font = "bold 52px monospace";
        g.fillText("4.45×", 48, 66);
      });
  }
}

// ---------------- Deterministic Starfield & Dust Data ----------------
export type StarSample = { pos: V3; scale: number; phase: number };

const STAR_DATA: StarSample[] = (() => {
  const r = mulberry32(19981211);
  const out: StarSample[] = [];
  for (let i = 0; i < 240; i++) {
    const theta = r() * Math.PI * 2;
    const phi = Math.acos(2 * r() - 1);
    const rad = 28 + r() * 24;
    out.push({
      pos: [
        Math.sin(phi) * Math.cos(theta) * rad,
        Math.cos(phi) * rad,
        Math.sin(phi) * Math.sin(theta) * rad,
      ],
      scale: 0.04 + r() * 0.09,
      phase: r() * Math.PI * 2,
    });
  }
  return out;
})();

const DUST_DATA: StarSample[] = (() => {
  const r = mulberry32(19990923);
  const out: StarSample[] = [];
  for (let i = 0; i < 48; i++) {
    out.push({
      pos: [(r() - 0.5) * 9, (r() - 0.5) * 7, (r() - 0.5) * 20],
      scale: 0.025 + r() * 0.04,
      phase: r() * 10,
    });
  }
  return out;
})();

export const StarfieldDome: React.FC<{ streamZ?: number }> = ({ streamZ = 0 }) => {
  const starGeo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const starMat = useMemo(
    () => basicMat("star_mat", () => ({ color: "#fff8e8" })),
    [],
  );
  const dustMat = useMemo(
    () => basicMat("dust_mat", () => ({ color: "#a8e6ff", transparent: true, opacity: 0.72 })),
    [],
  );
  return h(
    "group",
    null,
    ...STAR_DATA.map((s, i) =>
      h("mesh", {
        key: `st-${i}`,
        geometry: starGeo,
        material: starMat,
        position: s.pos,
        scale: s.scale,
      }),
    ),
    ...DUST_DATA.map((d, i) => {
      const z = ((d.pos[2] + streamZ + 10) % 20 + 20) % 20 - 10;
      return h("mesh", {
        key: `du-${i}`,
        geometry: starGeo,
        material: dustMat,
        position: [d.pos[0], d.pos[1], z],
        scale: [d.scale, d.scale, d.scale * (streamZ > 0 ? 4.5 : 1)],
      });
    }),
  );
};

// ---------------- 3D Ribbon Line Builder ----------------
export const RibbonLine: React.FC<{
  points: V3[];
  width?: number;
  color: string;
  opacity?: number;
  emissiveIntensity?: number;
}> = ({ points, width = 0.06, color, opacity = 1 }) => {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, Math.max(16, points.length * 8), width * 0.5, 6, false);
  }, [points, width]);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        toneMapped: false,
      }),
    [color, opacity],
  );

  return h("mesh", {
    geometry: geo,
    material: mat,
    onUpdate: (self: THREE.Mesh) => self.layers.set(NOINK),
  });
};

// ---------------- Mars Globe ----------------
export const MarsGlobe: React.FC<{
  position: V3;
  radius?: number;
  scale?: number;
  rotY?: number;
}> = ({ position, radius = 6.5, scale = 1, rotY = 0 }) => {
  const surfMat = useMemo(
    () =>
      toonLam("mars_globe_mat", () => ({
        map: getDiegeticTexture("mars_surface"),
      })),
    [],
  );
  const haloMat = useMemo(
    () =>
      basicMat("mars_halo_mat", () => ({
        color: "#f4a261",
        transparent: true,
        opacity: 0.28,
        side: THREE.BackSide,
        depthWrite: false,
      })),
    [],
  );
  return h(
    "group",
    { position, scale, rotation: [0.12, rotY, -0.08] },
    h("mesh", { material: surfMat, receiveShadow: true }, h("sphereGeometry", { args: [radius, 40, 28] })),
    h(
      "mesh",
      { material: haloMat, onUpdate: (self: THREE.Mesh) => self.layers.set(NOINK) },
      h("sphereGeometry", { args: [radius * 1.055, 32, 20] }),
    ),
  );
};

// ---------------- Reusable Console Desk Unit ----------------
export const DeskConsoleUnit: React.FC<{
  position: V3;
  rotationY?: number;
  screenTex?: DiegeticTexId;
  screenDark?: boolean;
  hasBinder?: boolean;
  hasMug?: boolean;
  binderColor?: string;
}> = ({
  position,
  rotationY = 0,
  screenTex = "jpl_nav_screen",
  screenDark = false,
  hasBinder = true,
  hasMug = true,
  binderColor = "#2a629a",
}) => {
  const deskTopMat = useMemo(() => toonLam("desk_top", () => ({ color: "#d5cbb8" })), []);
  const deskBodyMat = useMemo(() => toonLam("desk_body", () => ({ color: "#3d5166" })), []);
  const bezelMat = useMemo(() => toonLam("crt_bezel", () => ({ color: "#cfc9bc" })), []);
  const keyMat = useMemo(() => toonLam("kb_mat", () => ({ color: "#e5e0d4" })), []);
  const binderMat = useMemo(
    () => toonLam(`binder_${binderColor}`, () => ({ color: binderColor })),
    [binderColor],
  );
  const mugMat = useMemo(() => toonLam("mug_white", () => ({ color: "#f2efe8" })), []);
  const screenMat = useMemo(
    () =>
      screenDark
        ? basicMat("crt_off", () => ({ color: "#141c24" }))
        : basicMat(`crt_${screenTex}`, () => ({
            map: getDiegeticTexture(screenTex),
            toneMapped: false,
          })),
    [screenDark, screenTex],
  );

  return h(
    "group",
    { position, rotation: [0, rotationY, 0] },
    h("mesh", { material: deskBodyMat, position: [0, 0.37, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.38, 0.74, 0.76] })),
    h("mesh", { material: deskTopMat, position: [0, 0.76, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.44, 0.04, 0.82] })),
    h(
      "group",
      { position: [0, 1.01, -0.14] },
      h("mesh", { material: bezelMat, castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.56, 0.44, 0.42] })),
      h("mesh", { material: screenMat, position: [0, 0.01, 0.215], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("planeGeometry", { args: [0.46, 0.34] })),
    ),
    h("mesh", { material: keyMat, position: [-0.06, 0.795, 0.2], castShadow: true }, h("boxGeometry", { args: [0.46, 0.025, 0.16] })),
    h("mesh", { material: bezelMat, position: [0.28, 0.795, 0.2], castShadow: true }, h("boxGeometry", { args: [0.1, 0.028, 0.13] })),
    hasBinder ? h("mesh", { material: binderMat, position: [-0.48, 0.805, 0.16], rotation: [0, 0.18, 0], castShadow: true }, h("boxGeometry", { args: [0.24, 0.045, 0.30] })) : null,
    hasMug ? h("mesh", { material: mugMat, position: [0.48, 0.83, 0.16], castShadow: true }, h("cylinderGeometry", { args: [0.042, 0.038, 0.10, 14] })) : null,
  );
};
