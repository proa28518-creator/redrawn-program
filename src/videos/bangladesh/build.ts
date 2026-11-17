// Deterministic geometry helpers, seeded PRNG, cached materials, and module-level singleton
// canvas textures for "BangladeshHeist". ZERO per-frame canvas or texture allocations.
import React, { useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { twoTone } from "../indiana-bell/shade";
import { NOINK } from "../indiana-bell/ink";
import { clamp01, lerpVec3, smoothstep, V3 } from "./story";

export { clamp01, lerpVec3, smoothstep };

export function h<K extends keyof ThreeElements>(
  type: K,
  props: ThreeElements[K] | null,
  ...children: React.ReactNode[]
): React.ReactElement;
export function h<P extends object>(
  type: React.ComponentType<P>,
  props: (P & { key?: React.Key }) | null,
  ...children: React.ReactNode[]
): React.ReactElement;
export function h(
  type: React.ElementType,
  props: Record<string, unknown> | null,
  ...children: React.ReactNode[]
): React.ReactElement {
  return React.createElement(type, props, ...children);
}

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
export const MAT_CACHE = new Map<string, THREE.Material>();

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
  | "swift_hook_typo"
  | "swift_one_letter"
  | "swift_beneficiary_entry"
  | "swift_ecu_fandation"
  | "swift_punchline_password"
  | "swift_final_collapse"
  | "sticky_note"
  | "watchtower_sign"
  | "conduit_header_850m"
  | "cleared_tag_101m"
  | "board_951m"
  | "board_850m_saved"
  | "vault_crest"
  | "calendar_feb2016"
  | "calendar_jan2016"
  | "bank_server_screen"
  | "bank_desk_screen"
  | "hacker_intrusion_screen"
  | "hacker_months_board"
  | "hacker_strategy_board"
  | "hacker_35_counter"
  | "hacker_victory_screen"
  | "hacker_warn_dot"
  | "hacker_timezone_clocks"
  | "printer_lcd"
  | "printer_spooler_wall"
  | "printer_notice"
  | "thursday_night_clock"
  | "bank_plaza_sign"
  | "world_map_header"
  | "board_101m_moved"
  | "board_81_20_split"
  | "tag_ph_81m"
  | "tag_sl_20m"
  | "tag_ph_node"
  | "tag_sl_node"
  | "tag_dhaka_node"
  | "deutsche_wall_header"
  | "deutsche_screen_spot"
  | "deutsche_query_halt"
  | "deutsche_registry_book"
  | "fed_wall_header"
  | "fed_review_matrix"
  | "fed_stopped_board"
  | "fed_wing_left"
  | "fed_wing_right"
  | "terrazzo_floor"
  | "sandstone_wall"
  | "loft_brick"
  | "loft_timber"
  | "office_parquet"
  | "limestone_wall"
  | "fed_carpet"
  | "night_sky"
  | "dhaka_road"
  | "world_ocean_grid"
  | "currency_wrap";

export const TEX_CACHE = new Map<DiegeticTexId, THREE.CanvasTexture>();

function makeTex(
  key: DiegeticTexId,
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
    case "swift_hook_typo":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#eaf2fb";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(30,74,154,0.09)");
        g.fillStyle = "#173c6e";
        g.fillRect(0, 0, 1024, 132);
        g.fillStyle = "#ffffff";
        g.font = "bold 40px monospace";
        g.fillText("SWIFT MT103 — LEG #16 ($20M SL)", 56, 82);

        g.fillStyle = "#1e3a5f";
        g.font = "bold 32px monospace";
        g.fillText("BENEFICIARY NGO FIELD 59:", 56, 215);

        // Highlighted FANDATION box
        g.fillStyle = "#fee2e2";
        g.fillRect(56, 255, 912, 175);
        g.strokeStyle = "#dc2626";
        g.lineWidth = 8;
        g.strokeRect(56, 255, 912, 175);
        g.fillStyle = "#111827";
        g.font = "bold 76px monospace";
        g.fillText("SHALIKA F", 82, 368);
        g.fillStyle = "#dc2626";
        g.fillRect(490, 282, 66, 118);
        g.fillStyle = "#ffffff";
        g.fillText("A", 500, 368);
        g.fillStyle = "#111827";
        g.fillText("NDATION", 562, 368);

        // Comparison valid box
        g.fillStyle = "#e0f7f4";
        g.fillRect(56, 470, 912, 145);
        g.strokeStyle = "#0d9488";
        g.lineWidth = 6;
        g.strokeRect(56, 470, 912, 145);
        g.fillStyle = "#0f5132";
        g.font = "bold 56px monospace";
        g.fillText("VALID: F[OU]NDATION", 86, 562);

        // Strictly single-leg stoppage banner
        g.fillStyle = "#c81e1e";
        g.fillRect(56, 680, 912, 140);
        g.fillStyle = "#ffffff";
        g.font = "bold 22px monospace";
        const bannerText = "1 TRANSFER QUERIED - $20M SRI LANKA LEG RECOVERED IN FULL";
        g.fillText(bannerText, Math.round(512 - g.measureText(bannerText).width / 2), 764);

        g.fillStyle = "#1e3a8a";
        g.font = "bold 32px monospace";
        g.fillText("TRIGGERS FEDERAL RESERVE REVIEW ->", 86, 912);
      });

    case "swift_one_letter":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#eef4fb";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(185,28,28,0.08)");
        g.fillStyle = "#991b1b";
        g.fillRect(0, 0, 1024, 136);
        g.fillStyle = "#ffffff";
        g.font = "bold 36px monospace";
        g.fillText("SWIFT MT103 — TRANSFER #16 ($20M SL)", 56, 82);

        g.fillStyle = "#92400e";
        g.font = "bold 38px monospace";
        g.fillText("1 CHARACTER MISMATCH DETECTED", 96, 265);

        g.fillStyle = "#fee2e2";
        g.fillRect(72, 345, 880, 220);
        g.strokeStyle = "#dc2626";
        g.lineWidth = 8;
        g.strokeRect(72, 345, 880, 220);

        g.fillStyle = "#111827";
        g.font = "bold 92px monospace";
        g.fillText("F", 120, 488);
        g.fillStyle = "#dc2626";
        g.fillRect(184, 376, 94, 152);
        g.fillStyle = "#ffffff";
        g.fillText("A", 202, 488);
        g.fillStyle = "#111827";
        g.fillText("NDATION", 292, 488);

        g.fillStyle = "#b91c1c";
        g.font = "bold 40px monospace";
        g.fillText("[!] WRONG LETTER IN BENEFICIARY", 96, 680);
        g.fillStyle = "#0f5132";
        g.font = "bold 34px monospace";
        g.fillText("EXPECTED: FOUNDATION (MISSING 'O')", 96, 780);
      });

    case "swift_beneficiary_entry":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#edf3fa";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(30,64,175,0.08)");
        g.fillStyle = "#1e40af";
        g.fillRect(0, 0, 1024, 140);
        g.fillStyle = "#ffffff";
        g.font = "bold 36px monospace";
        g.fillText("SWIFT MT103 — SRI LANKA NGO ($20M)", 56, 86);

        g.fillStyle = "#92400e";
        g.font = "bold 36px monospace";
        g.fillText("FIELD 59 : BENEFICIARY INSTITUTION", 64, 270);

        g.fillStyle = "#ffffff";
        g.fillRect(64, 340, 896, 260);
        g.strokeStyle = "#d97706";
        g.lineWidth = 8;
        g.strokeRect(64, 340, 896, 260);

        g.fillStyle = "#1e3a8a";
        g.font = "bold 32px monospace";
        g.fillText("ENTERED TEXT:", 102, 405);

        g.fillStyle = "#111827";
        g.font = "bold 68px monospace";
        g.fillText("SHALIKA FANDATION", 102, 515);

        g.fillStyle = "#b91c1c";
        g.font = "bold 36px monospace";
        g.fillText("DESTINATION : COLOMBO, SRI LANKA", 64, 725);
        g.fillStyle = "#1e40af";
        g.font = "bold 32px monospace";
        g.fillText("ROUTING VIA : DEUTSCHE BANK", 64, 800);
      });

    case "swift_ecu_fandation":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#eef4fa";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(30,64,175,0.08)");
        g.strokeStyle = "#1e40af";
        g.lineWidth = 8;
        g.strokeRect(36, 36, 952, 952);

        g.fillStyle = "#1e3a8a";
        g.font = "bold 36px monospace";
        g.fillText("MT103 FIELD 59 — SPELLING ERROR", 118, 128);

        // Top row: Fandation (TYPED ERROR)
        g.fillStyle = "#b91c1c";
        g.font = "bold 32px monospace";
        g.fillText("TYPED (ERROR) : MISSING 'O'", 118, 232);

        g.fillStyle = "#fee2e2";
        g.fillRect(108, 260, 808, 175);
        g.strokeStyle = "#dc2626";
        g.lineWidth = 8;
        g.strokeRect(108, 260, 808, 175);

        // Highlight box on "Fa"
        g.fillStyle = "#dc2626";
        g.fillRect(142, 285, 166, 126);
        g.fillStyle = "#ffffff";
        g.font = "bold 104px monospace";
        g.fillText("Fa", 150, 385);
        g.fillStyle = "#111827";
        g.fillText("ndation", 308, 385);

        // Bottom row: Foundation (CORRECT NAME)
        g.fillStyle = "#0f766e";
        g.font = "bold 32px monospace";
        g.fillText("VALID NGO NAME : CORRECT", 118, 540);

        g.fillStyle = "#dcfce7";
        g.fillRect(108, 568, 808, 175);
        g.strokeStyle = "#0d9488";
        g.lineWidth = 8;
        g.strokeRect(108, 568, 808, 175);

        // Highlight box on "Fou"
        g.fillStyle = "#0d9488";
        g.fillRect(142, 593, 218, 126);
        g.fillStyle = "#ffffff";
        g.font = "bold 100px monospace";
        g.fillText("Fou", 150, 692);
        g.fillStyle = "#111827";
        g.fillText("ndation", 360, 692);

        g.fillStyle = "#92400e";
        g.font = "bold 36px monospace";
        g.fillText("STATUS : SPELLING ANOMALY FLAGGED", 118, 860);
      });

    case "swift_punchline_password":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#edf4fc";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(30,74,154,0.08)");
        g.fillStyle = "#173c6e";
        g.fillRect(0, 0, 1024, 130);
        g.fillStyle = "#fde047";
        g.font = "bold 40px monospace";
        g.fillText("1 WRONG LETTER = THE KEY", 150, 82);

        g.fillStyle = "#fee2e2";
        g.fillRect(96, 220, 832, 180);
        g.strokeStyle = "#dc2626";
        g.lineWidth = 8;
        g.strokeRect(96, 220, 832, 180);
        g.fillStyle = "#991b1b";
        g.font = "bold 92px monospace";
        g.fillText("F[A]NDATION", 172, 342);

        g.fillStyle = "#dcfce7";
        g.fillRect(96, 440, 832, 160);
        g.strokeStyle = "#0d9488";
        g.lineWidth = 6;
        g.strokeRect(96, 440, 832, 160);
        g.fillStyle = "#0f5132";
        g.font = "bold 82px monospace";
        g.fillText("F[OU]NDATION", 162, 548);

        g.fillStyle = "#92400e";
        g.font = "bold 40px monospace";
        g.fillText("SAVED HUNDREDS OF MILLIONS", 122, 740);
        g.fillStyle = "#1e40af";
        g.font = "bold 34px monospace";
        g.fillText("1 LEG QUERIED -> ~$850M STOPPED", 122, 830);
      });

    case "swift_final_collapse":
      return makeTex(id, 1024, 1024, (g) => {
        g.fillStyle = "#eef4fa";
        g.fillRect(0, 0, 1024, 1024);
        drawGrid(g, 1024, 1024, 64, "rgba(30,64,175,0.08)");
        g.strokeStyle = "#1e40af";
        g.lineWidth = 8;
        g.strokeRect(36, 36, 952, 952);

        g.fillStyle = "#1e3a8a";
        g.font = "bold 36px monospace";
        g.fillText("BANGLADESH BANK — FEB 2016", 96, 128);

        g.strokeStyle = "#64748b";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(86, 165);
        g.lineTo(938, 165);
        g.stroke();

        // Highlighted typo box
        g.fillStyle = "#fee2e2";
        g.fillRect(86, 205, 852, 165);
        g.strokeStyle = "#dc2626";
        g.lineWidth = 6;
        g.strokeRect(86, 205, 852, 165);
        g.fillStyle = "#991b1b";
        g.font = "bold 30px monospace";
        g.fillText("TYPO SPOTTED IN 1 LEG:", 118, 255);
        g.fillStyle = "#111827";
        g.font = "bold 56px monospace";
        g.fillText("FANDATION vs FOUNDATION", 118, 335);

        // Two-step causal breakdown
        g.fillStyle = "#92400e";
        g.font = "bold 30px monospace";
        g.fillText("1. DEUTSCHE QUERY : $20M RECOVERED IN FULL", 96, 465);
        g.fillStyle = "#0f766e";
        g.font = "bold 34px monospace";
        g.fillText("2. FED REVIEW     : ~$850M STOPPED", 96, 545);
        g.fillStyle = "#334155";
        g.font = "bold 30px monospace";
        g.fillText("($101M MOVED: $81M PH + $20M SL)", 96, 625);

        g.fillStyle = "#b91c1c";
        g.fillRect(86, 710, 852, 170);
        g.strokeStyle = "#7f1d1d";
        g.lineWidth = 6;
        g.strokeRect(86, 710, 852, 170);
        g.fillStyle = "#ffffff";
        g.font = "bold 46px monospace";
        g.fillText("$951M HEIST COLLAPSED", 142, 785);
        g.fillStyle = "#fde68a";
        g.font = "bold 34px monospace";
        g.fillText("1 LETTER TRIGGERED THE STOP", 142, 845);
      });

    case "sticky_note":
      return makeTex(id, 256, 256, (g) => {
        g.fillStyle = "#ffe76b";
        g.fillRect(0, 0, 256, 256);
        g.fillStyle = "#e3c432";
        g.fillRect(0, 0, 256, 36);
        g.fillStyle = "#202a36";
        g.font = "bold 28px monospace";
        g.fillText("CHECK MT103", 24, 96);
        g.fillStyle = "#a82414";
        g.font = "bold 28px monospace";
        g.fillText("FIELD 59", 24, 152);
        g.fillStyle = "#1c4a75";
        g.font = "bold 26px monospace";
        g.fillText("ROUTING", 24, 206);
      });

    case "watchtower_sign":
      return makeTex(id, 1024, 256, (g) => {
        g.fillStyle = "#1f293a";
        g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = "#ff5c38";
        g.lineWidth = 12;
        g.strokeRect(10, 10, 1004, 236);
        g.fillStyle = "#ffd166";
        g.font = "bold 48px monospace";
        g.fillText("FEDERAL RESERVE REVIEW GATE", 96, 108);
        g.fillStyle = "#ff8566";
        g.font = "bold 40px monospace";
        g.fillText("QUERY ALERT -> REVIEW REMAINING", 96, 188);
      });

    case "conduit_header_850m":
      return makeTex(id, 1024, 256, (g) => {
        g.fillStyle = "#182436";
        g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = "#ffd166";
        g.lineWidth = 10;
        g.strokeRect(10, 10, 1004, 236);
        g.fillStyle = "#ffe07d";
        g.font = "bold 48px monospace";
        g.fillText("QUEUED WIRE POOL: ~$850M", 120, 108);
        g.fillStyle = "#7cf2c8";
        g.font = "bold 36px monospace";
        g.fillText("30 REQUESTS LOCKED BY FED REVIEW", 120, 188);
      });

    case "cleared_tag_101m":
      return makeTex(id, 512, 192, (g) => {
        g.fillStyle = "#0e3b2e";
        g.fillRect(0, 0, 512, 192);
        g.strokeStyle = "#3cf2a8";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 500, 180);
        g.fillStyle = "#a8ffde";
        g.font = "bold 44px monospace";
        g.fillText("CLEARED: $101M", 54, 86);
        g.fillStyle = "#ffd875";
        g.font = "bold 30px monospace";
        g.fillText("5 REQUESTS MOVED", 84, 146);
      });

    case "board_951m":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#112238";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(100,190,255,0.14)");
        g.strokeStyle = "#f2b844";
        g.lineWidth = 10;
        g.strokeRect(16, 16, 992, 480);
        g.fillStyle = "#9ee4ff";
        g.font = "bold 38px monospace";
        g.fillText("ATTEMPTED HEIST (35 SWIFT)", 76, 102);
        g.fillStyle = "#ffd86b";
        g.font = "bold 124px monospace";
        g.fillText("$951,000,000", 66, 268);
        g.fillStyle = "#ff8566";
        g.font = "bold 38px monospace";
        g.fillText("$951 MILLION USD TARGETED", 76, 368);
        g.fillStyle = "#8ce4ff";
        g.font = "bold 30px monospace";
        g.fillText("BANGLADESH BANK  |  FEB 2016", 76, 438);
      });

    case "board_850m_saved":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0e2230";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(80,240,195,0.12)");
        g.strokeStyle = "#3cf2b8";
        g.lineWidth = 10;
        g.strokeRect(16, 16, 992, 480);
        g.fillStyle = "#ffe07d";
        g.font = "bold 36px monospace";
        g.fillText("1 LETTER SAVED HUNDREDS OF MILLIONS", 64, 88);

        g.fillStyle = "#ff8c78";
        g.font = "bold 26px monospace";
        g.fillText("1. TYPO 'FANDATION' -> DEUTSCHE QUERY -> $20M RECOVERED", 64, 178);
        g.fillStyle = "#7cf5d0";
        g.font = "bold 32px monospace";
        g.fillText("2. FED REVIEW       -> STOPPED ~$850M REST", 64, 250);

        g.fillStyle = "#144f40";
        g.fillRect(58, 305, 908, 145);
        g.strokeStyle = "#48ffbe";
        g.lineWidth = 6;
        g.strokeRect(58, 305, 908, 145);
        g.fillStyle = "#ffffff";
        g.font = "bold 50px monospace";
        g.fillText("SAVED: ~$850,000,000", 96, 375);
        g.fillStyle = "#a8ffde";
        g.font = "bold 30px monospace";
        g.fillText("($101M MOVED OF $951M ATTEMPTED)", 96, 425);
      });

    case "vault_crest":
      return makeTex(id, 1024, 192, (g) => {
        g.fillStyle = "#2b3848";
        g.fillRect(0, 0, 1024, 192);
        g.strokeStyle = "#e2b857";
        g.lineWidth = 8;
        g.strokeRect(8, 8, 1008, 176);
        g.fillStyle = "#ffe6a6";
        g.font = "bold 46px monospace";
        g.fillText("BANGLADESH BANK — CENTRAL RESERVE", 64, 112);
      });

    case "calendar_feb2016":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#f4efe6";
        g.fillRect(0, 0, 1024, 512);
        g.fillStyle = "#b82e24";
        g.fillRect(0, 0, 1024, 134);
        g.fillStyle = "#ffffff";
        g.font = "bold 46px monospace";
        g.fillText("BANGLADESH BANK — DHAKA", 160, 86);
        g.fillStyle = "#182230";
        g.font = "bold 116px monospace";
        g.fillText("FEBRUARY 2016", 62, 315);
        g.fillStyle = "#234a6e";
        g.font = "bold 38px monospace";
        g.fillText("FEB 2016  |  MOTIJHEEL HQ", 168, 430);
        g.strokeStyle = "#222933";
        g.lineWidth = 10;
        g.strokeRect(10, 10, 1004, 492);
      });

    case "calendar_jan2016":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#e8e2d5";
        g.fillRect(0, 0, 1024, 512);
        g.fillStyle = "#526275";
        g.fillRect(0, 0, 1024, 134);
        g.fillStyle = "#ffffff";
        g.font = "bold 46px monospace";
        g.fillText("BANGLADESH BANK — DHAKA", 160, 86);
        g.fillStyle = "#2d3748";
        g.font = "bold 116px monospace";
        g.fillText("JANUARY 2016", 88, 315);
      });

    case "bank_server_screen":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#122030";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(255,140,60,0.14)");
        g.fillStyle = "#5c2016";
        g.fillRect(0, 0, 1024, 96);
        g.fillStyle = "#ffd6a8";
        g.font = "bold 36px monospace";
        g.fillText("BANGLADESH BANK — CORE SERVER ROOM", 48, 62);
        g.fillStyle = "#ff5e3a";
        g.fillRect(56, 160, 912, 130);
        g.fillStyle = "#ffffff";
        g.font = "bold 54px monospace";
        g.fillText("SYSTEM BREACH : ACTIVE", 120, 244);
        g.fillStyle = "#8ce4ff";
        g.font = "bold 32px monospace";
        g.fillText("SWIFT TERMINAL GATEWAY COMPROMISED", 56, 385);
      });

    case "bank_desk_screen":
      return makeTex(id, 512, 512, (g) => {
        g.fillStyle = "#0e2238";
        g.fillRect(0, 0, 512, 512);
        drawGrid(g, 512, 512, 48, "rgba(80,200,255,0.16)");
        g.fillStyle = "#194266";
        g.fillRect(0, 0, 512, 80);
        g.fillStyle = "#9ae8ff";
        g.font = "bold 30px monospace";
        g.fillText("FX OPS MONITOR", 32, 52);
        g.fillStyle = "#7cf2c8";
        g.font = "bold 28px monospace";
        g.fillText("SWIFTNET: ONLINE", 32, 175);
        g.fillText("NY FED LINK: READY", 32, 245);
        g.fillStyle = "#ffd875";
        g.fillText("DHAKA CENTRAL", 32, 345);
      });

    case "hacker_intrusion_screen":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0c1b28";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 48, "rgba(54,230,210,0.14)");
        g.fillStyle = "#133a4e";
        g.fillRect(0, 0, 1024, 88);
        g.fillStyle = "#48f2d8";
        g.font = "bold 36px monospace";
        g.fillText("TARGET: BANGLADESH CENTRAL BANK", 48, 58);
        g.fillStyle = "#ff7854";
        g.font = "bold 46px monospace";
        g.fillText("ROOT ACCESS : GRANTED", 48, 195);
        g.fillStyle = "#a8ecff";
        g.font = "bold 32px monospace";
        g.fillText(">> INJECT SWIFT ALLIANCE HOOK", 48, 295);
        g.fillText(">> BYPASS PRINTER SPOOLER", 48, 365);
      });

    case "hacker_months_board":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#edf3fa";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(30,74,154,0.09)");
        g.fillStyle = "#173d68";
        g.fillRect(0, 0, 1024, 92);
        g.fillStyle = "#ffffff";
        g.font = "bold 34px monospace";
        g.fillText("SURVEILLANCE LOG — BANGLADESH BANK", 48, 60);

        const months = ["NOV 2015", "DEC 2015", "JAN 2016", "FEB 2016"];
        months.forEach((m, i) => {
          const x = 44 + i * 240;
          const active = i === 3;
          g.fillStyle = active ? "#dc2626" : "#1e40af";
          g.fillRect(x, 165, 214, 128);
          g.strokeStyle = active ? "#fbbf24" : "#60a5fa";
          g.lineWidth = 6;
          g.strokeRect(x, 165, 214, 128);
          g.fillStyle = "#ffffff";
          g.font = "bold 34px monospace";
          g.fillText(m, x + 22, 242);
        });

        g.fillStyle = "#92400e";
        g.font = "bold 36px monospace";
        g.fillText("MONTHS INSIDE — MAPPING EVERY DETAIL", 58, 415);
      });

    case "hacker_strategy_board":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#eef5fc";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 48, "rgba(30,74,154,0.10)");
        g.strokeStyle = "#1e40af";
        g.lineWidth = 10;
        g.strokeRect(12, 12, 1000, 488);
        g.fillStyle = "#173c68";
        g.fillRect(12, 12, 1000, 96);
        g.fillStyle = "#fde047";
        g.font = "bold 40px monospace";
        g.fillText("OPERATION: BIG STRIKE ($951M)", 56, 76);
        g.fillStyle = "#0f5132";
        g.font = "bold 36px monospace";
        g.fillText("1. DISABLE PRINTERS", 56, 195);
        g.fillText("2. STRIKE THURSDAY NIGHT", 56, 285);
        g.fillStyle = "#b91c1c";
        g.fillText("3. SEND 35 SWIFT TRANSFERS", 56, 375);
      });

    case "hacker_35_counter":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0e1d2e";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(65,220,255,0.14)");
        g.fillStyle = "#183e60";
        g.fillRect(0, 0, 1024, 92);
        g.fillStyle = "#9ee8ff";
        g.font = "bold 34px monospace";
        g.fillText("SWIFTNET DISPATCH — FAKE MT103", 56, 60);

        g.fillStyle = "#132c45";
        g.fillRect(56, 136, 912, 220);
        g.strokeStyle = "#ffb038";
        g.lineWidth = 8;
        g.strokeRect(56, 136, 912, 220);

        g.fillStyle = "#ffd875";
        g.font = "bold 46px monospace";
        g.fillText("REQUESTS :", 92, 265);
        g.fillStyle = "#ff5a36";
        g.font = "bold 124px monospace";
        g.fillText("35 / 35", 412, 286);

        g.fillStyle = "#48f2b8";
        g.font = "bold 38px monospace";
        g.fillText("STATUS: TRANSMITTED ($951M)", 92, 445);
      });

    case "hacker_victory_screen":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#0e222e";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(80,240,180,0.14)");
        g.fillStyle = "#144d42";
        g.fillRect(0, 0, 1024, 96);
        g.fillStyle = "#a8ffde";
        g.font = "bold 40px monospace";
        g.fillText("BATCH STATUS: 35 REQUESTS SENT", 56, 64);
        g.fillStyle = "#4cf5b8";
        g.font = "bold 88px monospace";
        g.fillText("$101M CLEARED", 110, 265);
        g.fillStyle = "#ffe07d";
        g.font = "bold 38px monospace";
        g.fillText("AWAITING FINAL SETTLEMENT...", 110, 395);
      });

    case "hacker_warn_dot":
      return makeTex(id, 512, 256, (g) => {
        g.fillStyle = "#3b1214";
        g.fillRect(0, 0, 512, 256);
        g.strokeStyle = "#ff4438";
        g.lineWidth = 10;
        g.strokeRect(10, 10, 492, 236);
        g.fillStyle = "#ffd166";
        g.font = "bold 36px monospace";
        g.fillText("ROUTING ALERT:", 42, 92);
        g.fillStyle = "#ff7a66";
        g.font = "bold 40px monospace";
        g.fillText("1 QUERY PENDING!", 42, 178);
      });

    case "hacker_timezone_clocks":
      return makeTex(id, 1024, 256, (g) => {
        g.fillStyle = "#1c2636";
        g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = "#52749e";
        g.lineWidth = 8;
        g.strokeRect(8, 8, 1008, 240);
        const zones = [
          ["DHAKA", "22:00"],
          ["NEW YORK", "11:00"],
          ["FRANKFURT", "17:00"],
          ["MANILA", "00:00"],
        ];
        zones.forEach(([city, tm], i) => {
          const x = 32 + i * 246;
          g.fillStyle = "#26364d";
          g.fillRect(x, 32, 224, 192);
          g.fillStyle = "#9fd4ff";
          g.font = "bold 26px monospace";
          g.fillText(city, x + 22, 86);
          g.fillStyle = "#ffd875";
          g.font = "bold 52px monospace";
          g.fillText(tm, x + 26, 168);
        });
      });

    case "printer_lcd":
      return makeTex(id, 512, 256, (g) => {
        g.fillStyle = "#481010";
        g.fillRect(0, 0, 512, 256);
        g.strokeStyle = "#ff4438";
        g.lineWidth = 10;
        g.strokeRect(8, 8, 496, 240);
        g.fillStyle = "#ffcf54";
        g.font = "bold 36px monospace";
        g.fillText("PRINTER OFFLINE", 66, 98);
        g.fillStyle = "#ffffff";
        g.font = "bold 34px monospace";
        g.fillText("SPOOLER ERROR!", 84, 174);
      });

    case "printer_spooler_wall":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#182230";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(255,95,80,0.14)");
        g.fillStyle = "#6e1818";
        g.fillRect(0, 0, 1024, 106);
        g.fillStyle = "#ffffff";
        g.font = "bold 40px monospace";
        g.fillText("SWIFT CONFIRMATION PRINTERS", 56, 68);

        g.fillStyle = "#ff5a44";
        g.fillRect(56, 155, 912, 136);
        g.fillStyle = "#ffffff";
        g.font = "bold 52px monospace";
        g.fillText("DISABLED BY MALWARE", 150, 242);

        g.fillStyle = "#ffd875";
        g.font = "bold 38px monospace";
        g.fillText("QUEUE: 35 TRANSFERS | 0 PRINTED", 76, 405);
      });

    case "printer_notice":
      return makeTex(id, 512, 512, (g) => {
        g.fillStyle = "#f4efe4";
        g.fillRect(0, 0, 512, 512);
        g.strokeStyle = "#3b4c63";
        g.lineWidth = 12;
        g.strokeRect(14, 14, 484, 484);
        g.fillStyle = "#1c385a";
        g.fillRect(14, 14, 484, 104);
        g.fillStyle = "#ffffff";
        g.font = "bold 32px monospace";
        g.fillText("BANK SECURITY NOTICE", 56, 78);
        g.fillStyle = "#1e293b";
        g.font = "bold 30px monospace";
        g.fillText("CHECK PRINTED", 64, 210);
        g.fillText("SWIFT LOGS HOURLY", 64, 270);
        g.fillStyle = "#b82c24";
        g.font = "bold 34px monospace";
        g.fillText("NO PAPER = NO ALERT", 56, 385);
      });

    case "thursday_night_clock":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#192540";
        g.fillRect(0, 0, 1024, 512);
        g.strokeStyle = "#ffae42";
        g.lineWidth = 12;
        g.strokeRect(14, 14, 996, 484);
        g.fillStyle = "#ffd475";
        g.font = "bold 72px monospace";
        g.fillText("THURSDAY NIGHT", 130, 168);
        g.fillStyle = "#ffae42";
        g.font = "bold 96px monospace";
        g.fillText("22:00 BDT", 190, 315);
        g.fillStyle = "#a8d4ff";
        g.font = "bold 38px monospace";
        g.fillText("DHAKA — BANK CLOSED / ASLEEP", 120, 425);
      });

    case "bank_plaza_sign":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#22344d";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#f2c14e";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 500, 116);
        g.fillStyle = "#ffe8a3";
        g.font = "bold 34px monospace";
        g.fillText("BANGLADESH BANK", 84, 78);
      });

    case "world_map_header":
      return makeTex(id, 1024, 256, (g) => {
        g.fillStyle = "#eef4fb";
        g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = "#1e40af";
        g.lineWidth = 10;
        g.strokeRect(8, 8, 1008, 240);
        g.fillStyle = "#173c68";
        g.font = "bold 42px monospace";
        g.fillText("ROUTED DESTINATION ACCOUNTS", 124, 102);
        g.fillStyle = "#b45309";
        g.font = "bold 48px monospace";
        g.fillText("PHILIPPINES  &  SRI LANKA", 128, 188);
      });

    case "board_101m_moved":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#edf6f4";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(13,148,136,0.10)");
        g.strokeStyle = "#0d9488";
        g.lineWidth = 10;
        g.strokeRect(16, 16, 992, 480);
        g.fillStyle = "#0f5132";
        g.font = "bold 36px monospace";
        g.fillText("TRANSFERS ACTUALLY CLEARED (5)", 72, 104);
        g.fillStyle = "#047857";
        g.font = "bold 124px monospace";
        g.fillText("$101,000,000", 64, 272);
        g.fillStyle = "#92400e";
        g.font = "bold 42px monospace";
        g.fillText("STATUS: $101M USD MOVED", 72, 396);
        g.fillStyle = "#991b1b";
        g.font = "bold 32px monospace";
        g.fillText("$20M SRI LANKA LEG REVERSED - NET STOLEN $81M", 72, 458);
      });

    case "board_81_20_split":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#eef4fb";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 64, "rgba(30,74,154,0.09)");
        g.strokeStyle = "#1e40af";
        g.lineWidth = 10;
        g.strokeRect(16, 16, 992, 480);
        g.fillStyle = "#173c68";
        g.font = "bold 36px monospace";
        g.fillText("MOVED FUNDS BREAKDOWN = $101M", 96, 96);

        g.fillStyle = "#dcfce7";
        g.fillRect(56, 145, 435, 290);
        g.strokeStyle = "#0d9488";
        g.lineWidth = 6;
        g.strokeRect(56, 145, 435, 290);
        g.fillStyle = "#047857";
        g.font = "bold 96px monospace";
        g.fillText("$81M", 130, 278);
        g.fillStyle = "#111827";
        g.font = "bold 36px monospace";
        g.fillText("PHILIPPINES", 118, 378);

        g.fillStyle = "#fef3c7";
        g.fillRect(533, 145, 435, 290);
        g.strokeStyle = "#d97706";
        g.lineWidth = 6;
        g.strokeRect(533, 145, 435, 290);
        g.fillStyle = "#b45309";
        g.font = "bold 96px monospace";
        g.fillText("$20M", 610, 278);
        g.fillStyle = "#111827";
        g.font = "bold 36px monospace";
        g.fillText("SRI LANKA", 618, 378);
      });

    case "tag_ph_81m":
      return makeTex(id, 512, 192, (g) => {
        g.fillStyle = "#0e3d30";
        g.fillRect(0, 0, 512, 192);
        g.strokeStyle = "#3cf2b8";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 500, 180);
        g.fillStyle = "#4cf5b8";
        g.font = "bold 62px monospace";
        g.fillText("$81M", 162, 84);
        g.fillStyle = "#ffffff";
        g.font = "bold 38px monospace";
        g.fillText("PHILIPPINES", 116, 148);
      });

    case "tag_sl_20m":
      return makeTex(id, 512, 192, (g) => {
        g.fillStyle = "#4a2810";
        g.fillRect(0, 0, 512, 192);
        g.strokeStyle = "#ffae42";
        g.lineWidth = 8;
        g.strokeRect(6, 6, 500, 180);
        g.fillStyle = "#ffd166";
        g.font = "bold 62px monospace";
        g.fillText("$20M", 162, 84);
        g.fillStyle = "#ffffff";
        g.font = "bold 38px monospace";
        g.fillText("SRI LANKA", 140, 148);
      });

    case "tag_ph_node":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#0f3832";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#3cf2b8";
        g.lineWidth = 6;
        g.strokeRect(5, 5, 502, 118);
        g.fillStyle = "#a8ffde";
        g.font = "bold 34px monospace";
        g.fillText("MANILA — PHILIPPINES", 38, 76);
      });

    case "tag_sl_node":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#3b2410";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#ffae42";
        g.lineWidth = 6;
        g.strokeRect(5, 5, 502, 118);
        g.fillStyle = "#ffe0a3";
        g.font = "bold 34px monospace";
        g.fillText("COLOMBO — SRI LANKA", 38, 76);
      });

    case "tag_dhaka_node":
      return makeTex(id, 512, 128, (g) => {
        g.fillStyle = "#162d48";
        g.fillRect(0, 0, 512, 128);
        g.strokeStyle = "#ffd166";
        g.lineWidth = 6;
        g.strokeRect(5, 5, 502, 118);
        g.fillStyle = "#ffd875";
        g.font = "bold 34px monospace";
        g.fillText("DHAKA / NY SOURCE", 68, 76);
      });

    case "deutsche_wall_header":
      return makeTex(id, 1024, 256, (g) => {
        g.fillStyle = "#183f82";
        g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = "#ffffff";
        g.lineWidth = 8;
        g.strokeRect(10, 10, 1004, 236);
        // Iconic square-and-slash graphic emblem
        g.strokeRect(46, 52, 152, 152);
        g.lineWidth = 18;
        g.beginPath();
        g.moveTo(76, 174);
        g.lineTo(168, 82);
        g.stroke();
        g.fillStyle = "#ffffff";
        g.font = "bold 54px monospace";
        g.fillText("DEUTSCHE BANK", 242, 118);
        g.fillStyle = "#a8d8ff";
        g.font = "bold 32px monospace";
        g.fillText("FRANKFURT ROUTING DESK", 242, 186);
      });

    case "deutsche_screen_spot":
      return makeTex(id, 1024, 768, (g) => {
        g.fillStyle = "#f2f5fa";
        g.fillRect(0, 0, 1024, 768);
        g.fillStyle = "#1e4a9a";
        g.fillRect(0, 0, 1024, 116);
        g.fillStyle = "#ffffff";
        g.font = "bold 38px monospace";
        g.fillText("DEUTSCHE BANK — COMPLIANCE", 48, 74);

        g.fillStyle = "#1c2838";
        g.font = "bold 32px monospace";
        g.fillText("SWIFT MT103 : SRI LANKA LEG", 48, 200);

        g.fillStyle = "#fff1f0";
        g.fillRect(48, 250, 928, 220);
        g.strokeStyle = "#dc2626";
        g.lineWidth = 8;
        g.strokeRect(48, 250, 928, 220);

        g.fillStyle = "#b91c1c";
        g.font = "bold 34px monospace";
        g.fillText("[ ! ] SPELLING ANOMALY SPOTTED", 80, 315);
        g.fillStyle = "#111827";
        g.font = "bold 58px monospace";
        g.fillText("SHALIKA FANDATION", 80, 415);

        g.fillStyle = "#0f5132";
        g.font = "bold 36px monospace";
        g.fillText("REGISTRY: SHALIKA FOUNDATION", 48, 575);
        g.fillStyle = "#b45309";
        g.font = "bold 34px monospace";
        g.fillText("ACTION REQUIRED : QUERY TRANSFER", 48, 665);
      });

    case "deutsche_query_halt":
      return makeTex(id, 1024, 768, (g) => {
        g.fillStyle = "#f2f5fa";
        g.fillRect(0, 0, 1024, 768);
        g.fillStyle = "#1e4a9a";
        g.fillRect(0, 0, 1024, 116);
        g.fillStyle = "#ffffff";
        g.font = "bold 38px monospace";
        g.fillText("DEUTSCHE BANK — ROUTING ACTION", 48, 74);

        g.fillStyle = "#1e293b";
        g.font = "bold 34px monospace";
        g.fillText("INQUIRY SENT -> BANGLADESH BANK", 48, 210);
        g.fillText("TARGET : 'SHALIKA FANDATION' ($20M)", 48, 285);

        g.fillStyle = "#b91c1c";
        g.fillRect(48, 365, 928, 210);
        g.strokeStyle = "#7f1d1d";
        g.lineWidth = 8;
        g.strokeRect(48, 365, 928, 210);
        g.fillStyle = "#ffffff";
        g.font = "bold 54px monospace";
        g.fillText("TRANSFER QUERIED", Math.round((1024 - g.measureText("TRANSFER QUERIED").width) / 2), 455);
        g.fillStyle = "#fde68a";
        g.font = "bold 36px monospace";
        g.fillText("QUERY DISPATCHED TO FED REVIEW", 118, 530);

        g.fillStyle = "#1e4a9a";
        g.font = "bold 30px monospace";
        g.fillText("$20M SRI LANKA LEG RECOVERED IN FULL", 48, 675);
      });

    case "deutsche_registry_book":
      return makeTex(id, 512, 512, (g) => {
        g.fillStyle = "#f7f3ea";
        g.fillRect(0, 0, 512, 512);
        g.fillStyle = "#1e4a9a";
        g.fillRect(0, 0, 512, 86);
        g.fillStyle = "#ffffff";
        g.font = "bold 28px monospace";
        g.fillText("NGO REGISTRY BOOK", 44, 54);
        g.fillStyle = "#1c2838";
        g.font = "bold 28px monospace";
        g.fillText("VALID ENTITY:", 36, 165);
        g.fillStyle = "#0f5132";
        g.font = "bold 32px monospace";
        g.fillText("SHALIKA FOUNDATION", 36, 225);
        g.fillStyle = "#b91c1c";
        g.font = "bold 28px monospace";
        g.fillText("NOT 'FANDATION'", 36, 320);
      });

    case "fed_wall_header":
      return makeTex(id, 1024, 256, (g) => {
        g.fillStyle = "#1a283c";
        g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = "#d9ad54";
        g.lineWidth = 10;
        g.strokeRect(10, 10, 1004, 236);
        g.fillStyle = "#ffe5a3";
        g.font = "bold 50px monospace";
        g.fillText("FEDERAL RESERVE BANK", 172, 104);
        g.fillStyle = "#9fd4ff";
        g.font = "bold 34px monospace";
        g.fillText("WIRE REVIEW & RISK OPERATIONS", 168, 182);
      });

    case "fed_review_matrix":
      return makeTex(id, 1024, 768, (g) => {
        g.fillStyle = "#0d1a2c";
        g.fillRect(0, 0, 1024, 768);
        g.fillStyle = "#183b62";
        g.fillRect(0, 0, 1024, 128);
        g.fillStyle = "#ffd166";
        g.font = "bold 36px monospace";
        g.fillText("ALERT: DEUTSCHE BANK QUERY FLAG", 48, 56);
        g.fillStyle = "#9ef5ff";
        g.font = "bold 30px monospace";
        g.fillText("REVIEWING REMAINING 30 REQUESTS (~$850M)", 48, 104);

        const cols = 6;
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = 44 + c * 158;
            const y = 160 + r * 108;
            g.fillStyle = "#3b2c12";
            g.fillRect(x, y, 140, 88);
            g.strokeStyle = "#ffbe3b";
            g.lineWidth = 4;
            g.strokeRect(x, y, 140, 88);
            g.fillStyle = "#ffe6a6";
            g.font = "bold 24px monospace";
            g.fillText(`#${r * cols + c + 6}`, x + 14, y + 36);
            g.fillStyle = "#ffcf54";
            g.font = "bold 20px monospace";
            g.fillText("AUDITING", x + 14, y + 70);
          }
        }
      });

    case "fed_stopped_board":
      return makeTex(id, 1024, 768, (g) => {
        g.fillStyle = "#fdf2f2";
        g.fillRect(0, 0, 1024, 768);
        g.fillStyle = "#b91c1c";
        g.fillRect(0, 0, 1024, 142);
        g.fillStyle = "#ffffff";
        g.font = "bold 40px monospace";
        g.fillText("FED IMMEDIATE STOP ORDER", 48, 62);
        g.fillStyle = "#fde68a";
        g.font = "bold 34px monospace";
        g.fillText("30 REQUESTS HALTED | ~$850M SAVED", 48, 116);

        const cols = 6;
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = 44 + c * 158;
            const y = 172 + r * 106;
            g.fillStyle = "#dc2626";
            g.fillRect(x, y, 140, 86);
            g.strokeStyle = "#7f1d1d";
            g.lineWidth = 4;
            g.strokeRect(x, y, 140, 86);
            g.fillStyle = "#ffffff";
            g.font = "bold 22px monospace";
            g.fillText(`#${r * cols + c + 6}`, x + 14, y + 34);
            g.fillStyle = "#fef08a";
            g.font = "bold 22px monospace";
            g.fillText("STOPPED", x + 14, y + 68);
          }
        }
      });

    case "fed_wing_left":
      return makeTex(id, 512, 256, (g) => {
        g.fillStyle = "#142234";
        g.fillRect(0, 0, 512, 256);
        g.strokeStyle = "#ff8552";
        g.lineWidth = 8;
        g.strokeRect(8, 8, 496, 240);
        g.fillStyle = "#ffd166";
        g.font = "bold 32px monospace";
        g.fillText("TRIGGER FLAG:", 36, 86);
        g.fillStyle = "#ffffff";
        g.font = "bold 30px monospace";
        g.fillText("DEUTSCHE QUERY ON", 36, 146);
        g.fillStyle = "#ff8566";
        g.fillText("'FANDATION' LEG", 36, 198);
      });

    case "fed_wing_right":
      return makeTex(id, 512, 256, (g) => {
        g.fillStyle = "#142234";
        g.fillRect(0, 0, 512, 256);
        g.strokeStyle = "#3cf2b8";
        g.lineWidth = 8;
        g.strokeRect(8, 8, 496, 240);
        g.fillStyle = "#a8ffde";
        g.font = "bold 32px monospace";
        g.fillText("REMAINING QUEUE:", 36, 86);
        g.fillStyle = "#ffd875";
        g.font = "bold 44px monospace";
        g.fillText("~$850M", 36, 154);
        g.fillStyle = "#ff7866";
        g.font = "bold 30px monospace";
        g.fillText("FROZEN IMMEDIATELY", 36, 208);
      });

    case "terrazzo_floor":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#959ea8";
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 64) {
          for (let x = 0; x < 512; x += 64) {
            g.fillStyle = ((x + y) / 64) % 2 === 0 ? "#a1aab4" : "#8f98a2";
            g.fillRect(x + 2, y + 2, 60, 60);
          }
        }
        for (let i = 0; i < 360; i++) {
          g.fillStyle = i % 3 === 0 ? "rgba(240,235,220,0.28)" : "rgba(60,68,78,0.18)";
          g.fillRect(r() * 512, r() * 512, 3 + r() * 4, 3 + r() * 4);
        }
      }, true);

    case "sandstone_wall":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#dfd5c4";
        g.fillRect(0, 0, 512, 512);
        for (let x = 0; x < 512; x += 128) {
          g.fillStyle = x % 256 === 0 ? "#e4dac9" : "#d9cebc";
          g.fillRect(x + 2, 0, 124, 512);
          g.fillStyle = "#bfb29c";
          g.fillRect(x, 0, 3, 512);
        }
        for (let i = 0; i < 380; i++) {
          g.fillStyle = "rgba(110,96,76,0.08)";
          g.fillRect(r() * 512, r() * 512, 4, 3);
        }
      }, true);

    case "loft_brick":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#b5a090";
        g.fillRect(0, 0, 512, 512);
        for (let row = 0; row < 16; row++) {
          const y = row * 32;
          const off = (row % 2) * 32;
          for (let col = -1; col < 9; col++) {
            const x = col * 64 + off;
            const shade = Math.floor(r() * 18) - 9;
            g.fillStyle = `rgb(${194 + shade},${166 + shade},${146 + shade})`;
            g.fillRect(x + 2, y + 2, 60, 28);
          }
        }
      }, true);

    case "loft_timber":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#c4a88a";
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 32) {
          g.fillStyle = (y / 32) % 2 === 0 ? "#ccb092" : "#bc9e80";
          g.fillRect(0, y + 2, 512, 28);
          g.strokeStyle = "rgba(95,68,42,0.18)";
          g.beginPath();
          g.moveTo(0, y + 14 + r() * 6);
          g.lineTo(512, y + 14 + r() * 6);
          g.stroke();
        }
      }, true);

    case "office_parquet":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#c9a87e";
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 32) {
          g.fillStyle = (y / 32) % 2 === 0 ? "#cfa982" : "#be986e";
          g.fillRect(0, y + 2, 512, 28);
          g.strokeStyle = "rgba(110,72,38,0.2)";
          g.beginPath();
          g.moveTo(0, y + 12 + r() * 8);
          g.lineTo(512, y + 12 + r() * 8);
          g.stroke();
        }
      }, true);

    case "limestone_wall":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#ded6c8";
        g.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 128) {
          g.fillStyle = "#c4b9a6";
          g.fillRect(0, y, 512, 4);
        }
        for (let i = 0; i < 320; i++) {
          g.fillStyle = "rgba(100,90,74,0.08)";
          g.fillRect(r() * 512, r() * 512, 4, 4);
        }
      }, true);

    case "fed_carpet":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#62707e";
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 650; i++) {
          g.fillStyle = i % 2 === 0 ? "rgba(130,148,166,0.22)" : "rgba(70,80,92,0.22)";
          g.fillRect(r() * 512, r() * 512, 4, 4);
        }
      }, true);

    case "night_sky":
      return makeTex(id, 1024, 512, (g, r) => {
        const grd = g.createLinearGradient(0, 0, 0, 512);
        grd.addColorStop(0, "#2c3f6b");
        grd.addColorStop(0.55, "#42598a");
        grd.addColorStop(1, "#54699c");
        g.fillStyle = grd;
        g.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 24; i++) {
          g.fillStyle = "rgba(140,168,220,0.16)";
          g.beginPath();
          g.ellipse(r() * 1024, 140 + r() * 240, 80 + r() * 120, 16 + r() * 20, 0, 0, Math.PI * 2);
          g.fill();
        }
        for (let i = 0; i < 160; i++) {
          g.fillStyle = i % 5 === 0 ? "#fff6cc" : "#e8f2ff";
          const sz = i % 9 === 0 ? 3 : 1.8;
          g.fillRect(r() * 1024, r() * 340, sz, sz);
        }
      });

    case "dhaka_road":
      return makeTex(id, 512, 512, (g, r) => {
        g.fillStyle = "#3c4352";
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 420; i++) {
          g.fillStyle = i % 2 === 0 ? "rgba(95,105,120,0.22)" : "rgba(42,48,58,0.25)";
          g.fillRect(r() * 512, r() * 512, 5, 5);
        }
        g.fillStyle = "#e6c24c";
        for (let y = 16; y < 512; y += 64) {
          g.fillRect(248, y, 16, 36);
        }
      }, true);

    case "world_ocean_grid":
      return makeTex(id, 1024, 512, (g) => {
        g.fillStyle = "#4886bf";
        g.fillRect(0, 0, 1024, 512);
        drawGrid(g, 1024, 512, 48, "rgba(215,245,255,0.32)");
        g.strokeStyle = "rgba(235,248,255,0.55)";
        g.lineWidth = 4;
        g.strokeRect(10, 10, 1004, 492);
      });

    case "currency_wrap":
      return makeTex(id, 256, 256, (g) => {
        g.fillStyle = "#5c9e64";
        g.fillRect(0, 0, 256, 256);
        g.fillStyle = "#e8d682";
        g.fillRect(0, 88, 256, 80);
        g.fillStyle = "#1c3820";
        g.font = "bold 46px monospace";
        g.fillText("$100", 66, 144);
        g.strokeStyle = "#325c38";
        g.lineWidth = 6;
        g.strokeRect(6, 6, 244, 244);
      });
  }
}

// ---------------- 3D Ribbon Line Builder ----------------
export const RibbonLine: React.FC<{
  points: V3[];
  width?: number;
  color: string;
  opacity?: number;
}> = ({ points, width = 0.06, color, opacity = 1 }) => {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, Math.max(16, points.length * 8), width * 0.5, 6, false);
  }, [points, width]);

  const mat = useMemo(
    () =>
      basicMat(`rib_${color}_${opacity.toFixed(2)}`, () => ({
        color,
        transparent: opacity < 1,
        opacity,
        toneMapped: false,
      })),
    [color, opacity],
  );

  return h("mesh", {
    geometry: geo,
    material: mat,
    onUpdate: (self: THREE.Mesh) => self.layers.set(NOINK),
  });
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
  screenTex = "bank_desk_screen",
  screenDark = false,
  hasBinder = true,
  hasMug = true,
  binderColor = "#2a629a",
}) => {
  const deskTopMat = useMemo(() => toonLam("desk_top", () => ({ color: "#d5cbb8" })), []);
  const deskBodyMat = useMemo(() => toonLam("desk_body", () => ({ color: "#44586e" })), []);
  const bezelMat = useMemo(() => toonLam("mon_bezel", () => ({ color: "#cfd6df" })), []);
  const keyMat = useMemo(() => toonLam("kb_mat", () => ({ color: "#e5e0d4" })), []);
  const binderMat = useMemo(
    () => toonLam(`binder_${binderColor}`, () => ({ color: binderColor })),
    [binderColor],
  );
  const mugMat = useMemo(() => toonLam("mug_white", () => ({ color: "#f2efe8" })), []);
  const screenMat = useMemo(
    () =>
      screenDark
        ? basicMat("mon_off", () => ({ color: "#141c24" }))
        : basicMat(`mon_${screenTex}`, () => ({
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
    // Dual monitors on desk
    ...[-0.28, 0.28].map((mx, idx) =>
      h(
        "group",
        { key: `dm-${idx}`, position: [mx, 1.02, -0.14], rotation: [0, mx < 0 ? 0.14 : -0.14, 0] },
        h("mesh", { material: bezelMat, position: [0, -0.18, -0.02] }, h("cylinderGeometry", { args: [0.03, 0.05, 0.18, 10] })),
        h("mesh", { material: bezelMat, castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.50, 0.38, 0.06] })),
        h("mesh", { material: screenMat, position: [0, 0, 0.034], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("planeGeometry", { args: [0.45, 0.33] })),
      ),
    ),
    h("mesh", { material: keyMat, position: [-0.06, 0.795, 0.2], castShadow: true }, h("boxGeometry", { args: [0.46, 0.025, 0.16] })),
    h("mesh", { material: bezelMat, position: [0.28, 0.795, 0.2], castShadow: true }, h("boxGeometry", { args: [0.1, 0.028, 0.13] })),
    hasBinder ? h("mesh", { material: binderMat, position: [-0.48, 0.805, 0.16], rotation: [0, 0.18, 0], castShadow: true }, h("boxGeometry", { args: [0.24, 0.045, 0.30] })) : null,
    hasMug ? h("mesh", { material: mugMat, position: [0.48, 0.83, 0.16], castShadow: true }, h("cylinderGeometry", { args: [0.042, 0.038, 0.10, 14] })) : null,
  );
};

// ---------------- Server Rack Unit ----------------
export const ServerRackUnit: React.FC<{
  position: V3;
  rotationY?: number;
  breachProg?: number;
  frame?: number;
  seedOffset?: number;
}> = ({ position, rotationY = 0, breachProg = 0, frame = 0, seedOffset = 0 }) => {
  const frameMat = useMemo(() => toonLam("srv_frame", () => ({ color: "#2f3a48" })), []);
  const glassMat = useMemo(
    () => basicMat("srv_glass", () => ({ color: "#88c4e8", transparent: true, opacity: 0.24 })),
    [],
  );
  const calmLedMat = useMemo(() => basicMat("srv_led_calm", () => ({ color: "#3cf2b8", toneMapped: false })), []);
  const breachLedMat = useMemo(() => basicMat("srv_led_breach", () => ({ color: "#ff5736", toneMapped: false })), []);
  const offLedMat = useMemo(() => basicMat("srv_led_off", () => ({ color: "#1c2632" })), []);

  return h(
    "group",
    { position, rotation: [0, rotationY, 0] },
    h("mesh", { material: frameMat, position: [0, 1.35, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.05, 2.7, 0.85] })),
    h("mesh", { material: glassMat, position: [0, 1.35, 0.435], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("planeGeometry", { args: [0.88, 2.4] })),
    ...[0, 1, 2, 3, 4, 5].map((row) => {
      const rowNorm = row / 5;
      const breached = breachProg > rowNorm;
      const pulse = ((frame >> 2) + row + seedOffset) % 2 === 0;
      const ledMat = breached ? (pulse ? breachLedMat : offLedMat) : pulse ? calmLedMat : offLedMat;
      return h(
        "group",
        { key: `slot-${row}`, position: [0, 0.45 + row * 0.36, 0.44] },
        h("mesh", { material: frameMat }, h("boxGeometry", { args: [0.82, 0.16, 0.04] })),
        h("mesh", { material: ledMat, position: [-0.26, 0, 0.025], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("boxGeometry", { args: [0.16, 0.045, 0.02] })),
        h("mesh", { material: breached ? breachLedMat : calmLedMat, position: [0.22, 0, 0.025], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("boxGeometry", { args: [0.22, 0.035, 0.02] })),
      );
    }),
  );
};

// ---------------- Swift Terminal Unit (9:16 Frustum-Fitted) ----------------
export const SwiftTerminalUnit: React.FC<{
  position?: V3;
  screenTex: DiegeticTexId;
}> = ({ position = [0, 1.25, 0], screenTex }) => {
  const bezelMat = useMemo(() => toonLam("swift_bezel", () => ({ color: "#cfd8e3" })), []);
  const trimMat = useMemo(() => toonLam("swift_trim", () => ({ color: "#4e5d70" })), []);
  const screenMat = useMemo(
    () =>
      basicMat(`swift_scr_${screenTex}`, () => ({
        map: getDiegeticTexture(screenTex),
        toneMapped: false,
      })),
    [screenTex],
  );
  const stickyMat = useMemo(
    () => basicMat("swift_sticky", () => ({ map: getDiegeticTexture("sticky_note"), toneMapped: false })),
    [],
  );

  // 0.56m x 0.56m screen inside 0.64m bezel — verified uncropped in 9:16 down to z=1.44m
  return h(
    "group",
    { position },
    h("mesh", { material: bezelMat, position: [0, 0, -0.07], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.64, 0.64, 0.12] })),
    h("mesh", { material: trimMat, position: [0, -0.39, -0.06], castShadow: true }, h("cylinderGeometry", { args: [0.06, 0.09, 0.24, 14] })),
    h("mesh", { material: trimMat, position: [0, -0.51, -0.02], castShadow: true }, h("boxGeometry", { args: [0.34, 0.03, 0.26] })),
    h("mesh", { material: screenMat, position: [0, 0, 0.002], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("planeGeometry", { args: [0.56, 0.56] })),
    h("mesh", { material: stickyMat, position: [-0.28, -0.28, 0.012], rotation: [0, 0, 0.08], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("planeGeometry", { args: [0.09, 0.09] })),
  );
};

// ---------------- Currency & Gold Reserve Pallet ----------------
export const CurrencyPallet: React.FC<{
  position: V3;
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => {
  const woodMat = useMemo(() => toonLam("pal_wood", () => ({ color: "#8c6642" })), []);
  const cashMat = useMemo(
    () => toonLam("pal_cash", () => ({ map: getDiegeticTexture("currency_wrap") })),
    [],
  );
  const goldMat = useMemo(() => toonLam("pal_gold", () => ({ color: "#f2c14e" })), []);

  return h(
    "group",
    { position, rotation: [0, rotationY, 0] },
    h("mesh", { material: woodMat, position: [0, 0.06, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.05, 0.12, 0.85] })),
    ...[0, 1].flatMap((row) =>
      [-0.25, 0.25].map((cx, ci) =>
        h("mesh", { key: `cb-${row}-${ci}`, material: row === 0 ? cashMat : goldMat, position: [cx, 0.26 + row * 0.26, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.42, 0.24, 0.68] })),
      ),
    ),
  );
};

// ---------------- World Map Parabolic Money-Flow Arc ----------------
export const WorldMapArc: React.FC<{
  start: V3;
  end: V3;
  peakY: number;
  color: string;
  progress: number;
  packetCount?: number;
}> = ({ start, end, peakY, color, progress, packetCount = 4 }) => {
  const pts = useMemo<V3[]>(() => {
    const out: V3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = start[0] + (end[0] - start[0]) * t;
      const z = start[2] + (end[2] - start[2]) * t;
      const y = start[1] + (end[1] - start[1]) * t + Math.sin(t * Math.PI) * peakY;
      out.push([x, y, z]);
    }
    return out;
  }, [start, end, peakY]);

  const pktMat = useMemo(() => basicMat(`arc_pkt_${color}`, () => ({ color: "#ffd86b", toneMapped: false })), [color]);

  return h(
    "group",
    null,
    h(RibbonLine, { points: pts, width: 0.048, color }),
    ...Array.from({ length: packetCount }, (_, idx) => {
      const t = clamp01((progress - idx * 0.14) / 0.85);
      if (t <= 0 || t >= 1) return null;
      const x = start[0] + (end[0] - start[0]) * t;
      const z = start[2] + (end[2] - start[2]) * t;
      const y = start[1] + (end[1] - start[1]) * t + Math.sin(t * Math.PI) * peakY;
      return h("mesh", { key: `pk-${idx}`, material: pktMat, position: [x, y, z], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) }, h("boxGeometry", { args: [0.11, 0.07, 0.08] }));
    }),
  );
};
