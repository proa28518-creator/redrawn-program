// 8 3D Sets and 3 Hero Mechanical Props for "BangladeshHeist".
// Reuses twoTone shading & NOINK layer contract from src/videos/indiana-bell/.
// Zero per-frame texture or geometry allocations; all animations are pure functions of frame & u.
import React, { useMemo } from "react";
import * as THREE from "three";
import { NOINK } from "../indiana-bell/ink";
import {
  basicMat,
  CurrencyPallet,
  DeskConsoleUnit,
  getDiegeticTexture,
  h,
  mulberry32,
  RibbonLine,
  ServerRackUnit,
  SwiftTerminalUnit,
  toonLam,
  WorldMapArc,
} from "./build";
import { clamp01, ShotId, smoothstep, V3 } from "./story";

const noInk = (s: THREE.Object3D) => s.layers.set(NOINK);

// ---------------- Deterministic Particle, Packet & Mist Tables ----------------
const TYPO_SPARKS = (() => {
  const r = mulberry32(20160204);
  return Array.from({ length: 16 }, (_, i) => {
    const ang = (i / 16) * Math.PI * 2 + (r() - 0.5) * 0.25;
    return {
      dx: Math.cos(ang),
      dy: Math.sin(ang),
      dz: (r() - 0.3) * 0.6,
      speed: 0.18 + r() * 0.24,
      scale: 0.018 + r() * 0.02,
    };
  });
})();

const NIGHT_MOTES = (() => {
  const r = mulberry32(20160205);
  return Array.from({ length: 24 }, () => ({
    x: (r() - 0.5) * 11,
    y: 0.8 + r() * 4.8,
    z: -4.5 + r() * 7.5,
    scale: 0.028 + r() * 0.032,
    phase: r() * Math.PI * 2,
  }));
})();

const DISPATCH_PACKETS = (() => {
  const r = mulberry32(20160206);
  return Array.from({ length: 35 }, (_, i) => ({
    lane: (i % 2 === 0 ? -1 : 1) * (1.7 + (i % 3) * 0.65),
    phase: i / 35,
    speed: 0.9 + r() * 0.3,
    wobble: (r() - 0.5) * 0.04,
  }));
})();

const CONDUIT_RAILS = (() => {
  const r = mulberry32(20160207);
  return Array.from({ length: 30 }, (_, i) => ({
    col: i % 10,
    row: Math.floor(i / 10),
    offset: r(),
    delay: (i % 10) * 0.035,
  }));
})();

// ---------------- HERO 1: SwiftTypoWedgeHero ----------------
export const SwiftTypoWedgeHero: React.FC<{
  position?: V3;
  scale?: number;
  slamProg?: number;
  sparkProg?: number;
}> = ({ position = [0, 0, 0], scale = 1, slamProg = 1, sparkProg = 0 }) => {
  const crimsonMat = useMemo(() => toonLam("wedge_crimson", () => ({ color: "#e62e25" })), []);
  const glowEdgeMat = useMemo(() => basicMat("wedge_glow", () => ({ color: "#ff6648", toneMapped: false })), []);
  const ghostCyanMat = useMemo(
    () => basicMat("wedge_ghost_cyan", () => ({ color: "#36e3f5", transparent: true, opacity: 0.55, toneMapped: false })),
    [],
  );
  const sparkMat = useMemo(() => basicMat("wedge_spark", () => ({ color: "#ffd85a", toneMapped: false })), []);

  const dropY = (1 - smoothstep(0, 1, slamProg)) * 0.42;

  return h(
    "group",
    { position, scale },
    // Physical 3D extruded geometric crimson letter "A"
    h(
      "group",
      { position: [0, dropY, 0] },
      h("mesh", { material: crimsonMat, position: [-0.042, 0, 0], rotation: [0, 0, -0.22], castShadow: true }, h("boxGeometry", { args: [0.036, 0.19, 0.045] })),
      h("mesh", { material: crimsonMat, position: [0.042, 0, 0], rotation: [0, 0, 0.22], castShadow: true }, h("boxGeometry", { args: [0.036, 0.19, 0.045] })),
      h("mesh", { material: crimsonMat, position: [0, -0.02, 0], castShadow: true }, h("boxGeometry", { args: [0.095, 0.03, 0.048] })),
      h("mesh", { material: glowEdgeMat, position: [0, 0.088, 0.024], onUpdate: noInk }, h("boxGeometry", { args: [0.038, 0.018, 0.008] })),
    ),
    // Ghosted cyan "O U" comparison slot hovering beside/above
    h(
      "group",
      { position: [0.16, 0.03, -0.015] },
      h("mesh", { material: ghostCyanMat, position: [-0.048, 0, 0], onUpdate: noInk }, h("torusGeometry", { args: [0.034, 0.008, 8, 18] })),
      h("mesh", { material: ghostCyanMat, position: [0.045, 0, 0], rotation: [0, 0, Math.PI], onUpdate: noInk }, h("torusGeometry", { args: [0.032, 0.008, 8, 16, Math.PI] })),
    ),
    // Deterministic impact sparks when "A" slams Rail #16
    sparkProg > 0.02
      ? h(
          "group",
          { position: [0, -0.08, 0.02] },
          ...TYPO_SPARKS.map((sp, i) =>
            h("mesh", {
              key: `ts-${i}`,
              material: sparkMat,
              position: [sp.dx * sp.speed * sparkProg, sp.dy * sp.speed * sparkProg, sp.dz * sp.speed * sparkProg],
              scale: sp.scale * (1 - sparkProg * 0.5),
              onUpdate: noInk,
            }, h("octahedronGeometry", { args: [1, 0] })),
          ),
        )
      : null,
  );
};

// ---------------- HERO 2: LaserPrinterHero ----------------
export const LaserPrinterHero: React.FC<{
  position?: V3;
  u: number;
  frame: number;
}> = ({ position = [0, 0, 0], u, frame }) => {
  const puttyMat = useMemo(() => toonLam("prt_putty", () => ({ color: "#e6dfd3" })), []);
  const slateMat = useMemo(() => toonLam("prt_slate", () => ({ color: "#4e5966" })), []);
  const standMat = useMemo(() => toonLam("prt_stand", () => ({ color: "#3d4856" })), []);
  const brassMat = useMemo(() => toonLam("prt_brass", () => ({ color: "#d6a43c" })), []);
  const glassMat = useMemo(
    () => basicMat("prt_glass", () => ({ color: "#b8dcf2", transparent: true, opacity: 0.28 })),
    [],
  );
  const lcdMat = useMemo(() => basicMat("prt_lcd", () => ({ map: getDiegeticTexture("printer_lcd"), toneMapped: false })), []);
  const redBeaconOnMat = useMemo(() => basicMat("prt_red_on", () => ({ color: "#ff3326", toneMapped: false })), []);
  const redBeaconOffMat = useMemo(() => toonLam("prt_red_off", () => ({ color: "#78201c" })), []);
  const ghostPaperMat = useMemo(
    () => basicMat("prt_ghost_paper", () => ({ color: "#ff6e54", transparent: true, opacity: 0.35, toneMapped: false })),
    [],
  );

  const locked = u >= 0.25;
  const gearRot = locked ? 0.42 : frame * 0.25;
  const clampSlide = smoothstep(0.18, 0.30, u);
  const faultBlink = ((frame >> 2) % 2) === 0;

  return h(
    "group",
    { position },
    // Heavy-duty printer stand
    h("mesh", { material: standMat, position: [0, 0.34, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.05, 0.68, 0.82] })),
    // Lower paper shelf with 4 sealed A4 reams
    ...[-0.24, 0.24].flatMap((rx, ri) =>
      [0.24, 0.36].map((ry, rj) =>
        h("mesh", { key: `ream-${ri}-${rj}`, material: puttyMat, position: [rx, ry, 0.14], castShadow: true }, h("boxGeometry", { args: [0.34, 0.08, 0.42] })),
      ),
    ),
    // Main two-tone commercial laser printer housing
    h("mesh", { material: puttyMat, position: [0, 1.02, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.08, 0.66, 0.84] })),
    h("mesh", { material: slateMat, position: [0, 1.24, 0], castShadow: true }, h("boxGeometry", { args: [1.10, 0.14, 0.86] })),
    // Empty upper paper output tray + ghost outline where sheets SHOULD eject
    h("mesh", { material: slateMat, position: [0, 1.33, 0.06], castShadow: true }, h("boxGeometry", { args: [0.68, 0.04, 0.50] })),
    h("mesh", { material: ghostPaperMat, position: [0, 1.36, 0.06], rotation: [-Math.PI / 2, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.46, 0.34] })),
    // Angled front LCD panel ("PRINTER OFFLINE / SPOOLER ERROR")
    h(
      "group",
      { position: [0.18, 1.22, 0.44], rotation: [-0.45, 0, 0] },
      h("mesh", { material: slateMat, castShadow: true }, h("boxGeometry", { args: [0.44, 0.24, 0.05] })),
      h("mesh", { material: lcdMat, position: [0, 0, 0.03], onUpdate: noInk }, h("planeGeometry", { args: [0.40, 0.20] })),
    ),
    // Pulsing red fault LED beacon on top bezel
    h("mesh", { material: faultBlink ? redBeaconOnMat : redBeaconOffMat, position: [-0.36, 1.36, 0.32], onUpdate: noInk }, h("cylinderGeometry", { args: [0.045, 0.052, 0.09, 14] })),
    // Cutaway right-side window revealing brass drive gears + malware padlock clamp
    h(
      "group",
      { position: [0.55, 1.02, 0] },
      h("mesh", { material: slateMat, position: [-0.02, 0, 0] }, h("boxGeometry", { args: [0.02, 0.42, 0.56] })),
      h("mesh", { material: glassMat, position: [0.015, 0, 0], rotation: [0, Math.PI / 2, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.52, 0.38] })),
      ...[[-0.12, 0.04], [0.08, -0.04], [0.22, 0.06]].map(([gz, gy], gi) =>
        h("mesh", { key: `gr-${gi}`, material: brassMat, position: [0, gy, gz], rotation: [gearRot * (gi % 2 === 0 ? 1 : -1), 0, Math.PI / 2] }, h("cylinderGeometry", { args: [0.085, 0.085, 0.04, 10] })),
      ),
      // Red digital padlock clamp locking the gears
      h(
        "group",
        { position: [0.025, 0.16 * (1 - clampSlide), 0], scale: 0.4 + 0.6 * clampSlide },
        h("mesh", { material: redBeaconOnMat, onUpdate: noInk }, h("boxGeometry", { args: [0.04, 0.16, 0.18] })),
        h("mesh", { material: redBeaconOnMat, position: [0, 0.10, 0], rotation: [0, Math.PI / 2, 0], onUpdate: noInk }, h("torusGeometry", { args: [0.055, 0.014, 8, 16, Math.PI] })),
      ),
    ),
  );
};

// ---------------- HERO 3: VaultDoorHero ----------------
export const VaultDoorHero: React.FC<{
  position?: V3;
  lockedProg?: number;
}> = ({ position = [0, 1.75, -3.95], lockedProg = 0.5 }) => {
  const steelMat = useMemo(() => toonLam("vlt_steel", () => ({ color: "#aeb8c4" })), []);
  const darkSteelMat = useMemo(() => toonLam("vlt_dark", () => ({ color: "#4c5664" })), []);
  const brassMat = useMemo(() => toonLam("vlt_brass", () => ({ color: "#dfb44e" })), []);
  const crestMat = useMemo(() => basicMat("vlt_crest", () => ({ map: getDiegeticTexture("vault_crest"), toneMapped: false })), []);
  const lockGlowMat = useMemo(
    () =>
      basicMat(`vlt_ring_${lockedProg > 0.7 ? "green" : "amber"}`, () => ({
        color: lockedProg > 0.7 ? "#3cf2b8" : "#ffae38",
        toneMapped: false,
      })),
    [lockedProg],
  );

  const boltExtend = smoothstep(0.15, 0.85, lockedProg) * 0.22;
  const wheelSpin = smoothstep(0.1, 0.8, lockedProg) * Math.PI * 1.25;

  return h(
    "group",
    { position },
    // Vault frame ring
    h("mesh", { material: darkSteelMat, castShadow: true, receiveShadow: true }, h("torusGeometry", { args: [1.72, 0.22, 16, 36] })),
    // Main circular door plate
    h("mesh", { material: steelMat, position: [0, 0, 0.04], rotation: [Math.PI / 2, 0, 0], castShadow: true, receiveShadow: true }, h("cylinderGeometry", { args: [1.56, 1.56, 0.26, 36] })),
    // Illuminated status ring
    h("mesh", { material: lockGlowMat, position: [0, 0, 0.19], onUpdate: noInk }, h("torusGeometry", { args: [1.46, 0.032, 10, 36] })),
    // 8 radial steel locking bolts
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const r = 1.25 + boltExtend;
      return h("mesh", {
        key: `vb-${i}`,
        material: brassMat,
        position: [Math.cos(a) * r, Math.sin(a) * r, 0.18],
        rotation: [0, 0, a],
        castShadow: true,
      }, h("boxGeometry", { args: [0.36, 0.09, 0.08] }));
    }),
    // Central spoked wheel
    h(
      "group",
      { position: [0, 0, 0.24], rotation: [0, 0, wheelSpin] },
      h("mesh", { material: brassMat, castShadow: true }, h("torusGeometry", { args: [0.46, 0.045, 10, 24] })),
      ...[0, 1, 2].map((si) =>
        h("mesh", { key: `sp-${si}`, material: brassMat, rotation: [0, 0, (si * Math.PI) / 3] }, h("boxGeometry", { args: [0.90, 0.04, 0.04] })),
      ),
      h("mesh", { material: darkSteelMat, rotation: [Math.PI / 2, 0, 0] }, h("cylinderGeometry", { args: [0.14, 0.14, 0.12, 16] })),
    ),
    // Overhead crest plaque
    h(
      "group",
      { position: [0, 2.08, 0.15] },
      h("mesh", { material: darkSteelMat }, h("boxGeometry", { args: [2.65, 0.50, 0.12] })),
      h("mesh", { material: crestMat, position: [0, 0, 0.065], onUpdate: noInk }, h("planeGeometry", { args: [2.52, 0.44] })),
    ),
  );
};

// ---------------- SET 1: SwiftScreenCloseupSet (Shots 1, 15, 16, 17, 22, 24) ----------------
export const SwiftScreenCloseupSet: React.FC<{
  shotId: ShotId;
  u: number;
  frame: number;
}> = ({ shotId, u, frame }) => {
  const isFinale = shotId === 24;
  const wallMat = useMemo(
    () => toonLam(isFinale ? "sw_wall_fin" : "sw_wall", () => ({ map: getDiegeticTexture("sandstone_wall"), color: isFinale ? "#7a8da8" : "#9db6d4" })),
    [isFinale],
  );
  const deskMat = useMemo(
    () => toonLam(isFinale ? "sw_desk_fin" : "sw_desk", () => ({ color: isFinale ? "#8c96a6" : "#dfd4c2" })),
    [isFinale],
  );
  const bezelMat = useMemo(() => toonLam("sw_bez", () => ({ color: "#d4dce6" })), []);
  const keyMat = useMemo(() => toonLam("sw_key", () => ({ color: "#ece6da" })), []);
  const keyAlertMat = useMemo(() => basicMat("sw_key_red", () => ({ color: "#ff4438", toneMapped: false })), []);
  const brassMat = useMemo(() => toonLam("sw_brass", () => ({ color: "#d8ae48" })), []);
  const darkMetalMat = useMemo(() => toonLam("sw_dark", () => ({ color: "#2d3846" })), []);
  const mugMat = useMemo(() => toonLam("sw_mug", () => ({ color: "#f4f0e8" })), []);
  const binderMat = useMemo(() => toonLam("sw_binder", () => ({ color: "#26588c" })), []);
  const corkMat = useMemo(() => toonLam("sw_cork", () => ({ color: "#b88a56" })), []);
  const goldPacketMat = useMemo(() => basicMat("sw_gold_pkt", () => ({ color: "#ffd85a", toneMapped: false })), []);
  const greenMat = useMemo(() => basicMat("sw_green", () => ({ color: "#3cf2a8", toneMapped: false })), []);
  const redMat = useMemo(() => basicMat("sw_red", () => ({ color: "#ff3b30", toneMapped: false })), []);
  const amberMat = useMemo(() => basicMat("sw_amber", () => ({ color: "#ffae38", toneMapped: false })), []);
  const watchSignMat = useMemo(() => basicMat("sw_wt_sign", () => ({ map: getDiegeticTexture("watchtower_sign"), toneMapped: false })), []);
  const condHeaderMat = useMemo(() => basicMat("sw_cond_hdr", () => ({ map: getDiegeticTexture("conduit_header_850m"), toneMapped: false })), []);
  const clearedTagMat = useMemo(() => basicMat("sw_clr_101", () => ({ map: getDiegeticTexture("cleared_tag_101m"), toneMapped: false })), []);

  const screenTex =
    shotId === 1
      ? "swift_hook_typo"
      : shotId === 15
        ? "swift_one_letter"
        : shotId === 16
          ? "swift_beneficiary_entry"
          : shotId === 17
            ? "swift_ecu_fandation"
            : shotId === 22
              ? "swift_punchline_password"
              : "swift_final_collapse";

  // Shot 1 causal timing: f18..36 wedge slams Rail #16, f36..58 query fires to Fed Watchtower, f58..112 shutters lock upper $850M
  const slamProg = shotId === 1 ? clamp01((frame - 16) / 18) : 1;
  const sparkProg = shotId === 1 ? clamp01((frame - 32) / 22) : 0;
  const queryBeamOn = shotId === 1 && frame >= 36;
  const watchtowerActive = shotId === 1 ? clamp01((frame - 40) / 16) : 1;
  const shutterProg = shotId === 1 ? clamp01((frame - 58) / 48) : 1;
  const packetAdvance = shotId === 1 ? clamp01(frame / 34) : 1;

  const rail16Pts: V3[] = useMemo(() => [[-0.65, 0.89, 0.14], [-0.15, 0.89, 0.14], [0.45, 0.89, 0.14]], []);
  const queryBeamPts: V3[] = useMemo(() => [[0.0, 1.54, 0.02], [0.0, 1.82, -1.05], [0.0, 2.08, -2.15]], []);
  const bracketScale = shotId === 17 || shotId === 24 ? 1.15 - 0.15 * smoothstep(0.05, 0.25, u) : 1;
  const showDeskRail = shotId === 1 || shotId === 15 || shotId === 16 || shotId === 22;

  return h(
    "group",
    null,
    // Studio / Operations Backdrop Wall & Desk
    h("mesh", { material: wallMat, position: [0, 2.2, -5.8], receiveShadow: true }, h("boxGeometry", { args: [14, 7.5, 0.3] })),
    h("mesh", { material: deskMat, position: [0, 0.62, 0.22], receiveShadow: true }, h("boxGeometry", { args: [4.2, 0.24, 1.85] })),

    // Layer 1 (Foreground z=0): Primary SWIFT Terminal + Typo Wedge + Rail #16 (seated cleanly BELOW screen)
    h(SwiftTerminalUnit, { position: [0, 1.25, 0], screenTex }),
    showDeskRail
      ? h(
          "group",
          null,
          h(SwiftTypoWedgeHero, {
            position: [0.02, 0.90, 0.15],
            scale: shotId === 1 ? 1.02 : 0.82,
            slamProg,
            sparkProg,
          }),
          h(RibbonLine, { points: rail16Pts, width: 0.024, color: "#ffae38" }),
          ...[-0.48, -0.32, -0.16].map((px, i) => {
            const stopX = -0.09 - i * 0.09;
            const curX = px + (stopX - px) * packetAdvance;
            return h("mesh", {
              key: `r16-${i}`,
              material: goldPacketMat,
              position: [curX, 0.89, 0.15],
              onUpdate: noInk,
            }, h("boxGeometry", { args: [0.055, 0.036, 0.036] }));
          }),
        )
      : null,

    // Shot 17 & Shot 24 perimeter framing brackets (around text border, never crossing glyphs)
    shotId === 17 || shotId === 24
      ? h(
          "group",
          { position: [0, 1.25, 0.012], scale: [bracketScale, bracketScale, 1] },
          h("mesh", { material: redMat, position: [0, 0.255, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.51, 0.012] })),
          h("mesh", { material: redMat, position: [0, -0.255, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.51, 0.012] })),
          h("mesh", { material: redMat, position: [-0.25, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.012, 0.52] })),
          h("mesh", { material: redMat, position: [0.25, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.012, 0.52] })),
        )
      : null,

    // Shot 1 Query Beam shooting from terminal up to Midground Fed Watchtower
    queryBeamOn ? h(RibbonLine, { points: queryBeamPts, width: 0.028, color: "#ff4736" }) : null,

    // Layer 2 (Midground z=-2.2, y=2.10): Fed Review Watchtower Hub
    h(
      "group",
      { position: [0, 2.08, -2.2] },
      h("mesh", { material: darkMetalMat, castShadow: true }, h("boxGeometry", { args: [1.55, 0.48, 0.44] })),
      h("mesh", { material: watchSignMat, position: [0, 0, 0.23], onUpdate: noInk }, h("planeGeometry", { args: [1.44, 0.36] })),
      h("mesh", {
        material: watchtowerActive > 0.3 ? redMat : amberMat,
        position: [0, 0.34, 0],
        rotation: [0, frame * 0.18, 0],
        onUpdate: noInk,
      }, h("cylinderGeometry", { args: [0.11, 0.14, 0.18, 12] })),
      // Sweeping review laser bar when watchtower activates
      watchtowerActive > 0.35
        ? h("mesh", {
            material: redMat,
            position: [0, 0.58, -0.95],
            rotation: [0, 0, Math.sin(frame * 0.15) * 0.22],
            onUpdate: noInk,
          }, h("boxGeometry", { args: [2.8, 0.028, 0.028] }))
        : null,
    ),

    // Layer 3 (Upper Background z=-4.2, y=2.84): 30-Rail ~$850M Queued Conduit Array + Blast Shutters
    h(
      "group",
      { position: [0, 2.84, -4.2] },
      h("mesh", { material: darkMetalMat }, h("boxGeometry", { args: [3.2, 1.05, 0.4] })),
      h("mesh", { material: condHeaderMat, position: [0, 0.58, 0.18], onUpdate: noInk }, h("planeGeometry", { args: [2.1, 0.52] })),
      ...CONDUIT_RAILS.map((cr, idx) => {
        const rx = -1.25 + cr.col * 0.28;
        const ry = -0.32 + cr.row * 0.30;
        const locked = clamp01((shutterProg - cr.delay) * 2.2);
        const pktX = locked < 0.8 ? (((frame * 0.04 + cr.offset) % 1) - 0.5) * 0.22 : 0;
        return h(
          "group",
          { key: `cr-${idx}`, position: [rx, ry, 0.22] },
          h("mesh", { material: darkMetalMat }, h("boxGeometry", { args: [0.22, 0.22, 0.06] })),
          h("mesh", { material: locked > 0.5 ? redMat : goldPacketMat, position: [pktX, 0, 0.04], onUpdate: noInk }, h("boxGeometry", { args: [0.12, 0.09, 0.03] })),
          locked > 0.05
            ? h("mesh", { material: redMat, position: [0, 0.11 * (1 - locked), 0.06], scale: [1, locked, 1], onUpdate: noInk }, h("boxGeometry", { args: [0.20, 0.20, 0.02] }))
            : null,
        );
      }),
    ),

    // Lower-Right Cleared Bypass Conduit ("CLEARED: $101M")
    h(
      "group",
      { position: [0.58, 0.96, -0.35] },
      h("mesh", { material: greenMat, rotation: [0, 0, Math.PI / 2], onUpdate: noInk }, h("cylinderGeometry", { args: [0.025, 0.025, 0.55, 10] })),
      h("mesh", { material: clearedTagMat, position: [0.04, 0.14, 0.04], onUpdate: noInk }, h("planeGeometry", { args: [0.34, 0.13] })),
    ),

    // Foreground Desk Props (Keyboard, Auth Dongle, Binder, Brass Lamp, Espresso Cup, Cable Bundle)
    h(
      "group",
      { position: [0, 0.76, 0.36], rotation: [0.06, 0, 0] },
      h("mesh", { material: bezelMat, castShadow: true }, h("boxGeometry", { args: [0.58, 0.03, 0.20] })),
      ...[-0.04, 0.0, 0.04].map((kz, r) => h("mesh", { key: `skb-${r}`, material: keyMat, position: [0, 0.02, kz] }, h("boxGeometry", { args: [0.50, 0.015, 0.03] }))),
      h("mesh", { material: keyAlertMat, position: [-0.08, 0.025, 0], onUpdate: noInk }, h("boxGeometry", { args: [0.04, 0.018, 0.035] })),
    ),
    // SWIFT Token Dongle + Blinking Amber LED
    h(
      "group",
      { position: [0.38, 0.76, 0.36], rotation: [0, -0.25, 0] },
      h("mesh", { material: darkMetalMat, castShadow: true }, h("boxGeometry", { args: [0.09, 0.025, 0.05] })),
      h("mesh", { material: (frame >> 3) % 2 === 0 ? amberMat : darkMetalMat, position: [0.025, 0.018, 0], onUpdate: noInk }, h("boxGeometry", { args: [0.02, 0.01, 0.02] })),
    ),
    // MT103 Reference Binder
    h("mesh", { material: binderMat, position: [-0.52, 0.765, 0.28], rotation: [0, 0.22, 0], castShadow: true }, h("boxGeometry", { args: [0.24, 0.045, 0.30] })),
    // Brushed Brass Task Lamp
    h(
      "group",
      { position: [0.56, 0.74, -0.08], rotation: [0, -0.35, 0] },
      h("mesh", { material: brassMat, position: [0, 0.03, 0] }, h("cylinderGeometry", { args: [0.09, 0.11, 0.05, 14] })),
      h("mesh", { material: brassMat, position: [0, 0.28, 0] }, h("cylinderGeometry", { args: [0.016, 0.016, 0.48, 10] })),
      h("mesh", { material: brassMat, position: [-0.08, 0.50, 0.05], rotation: [0.3, 0, 0.4] }, h("coneGeometry", { args: [0.12, 0.16, 14] })),
    ),
    // Ceramic Espresso Cup & Saucer on Cork Coaster
    h(
      "group",
      { position: [-0.38, 0.74, 0.42] },
      h("mesh", { material: corkMat, position: [0, 0.008, 0] }, h("cylinderGeometry", { args: [0.065, 0.065, 0.012, 14] })),
      h("mesh", { material: mugMat, position: [0, 0.055, 0], castShadow: true }, h("cylinderGeometry", { args: [0.042, 0.034, 0.08, 14] })),
    ),
    // Braided Armored CAT-6 / SWIFTNET Cable Bundle
    h("mesh", { material: darkMetalMat, position: [0.12, 0.75, -0.26], rotation: [Math.PI / 2, 0, 0] }, h("cylinderGeometry", { args: [0.025, 0.025, 0.38, 10] })),
  );
};

// ---------------- SET 2: CentralBankInteriorSet (Shots 2, 3, 4B, 10, 23) ----------------
export const CentralBankInteriorSet: React.FC<{
  shotId: ShotId;
  u: number;
  frame: number;
}> = ({ shotId, u, frame }) => {
  const floorMat = useMemo(() => toonLam("cb_floor", () => ({ map: getDiegeticTexture("terrazzo_floor") })), []);
  const wallMat = useMemo(() => toonLam("cb_wall", () => ({ map: getDiegeticTexture("sandstone_wall") })), []);
  const ceilMat = useMemo(() => toonLam("cb_ceil", () => ({ color: "#d6cfc2" })), []);
  const trofferMat = useMemo(() => basicMat("cb_trof", () => ({ color: "#fff8ea", toneMapped: false })), []);
  const brassMat = useMemo(() => toonLam("cb_brass", () => ({ color: "#dcb24c" })), []);
  const chairMat = useMemo(() => toonLam("cb_chair", () => ({ color: "#3a4a5e" })), []);
  const darkMat = useMemo(() => toonLam("cb_dark", () => ({ color: "#2d3846" })), []);
  const palmPotMat = useMemo(() => toonLam("cb_pot", () => ({ color: "#c99b3c" })), []);
  const palmLeafMat = useMemo(() => toonLam("cb_palm", () => ({ color: "#4d8a52" })), []);
  const ropeMat = useMemo(() => toonLam("cb_rope", () => ({ color: "#9e2a2b" })), []);
  const greenTubeMat = useMemo(() => basicMat("cb_tube_g", () => ({ color: "#3cf2b8", toneMapped: false })), []);
  const redTubeMat = useMemo(() => basicMat("cb_tube_r", () => ({ color: "#ff4736", toneMapped: false })), []);
  const amberTubeMat = useMemo(() => basicMat("cb_tube_a", () => ({ color: "#ffae38", toneMapped: false })), []);

  const boardTex =
    shotId === 23 ? "board_850m_saved" : shotId === 4 ? "bank_server_screen" : "board_951m";
  const bigBoardMat = useMemo(
    () => basicMat(`cb_brd_${boardTex}`, () => ({ map: getDiegeticTexture(boardTex), toneMapped: false })),
    [boardTex],
  );
  const febMat = useMemo(() => basicMat("cb_feb16", () => ({ map: getDiegeticTexture("calendar_feb2016"), toneMapped: false })), []);
  const janMat = useMemo(() => basicMat("cb_jan16", () => ({ map: getDiegeticTexture("calendar_jan2016"), toneMapped: false })), []);

  const flipProg = shotId === 3 ? smoothstep(0.08, 0.30, u) : 1;
  const breachProg = shotId === 4 ? smoothstep(0.42, 0.72, u) : 0;
  const vaultLocked = shotId === 23 ? smoothstep(0.08, 0.65, u) : 0.25;
  const breachBeamPts: V3[] = useMemo(() => [[0.8, 2.2, -0.5], [1.65, 1.85, -1.2], [2.45, 1.45, -1.7]], []);

  return h(
    "group",
    null,
    // Grand Hall Shell
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [16, 16] })),
    h("mesh", { material: wallMat, position: [0, 3.0, -4.4], receiveShadow: true }, h("boxGeometry", { args: [16, 6.2, 0.3] })),
    h("mesh", { material: wallMat, position: [-6.5, 3.0, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [16, 6.2, 0.3] })),
    h("mesh", { material: wallMat, position: [6.5, 3.0, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [16, 6.2, 0.3] })),
    h("mesh", { material: ceilMat, position: [0, 5.8, 0], rotation: [Math.PI / 2, 0, 0] }, h("planeGeometry", { args: [16, 16] })),
    // Fluted Sandstone Pilasters
    ...[-4.2, -2.1, 2.1, 4.2].map((px, i) =>
      h("mesh", { key: `pil-${i}`, material: wallMat, position: [px, 2.9, -4.15], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.45, 5.8, 0.35] })),
    ),
    // 6 Ceiling Linear Daylight Troffers
    ...[-2.8, 0, 2.8].flatMap((tx) =>
      [-2.4, 0.8].map((tz) =>
        h("mesh", { key: `tr-${tx}-${tz}`, material: trofferMat, position: [tx, 5.74, tz], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [1.5, 0.5] })),
      ),
    ),

    // Hero Circular Bank Vault Door
    h(VaultDoorHero, { position: [0, 1.85, -3.95], lockedProg: vaultLocked }),

    // 6 Stacked Currency & Gold Reserve Pallets
    h(CurrencyPallet, { position: [-1.75, 0, -2.75], rotationY: 0.18 }),
    h(CurrencyPallet, { position: [-2.85, 0, -2.55], rotationY: -0.12 }),
    h(CurrencyPallet, { position: [1.75, 0, -2.75], rotationY: -0.18 }),
    h(CurrencyPallet, { position: [2.85, 0, -2.55], rotationY: 0.12 }),
    h(CurrencyPallet, { position: [-1.85, 0, -1.65], rotationY: 0.05 }),
    h(CurrencyPallet, { position: [1.85, 0, -1.65], rotationY: -0.05 }),

    // Upper-Center Giant LED Financial Status Board (2.05m x 1.10m, frustum-fitted)
    h(
      "group",
      { position: shotId === 4 ? [1.75, 2.08, -2.05] : [0, 2.68, -2.65], rotation: [0, shotId === 4 ? -0.35 : 0, 0] },
      h("mesh", { material: darkMat, castShadow: true }, h("boxGeometry", { args: [shotId === 4 ? 1.55 : 2.16, shotId === 4 ? 0.85 : 1.18, 0.14] })),
      h("mesh", { material: bigBoardMat, position: [0, 0, 0.08], onUpdate: noInk }, h("planeGeometry", { args: [shotId === 4 ? 1.44 : 2.02, shotId === 4 ? 0.76 : 1.06] })),
    ),
    shotId === 4 ? h(RibbonLine, { points: breachBeamPts, width: 0.045, color: "#ff4d36" }) : null,

    // Wall Flip-Calendar & Clock Plaque ("FEBRUARY 2016") mounted cleanly on left gallery column
    h(
      "group",
      { position: [-2.65, 2.35, -2.55] },
      h("mesh", { material: brassMat, position: [0, -1.25, -0.02], castShadow: true }, h("cylinderGeometry", { args: [0.05, 0.08, 2.5, 10] })),
      h("mesh", { material: brassMat, castShadow: true }, h("boxGeometry", { args: [1.38, 0.76, 0.08] })),
      h("mesh", { material: febMat, position: [0, 0, 0.045], onUpdate: noInk }, h("planeGeometry", { args: [1.28, 0.68] })),
      flipProg < 0.98
        ? h("mesh", {
            material: janMat,
            position: [0, -0.34 * flipProg, 0.06],
            rotation: [flipProg * Math.PI * 0.65, 0, 0],
            onUpdate: noInk,
          }, h("planeGeometry", { args: [1.28, 0.68] }))
        : null,
    ),

    // 35 Overhead Glass-Tubed SWIFT Transfer Conduits (5 green, 1 red, 29 amber/locked)
    ...Array.from({ length: 35 }, (_, i) => {
      const x = -2.55 + i * 0.15;
      const mat = i < 5 ? greenTubeMat : i === 5 ? redTubeMat : amberTubeMat;
      return h("mesh", {
        key: `ovc-${i}`,
        material: mat,
        position: [x, 4.35, -1.85],
        rotation: [Math.PI / 2, 0, 0],
        onUpdate: noInk,
      }, h("cylinderGeometry", { args: [0.022, 0.022, 3.6, 8] }));
    }),

    // 4 Illuminated Glass-Front Server Rack Cabinets along Right Aisle (featured in Shot 4B)
    ...[-2.8, -1.7, -0.6, 0.5].map((rz, idx) =>
      h(ServerRackUnit, {
        key: `cbsrv-${idx}`,
        position: [2.65, 0, rz],
        rotationY: -Math.PI / 2 + 0.15,
        breachProg: Math.max(0, breachProg - idx * 0.12),
        frame,
        seedOffset: idx * 3,
      }),
    ),

    // FX Console Banks & Swivel Chairs
    h(DeskConsoleUnit, { position: [-1.55, 0, -0.35], rotationY: Math.PI, screenTex: "bank_desk_screen", binderColor: "#2266aa" }),
    h(DeskConsoleUnit, { position: [1.45, 0, -0.35], rotationY: Math.PI, screenTex: "bank_desk_screen", binderColor: "#b84534" }),
    ...[-1.95, -1.15, 1.05, 1.85].map((cx, i) =>
      h(
        "group",
        { key: `cbc-${i}`, position: [cx, 0, 0.85], rotation: [0, cx < 0 ? 0.25 : -0.25, 0] },
        h("mesh", { material: darkMat, position: [0, 0.22, 0] }, h("cylinderGeometry", { args: [0.04, 0.20, 0.42, 10] })),
        h("mesh", { material: chairMat, position: [0, 0.45, 0], castShadow: true }, h("boxGeometry", { args: [0.42, 0.08, 0.42] })),
        h("mesh", { material: chairMat, position: [0, 0.72, 0.18], castShadow: true }, h("boxGeometry", { args: [0.38, 0.44, 0.07] })),
      ),
    ),

    // Brass Stanchion Posts & Velvet Rope Barrier
    ...[-1.1, 1.1].map((sx, i) =>
      h(
        "group",
        { key: `st-${i}`, position: [sx, 0, -2.05] },
        h("mesh", { material: brassMat, position: [0, 0.45, 0], castShadow: true }, h("cylinderGeometry", { args: [0.035, 0.12, 0.90, 12] })),
        h("mesh", { material: brassMat, position: [0, 0.92, 0] }, h("sphereGeometry", { args: [0.06, 12, 10] })),
      ),
    ),
    h("mesh", { material: ropeMat, position: [0, 0.78, -2.05], rotation: [0, 0, Math.PI / 2] }, h("cylinderGeometry", { args: [0.025, 0.025, 2.2, 8] })),

    // Potted Indoor Areca Palms in Brass Planters
    ...[-3.4, 3.4].map((px, i) =>
      h(
        "group",
        { key: `plm-${i}`, position: [px, 0, -1.15] },
        h("mesh", { material: palmPotMat, position: [0, 0.25, 0], castShadow: true }, h("cylinderGeometry", { args: [0.24, 0.18, 0.50, 14] })),
        h("mesh", { material: palmLeafMat, position: [0, 0.85, 0], castShadow: true }, h("coneGeometry", { args: [0.46, 0.82, 9] })),
      ),
    ),
  );
};

// ---------------- SET 3: HackerHideoutSet (Shots 4A, 5, 6, 9, 14) ----------------
export const HackerHideoutSet: React.FC<{
  shotId: ShotId;
  u: number;
  frame: number;
}> = ({ shotId, u, frame }) => {
  const floorMat = useMemo(() => toonLam("hk_floor", () => ({ map: getDiegeticTexture("loft_timber") })), []);
  const brickMat = useMemo(() => toonLam("hk_brick", () => ({ map: getDiegeticTexture("loft_brick") })), []);
  const concreteMat = useMemo(() => toonLam("hk_conc", () => ({ color: "#8a857e" })), []);
  const skylightMat = useMemo(() => basicMat("hk_sky", () => ({ color: "#a8c8e8", toneMapped: false })), []);
  const deskMat = useMemo(() => toonLam("hk_desk", () => ({ color: "#c9a67a" })), []);
  const steelMat = useMemo(() => toonLam("hk_steel", () => ({ color: "#3d4a5c" })), []);
  const chairMat = useMemo(() => toonLam("hk_chair", () => ({ color: "#48566a" })), []);
  const cyanMat = useMemo(() => basicMat("hk_cyan", () => ({ color: "#3cf2e0", toneMapped: false })), []);
  const amberMat = useMemo(() => basicMat("hk_amber", () => ({ color: "#ffae38", toneMapped: false })), []);
  const redMat = useMemo(() => basicMat("hk_red", () => ({ color: "#ff4438", toneMapped: false })), []);
  const paperMat = useMemo(() => toonLam("hk_paper", () => ({ color: "#f2ede2" })), []);
  const cupMat = useMemo(() => toonLam("hk_cup", () => ({ color: "#e8e4da" })), []);

  const mainTex =
    shotId === 9
      ? "hacker_35_counter"
      : shotId === 14
        ? "hacker_victory_screen"
        : "hacker_intrusion_screen";
  const mainScreenMat = useMemo(
    () => basicMat(`hk_main_${mainTex}`, () => ({ map: getDiegeticTexture(mainTex), toneMapped: false })),
    [mainTex],
  );
  const monthsMat = useMemo(() => basicMat("hk_months", () => ({ map: getDiegeticTexture("hacker_months_board"), toneMapped: false })), []);
  const stratMat = useMemo(() => basicMat("hk_strat", () => ({ map: getDiegeticTexture("hacker_strategy_board"), toneMapped: false })), []);
  const warnMat = useMemo(() => basicMat("hk_warn", () => ({ map: getDiegeticTexture("hacker_warn_dot"), toneMapped: false })), []);
  const clockMat = useMemo(() => basicMat("hk_clks", () => ({ map: getDiegeticTexture("hacker_timezone_clocks"), toneMapped: false })), []);

  const monthHighlightX = -0.45 + smoothstep(0.05, 0.85, u) * 0.90;
  const warnPulse = shotId === 14 && u > 0.45 && ((frame >> 2) % 2 === 0);

  return h(
    "group",
    null,
    // Industrial Loft Shell
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [14, 14] })),
    h("mesh", { material: brickMat, position: [0, 2.5, -3.4], receiveShadow: true }, h("boxGeometry", { args: [14, 5.2, 0.25] })),
    h("mesh", { material: brickMat, position: [-5.4, 2.5, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [14, 5.2, 0.25] })),
    h("mesh", { material: brickMat, position: [5.4, 2.5, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [14, 5.2, 0.25] })),
    // Concrete Loft Columns & Frosted Skylights
    ...[-3.2, 3.2].map((cx, i) =>
      h("mesh", { key: `col-${i}`, material: concreteMat, position: [cx, 2.5, -3.1], castShadow: true }, h("boxGeometry", { args: [0.42, 5.0, 0.42] })),
    ),
    ...[-2.4, 2.4].map((wx, i) =>
      h("mesh", { key: `win-${i}`, material: skylightMat, position: [wx, 2.55, -3.22], onUpdate: noInk }, h("planeGeometry", { args: [1.65, 1.45] })),
    ),

    // World Time-Zone Clock Row
    h(
      "group",
      { position: [0, 3.05, -3.18] },
      h("mesh", { material: steelMat }, h("boxGeometry", { args: [2.25, 0.56, 0.10] })),
      h("mesh", { material: clockMat, position: [0, 0, 0.06], onUpdate: noInk }, h("planeGeometry", { args: [2.12, 0.48] })),
    ),

    // L-Shaped Steel & Butcher-Block Command Desk
    h("mesh", { material: steelMat, position: [0, 0.37, -0.35], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [3.2, 0.74, 0.78] })),
    h("mesh", { material: deskMat, position: [0, 0.76, -0.35], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [3.35, 0.05, 0.84] })),
    h("mesh", { material: deskMat, position: [-1.45, 0.76, 0.35], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.75, 0.05, 1.45] })),

    // Curved 6-Monitor Command Array (elevated above celebrating cast in Shot 14; hidden in Shots 5 & 6)
    h(
      "group",
      { position: [0, shotId === 14 ? 2.38 : 1.75, -0.95], visible: shotId !== 5 && shotId !== 6 },
      h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.92, 0.60, 0.08] })),
      h("mesh", { material: mainScreenMat, position: [0, 0, 0.045], onUpdate: noInk }, h("planeGeometry", { args: [0.84, 0.52] })),
    ),
    ...[-0.86, 0.86].map((mx, i) =>
      h(
        "group",
        { key: `m1-${i}`, position: [mx, shotId === 14 ? 2.02 : 1.12, -0.58], rotation: [0, mx < 0 ? 0.22 : -0.22, 0], visible: shotId !== 6 },
        h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.64, 0.40, 0.06] })),
        h("mesh", { material: i === 1 && shotId === 14 ? warnMat : mainScreenMat, position: [0, 0, 0.036], onUpdate: noInk }, h("planeGeometry", { args: [0.58, 0.34] })),
        i === 1 && warnPulse
          ? h("mesh", { material: redMat, position: [0.22, 0.12, 0.045], onUpdate: noInk }, h("sphereGeometry", { args: [0.042, 12, 10] }))
          : null,
      ),
    ),
    // Corner Monitor #6 (Upper right flanking display)
    h(
      "group",
      { position: [1.35, 1.68, -0.78], rotation: [0, -0.38, 0], visible: shotId !== 5 && shotId !== 6 && shotId !== 14 },
      h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.68, 0.42, 0.06] })),
      h("mesh", { material: warnMat, position: [0, 0, 0.036], onUpdate: noInk }, h("planeGeometry", { args: [0.62, 0.36] })),
    ),

    // Wall Month-Progression Strip ("NOV -> DEC -> JAN -> FEB 2016", Shot 5)
    h(
      "group",
      { position: [0.65, 1.92, -1.25], rotation: [0, -0.05, 0], visible: shotId === 5 },
      h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [1.38, 0.72, 0.08] })),
      h("mesh", { material: monthsMat, position: [0, 0, 0.045], onUpdate: noInk }, h("planeGeometry", { args: [1.30, 0.65] })),
      shotId === 5
        ? h("mesh", { material: amberMat, position: [monthHighlightX, -0.14, 0.055], onUpdate: noInk }, h("boxGeometry", { args: [0.28, 0.025, 0.015] }))
        : null,
    ),

    // Illuminated Transparent Acrylic Strategy Board (Shot 6)
    h(
      "group",
      { position: [0.55, 1.78, -0.85], rotation: [0, -0.14, 0], visible: shotId === 6 },
      h("mesh", { material: steelMat, position: [0, -0.62, 0] }, h("cylinderGeometry", { args: [0.04, 0.14, 0.72, 10] })),
      h("mesh", { material: stratMat, onUpdate: noInk }, h("planeGeometry", { args: [1.44, 0.76] })),
      h("mesh", { material: redMat, position: [-0.45 + u * 0.90, -0.26, 0.012], onUpdate: noInk }, h("boxGeometry", { args: [0.22, 0.022, 0.01] })),
    ),

    // Shot 9: 35 Glowing SWIFT Packet Slabs Launching Upward into Conduit
    shotId === 9
      ? h(
          "group",
          null,
          ...DISPATCH_PACKETS.map((dp, i) => {
            const p = ((frame * 0.045 * dp.speed + dp.phase) % 1 + 1) % 1;
            const y = 1.15 + p * 2.15;
            const x = dp.lane * 0.34 + dp.wobble;
            const z = -0.68 - p * 0.55;
            return h("mesh", { key: `dp-${i}`, material: i % 3 === 0 ? amberMat : cyanMat, position: [x, y, z], onUpdate: noInk }, h("boxGeometry", { args: [0.14, 0.09, 0.03] }));
          }),
        )
      : null,

    // Keyboards, Laptops, Server Stack, Coffee Cups, Manuals, Chairs, Pendant Lamps
    ...[-0.95, 0, 0.95].map((kx, i) =>
      h("mesh", { key: `hkb-${i}`, material: steelMat, position: [kx, 0.80, -0.12], castShadow: true }, h("boxGeometry", { args: [0.44, 0.025, 0.15] })),
    ),
    h("mesh", { material: steelMat, position: [-1.42, 0.86, 0.25], rotation: [0, 0.4, 0], castShadow: true }, h("boxGeometry", { args: [0.36, 0.03, 0.26] })),
    h(ServerRackUnit, { position: [-2.45, 0, -1.65], rotationY: 0.45, breachProg: 0.3, frame }),
    ...[-1.35, -1.18, 1.32, 1.48].map((cx, i) =>
      h("mesh", { key: `hcup-${i}`, material: cupMat, position: [cx, 0.85, -0.25 + (i % 2) * 0.18], castShadow: true }, h("cylinderGeometry", { args: [0.04, 0.035, 0.11, 12] })),
    ),
    h("mesh", { material: paperMat, position: [-1.35, 0.82, -0.42], castShadow: true }, h("boxGeometry", { args: [0.28, 0.08, 0.34] })),
    ...[-1.0, 0, 1.0].map((lx, i) =>
      h("mesh", { key: `lp-${i}`, material: steelMat, position: [lx, 3.35, -0.35], castShadow: true }, h("coneGeometry", { args: [0.24, 0.20, 12] })),
    ),
    h("mesh", { material: cyanMat, position: [0, 0.90, -0.70], onUpdate: noInk }, h("boxGeometry", { args: [2.8, 0.025, 0.025] })),
    ...[-0.95, 0.95].map((cx, i) =>
      h("mesh", { key: `hch-${i}`, material: chairMat, position: [cx, 0.45, 0.56], castShadow: true }, h("boxGeometry", { args: [0.42, 0.08, 0.42] })),
    ),
  );
};

// ---------------- SET 4: PrinterRoomSet (Shot 7) ----------------
export const PrinterRoomSet: React.FC<{
  u: number;
  frame: number;
}> = ({ u, frame }) => {
  const floorMat = useMemo(() => toonLam("pr_floor", () => ({ map: getDiegeticTexture("terrazzo_floor"), color: "#adb6c0" })), []);
  const wallMat = useMemo(() => toonLam("pr_wall", () => ({ color: "#e2dacb" })), []);
  const frameMat = useMemo(() => toonLam("pr_frame", () => ({ color: "#455262" })), []);
  const glassMat = useMemo(
    () => basicMat("pr_glass", () => ({ color: "#a8d2ee", transparent: true, opacity: 0.25 })),
    [],
  );
  const woodMat = useMemo(() => toonLam("pr_wood", () => ({ color: "#b68854" })), []);
  const puttyMat = useMemo(() => toonLam("pr_putty", () => ({ color: "#ded8cc" })), []);
  const trofferMat = useMemo(() => basicMat("pr_trof", () => ({ color: "#fff8eb", toneMapped: false })), []);
  const spoolerMat = useMemo(() => basicMat("pr_spool", () => ({ map: getDiegeticTexture("printer_spooler_wall"), toneMapped: false })), []);
  const noticeMat = useMemo(() => basicMat("pr_not", () => ({ map: getDiegeticTexture("printer_notice"), toneMapped: false })), []);
  const redLedMat = useMemo(() => basicMat("pr_led_r", () => ({ color: "#ff3326", toneMapped: false })), []);

  return h(
    "group",
    null,
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [12, 12] })),
    // Back Glass Partition Wall looking out to Bank Hall (z=-1.65)
    h("mesh", { material: wallMat, position: [0, 0.45, -1.65], receiveShadow: true }, h("boxGeometry", { args: [10, 0.9, 0.14] })),
    h("mesh", { material: glassMat, position: [0, 2.05, -1.65], onUpdate: noInk }, h("planeGeometry", { args: [10, 2.3] })),
    ...[-2.5, 0, 2.5].map((mx, i) =>
      h("mesh", { key: `pmul-${i}`, material: frameMat, position: [mx, 2.05, -1.64] }, h("boxGeometry", { args: [0.08, 2.4, 0.16] })),
    ),
    // Bank Hall Far Wall behind glass
    h("mesh", { material: wallMat, position: [0, 2.2, -3.6], receiveShadow: true }, h("boxGeometry", { args: [12, 4.6, 0.2] })),
    // Side walls
    h("mesh", { material: wallMat, position: [-3.4, 2.2, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [10, 4.6, 0.2] })),
    h("mesh", { material: wallMat, position: [3.4, 2.2, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [10, 4.6, 0.2] })),
    // Ceiling Troffers
    ...[-1.2, 1.2].flatMap((tx) =>
      [-0.8, 1.0].map((tz) =>
        h("mesh", { key: `pt-${tx}-${tz}`, material: trofferMat, position: [tx, 3.8, tz], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [1.3, 0.45] })),
      ),
    ),

    // Hero Commercial Laser Printer (center [0, 0, 0])
    h(LaserPrinterHero, { position: [0, 0, 0], u, frame }),

    // Wall Print-Spooler Monitor above printer (framed cleanly in Shot 7B & 7C)
    h(
      "group",
      { position: [0.12, 2.04, -1.35] },
      h("mesh", { material: frameMat, castShadow: true }, h("boxGeometry", { args: [1.44, 0.76, 0.10] })),
      h("mesh", { material: spoolerMat, position: [0, 0, 0.06], onUpdate: noInk }, h("planeGeometry", { args: [1.34, 0.68] })),
    ),

    // Side Backup Dot-Matrix Log Printer & Counter
    h("mesh", { material: woodMat, position: [-1.65, 0.38, -0.45], castShadow: true }, h("boxGeometry", { args: [0.95, 0.76, 0.65] })),
    h("mesh", { material: puttyMat, position: [-1.65, 0.90, -0.45], castShadow: true }, h("boxGeometry", { args: [0.56, 0.26, 0.42] })),
    h("mesh", { material: redLedMat, position: [-1.45, 0.98, -0.22], onUpdate: noInk }, h("boxGeometry", { args: [0.06, 0.04, 0.03] })),

    // Wooden Sorting Tray Cabinet & Rolling Mail Cart
    h("mesh", { material: woodMat, position: [1.65, 0.75, -0.65], castShadow: true }, h("boxGeometry", { args: [0.85, 1.50, 0.48] })),
    h("mesh", { material: frameMat, position: [1.55, 0.42, 0.65], castShadow: true }, h("boxGeometry", { args: [0.68, 0.84, 0.48] })),

    // Framed Security Notice, Toner Box, Shredder Bin, Network Conduit
    h("mesh", { material: noticeMat, position: [-1.65, 1.95, -1.48], onUpdate: noInk }, h("planeGeometry", { args: [0.65, 0.65] })),
    h("mesh", { material: frameMat, position: [-1.75, 0.88, -0.18] }, h("boxGeometry", { args: [0.24, 0.16, 0.18] })),
    h("mesh", { material: frameMat, position: [-1.15, 0.26, 0.52], castShadow: true }, h("cylinderGeometry", { args: [0.18, 0.16, 0.52, 14] })),
    h("mesh", { material: frameMat, position: [0, 0.55, -0.95] }, h("cylinderGeometry", { args: [0.035, 0.035, 1.4, 8] })),
  );
};

// ---------------- SET 5: NightCityDhakaSet (Shot 8 — Intentional Night Target L* ~ 42) ----------------
export const NightCityDhakaSet: React.FC<{
  frame: number;
}> = ({ frame }) => {
  const skyMat = useMemo(
    () => basicMat("dh_sky", () => ({ map: getDiegeticTexture("night_sky"), side: THREE.BackSide, depthWrite: false })),
    [],
  );
  const roadMat = useMemo(() => toonLam("dh_road", () => ({ map: getDiegeticTexture("dhaka_road") })), []);
  const sidewalkMat = useMemo(() => toonLam("dh_sidewalk", () => ({ color: "#687282" })), []);
  const towerMat = useMemo(() => toonLam("dh_tower", () => ({ color: "#d6cab6" })), []);
  const bldgAMat = useMemo(() => toonLam("dh_bldg_a", () => ({ color: "#6b7890" })), []);
  const bldgBMat = useMemo(() => toonLam("dh_bldg_b", () => ({ color: "#787e8f" })), []);
  const darkWinMat = useMemo(() => toonLam("dh_win_dark", () => ({ color: "#2d384c" })), []);
  const dataGlowMat = useMemo(() => basicMat("dh_data_glow", () => ({ color: "#4cf2d8", toneMapped: false })), []);
  const lampGlowMat = useMemo(() => basicMat("dh_lamp_glow", () => ({ color: "#ffbd52", toneMapped: false })), []);
  const lampPoleMat = useMemo(() => toonLam("dh_pole", () => ({ color: "#3d4654" })), []);
  const moonMat = useMemo(() => basicMat("dh_moon", () => ({ color: "#f6f2df", toneMapped: false })), []);
  const clockMat = useMemo(() => basicMat("dh_clk", () => ({ map: getDiegeticTexture("thursday_night_clock"), toneMapped: false })), []);
  const signMat = useMemo(() => basicMat("dh_sign", () => ({ map: getDiegeticTexture("bank_plaza_sign"), toneMapped: false })), []);
  const treeMat = useMemo(() => toonLam("dh_tree", () => ({ color: "#3e624c" })), []);
  const canalMat = useMemo(() => toonLam("dh_canal", () => ({ color: "#365078" })), []);
  const rickshawMat = useMemo(() => toonLam("dh_rick", () => ({ color: "#4c789c" })), []);
  const moteMat = useMemo(() => basicMat("dh_mote", () => ({ color: "#ffe29c", transparent: true, opacity: 0.72, toneMapped: false })), []);

  const serverPulse = ((frame >> 2) % 2) === 0;
  const signalRingY = 7.2 + ((frame * 0.08) % 2.4);

  return h(
    "group",
    null,
    // Luminous Indigo SkyDome & Full Moon
    h("mesh", { material: skyMat, onUpdate: noInk }, h("sphereGeometry", { args: [82, 28, 18] })),
    h("mesh", { material: moonMat, position: [-4.5, 9.5, -24], onUpdate: noInk }, h("sphereGeometry", { args: [1.15, 20, 16] })),

    // Motijheel Boulevard & Canal Strip
    h("mesh", { material: roadMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [22, 28] })),
    h("mesh", { material: sidewalkMat, position: [0, 0.05, -4.5], receiveShadow: true }, h("boxGeometry", { args: [16, 0.10, 6.2] })),
    h("mesh", { material: canalMat, position: [0, 0.02, 5.2], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [18, 2.2] })),

    // Hero Bangladesh Bank Motijheel Tower (background center-right)
    h(
      "group",
      { position: [0.45, 0, -4.8] },
      h("mesh", { material: towerMat, position: [0, 3.6, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [2.6, 7.2, 2.0] })),
      // Sleeping dark windows
      ...[1.4, 2.3, 3.2, 5.0, 5.9].flatMap((wy) =>
        [-0.75, 0, 0.75].map((wx, wi) =>
          h("mesh", { key: `bw-${wy}-${wi}`, material: darkWinMat, position: [wx, wy, 1.02] }, h("boxGeometry", { args: [0.48, 0.42, 0.04] })),
        ),
      ),
      // Covertly active server floor window strip pulsing cyan
      h("mesh", { material: serverPulse ? dataGlowMat : darkWinMat, position: [0, 4.15, 1.02], onUpdate: noInk }, h("boxGeometry", { args: [2.15, 0.36, 0.05] })),
      // Rooftop Microwave Dish Mast & Upward SWIFT Signal Rings
      h("mesh", { material: lampPoleMat, position: [0, 7.6, 0] }, h("cylinderGeometry", { args: [0.06, 0.1, 1.0, 8] })),
      h("mesh", { material: dataGlowMat, position: [0, signalRingY, 0], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("torusGeometry", { args: [0.45 + (signalRingY - 7.2) * 0.25, 0.03, 8, 24] })),
      h("mesh", { material: signMat, position: [0, 0.95, 1.15], onUpdate: noInk }, h("planeGeometry", { args: [2.1, 0.52] })),
    ),

    // Foreground Illuminated Clock & Calendar Monument ("THURSDAY NIGHT | 22:00 BDT")
    h(
      "group",
      { position: [-0.68, 0, 0.55], rotation: [0, 0.18, 0] },
      h("mesh", { material: sidewalkMat, position: [0, 0.65, 0], castShadow: true }, h("boxGeometry", { args: [1.55, 1.30, 0.48] })),
      h("mesh", { material: lampPoleMat, position: [0, 1.80, 0], castShadow: true }, h("boxGeometry", { args: [1.72, 1.00, 0.40] })),
      h("mesh", { material: clockMat, position: [0, 1.80, 0.22], onUpdate: noInk }, h("planeGeometry", { args: [1.62, 0.86] })),
    ),

    // 10 Flanking Dhaka Commercial & Residential Buildings (dark sleeping windows)
    ...[-4.4, -2.5, 2.9, 4.7, -5.8, 6.2].map((bx, i) => {
      const bh = 3.6 + (i % 3) * 1.4;
      const bz = -3.6 - (i % 2) * 2.2;
      return h(
        "group",
        { key: `db-${i}`, position: [bx, 0, bz] },
        h("mesh", { material: i % 2 === 0 ? bldgAMat : bldgBMat, position: [0, bh * 0.5, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.65, bh, 1.8] })),
        h("mesh", { material: darkWinMat, position: [0, bh + 0.22, 0] }, h("cylinderGeometry", { args: [0.22, 0.22, 0.44, 10] })),
      );
    }),

    // 6 Warm Sodium Streetlamps
    ...[-3.4, 0, 3.4].flatMap((lx) =>
      [-1.1, 2.2].map((lz, li) =>
        h(
          "group",
          { key: `sl-${lx}-${li}`, position: [lx, 0, lz] },
          h("mesh", { material: lampPoleMat, position: [0, 1.35, 0] }, h("cylinderGeometry", { args: [0.04, 0.06, 2.7, 8] })),
          h("mesh", { material: lampGlowMat, position: [0, 2.75, 0], onUpdate: noInk }, h("sphereGeometry", { args: [0.16, 12, 10] })),
        ),
      ),
    ),

    // Parked Rickshaws, Roadside Trees, Gatehouse Barrier, Night Mist Motes
    ...[-2.4, 2.2].map((rx, i) =>
      h("mesh", { key: `rk-${i}`, material: rickshawMat, position: [rx, 0.38, 1.6], castShadow: true }, h("boxGeometry", { args: [0.85, 0.72, 0.62] })),
    ),
    ...[-4.2, -2.0, 2.4, 4.4].map((tx, i) =>
      h("mesh", { key: `tr-${i}`, material: treeMat, position: [tx, 0.95, -1.65], castShadow: true }, h("sphereGeometry", { args: [0.58, 10, 8] })),
    ),
    h("mesh", { material: lampGlowMat, position: [0.45, 0.65, -2.8], rotation: [0, 0, 0.05] }, h("boxGeometry", { args: [1.8, 0.08, 0.08] })),
    ...NIGHT_MOTES.map((m, i) =>
      h("mesh", {
        key: `nm-${i}`,
        material: moteMat,
        position: [m.x + Math.sin(frame * 0.03 + m.phase) * 0.15, m.y, m.z],
        scale: m.scale,
        onUpdate: noInk,
      }, h("octahedronGeometry", { args: [1, 0] })),
    ),
  );
};

// ---------------- SET 6: MoneyFlowWorldMapSet (Shots 11, 12, 13) ----------------
export const MoneyFlowWorldMapSet: React.FC<{
  shotId: ShotId;
  u: number;
}> = ({ shotId, u }) => {
  const wallMat = useMemo(() => toonLam("wm_wall", () => ({ color: "#8ba4c2" })), []);
  const floorMat = useMemo(() => toonLam("wm_floor", () => ({ map: getDiegeticTexture("terrazzo_floor"), color: "#9aa8b8" })), []);
  const tableMat = useMemo(() => toonLam("wm_table", () => ({ color: "#3d5066" })), []);
  const brassMat = useMemo(() => toonLam("wm_brass", () => ({ color: "#dcb24c" })), []);
  const oceanMat = useMemo(() => basicMat("wm_ocean", () => ({ map: getDiegeticTexture("world_ocean_grid"), toneMapped: false })), []);
  const landMat = useMemo(() => toonLam("wm_land", () => ({ color: "#e5dcc8" })), []);
  const haloMat = useMemo(() => basicMat("wm_halo", () => ({ color: "#fff8e8", toneMapped: false })), []);
  const emeraldMat = useMemo(() => basicMat("wm_em", () => ({ color: "#3cf2b8", toneMapped: false })), []);
  const amberMat = useMemo(() => basicMat("wm_amb", () => ({ color: "#ffae38", toneMapped: false })), []);

  const boardTex =
    shotId === 11 ? "world_map_header" : shotId === 12 ? "board_101m_moved" : "board_81_20_split";
  const mainBoardMat = useMemo(
    () => basicMat(`wm_mb_${boardTex}`, () => ({ map: getDiegeticTexture(boardTex), toneMapped: false })),
    [boardTex],
  );
  const leftBoardMat = useMemo(() => basicMat("wm_lb", () => ({ map: getDiegeticTexture("board_951m"), toneMapped: false })), []);
  const rightBoardMat = useMemo(() => basicMat("wm_rb", () => ({ map: getDiegeticTexture("board_101m_moved"), toneMapped: false })), []);
  const tagDhakaMat = useMemo(() => basicMat("wm_tdh", () => ({ map: getDiegeticTexture("tag_dhaka_node"), toneMapped: false })), []);
  const tagPhMat = useMemo(() => basicMat("wm_tph", () => ({ map: getDiegeticTexture("tag_ph_node"), toneMapped: false })), []);
  const tagSlMat = useMemo(() => basicMat("wm_tsl", () => ({ map: getDiegeticTexture("tag_sl_node"), toneMapped: false })), []);
  const colPhMat = useMemo(() => basicMat("wm_cph", () => ({ map: getDiegeticTexture("tag_ph_81m"), toneMapped: false })), []);
  const colSlMat = useMemo(() => basicMat("wm_csl", () => ({ map: getDiegeticTexture("tag_sl_20m"), toneMapped: false })), []);

  const dhakaPos: V3 = [-0.62, 1.08, 0.15];
  const phPos: V3 = [0.58, 1.08, -0.10];
  const slPos: V3 = [-0.15, 1.08, 0.48];

  const arcProg = shotId === 11 ? smoothstep(0.05, 0.85, u) : 1;
  const colRise = shotId === 13 ? smoothstep(0.04, 0.42, u) : 0;
  const hPh = 0.06 + colRise * 0.68; // 0.74m tall ($81M — sits cleanly below back breakdown board)
  const hSl = 0.02 + colRise * 0.163; // 0.183m tall ($20M — 4.05x ratio)

  return h(
    "group",
    null,
    // Map Room Shell & Dais
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [16, 16] })),
    h("mesh", { material: wallMat, position: [0, 3.0, -4.0], receiveShadow: true }, h("boxGeometry", { args: [16, 6.2, 0.3] })),
    h("mesh", { material: tableMat, position: [0, 0.08, 0], receiveShadow: true }, h("cylinderGeometry", { args: [3.2, 3.4, 0.16, 36] })),
    h("mesh", { material: haloMat, position: [0, 4.1, 0], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("torusGeometry", { args: [2.4, 0.06, 10, 36] })),

    // Raised 3D Tactical World Map Table
    h(
      "group",
      { position: [0, 0.52, 0] },
      h("mesh", { material: tableMat, castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [3.6, 0.96, 2.1] })),
      h("mesh", { material: brassMat, position: [0, 0.50, 0] }, h("boxGeometry", { args: [3.72, 0.06, 2.22] })),
      h("mesh", { material: oceanMat, position: [0, 0.54, 0], rotation: [-Math.PI / 2, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [3.48, 1.98] })),
      // Extruded 3D Continents (South Asia, SE Asia, Islands)
      h("mesh", { material: landMat, position: [-0.68, 0.57, -0.05], castShadow: true }, h("boxGeometry", { args: [0.85, 0.06, 0.85] })),
      h("mesh", { material: landMat, position: [-0.15, 0.57, 0.48], castShadow: true }, h("boxGeometry", { args: [0.34, 0.07, 0.36] })),
      h("mesh", { material: landMat, position: [0.58, 0.57, -0.10], castShadow: true }, h("boxGeometry", { args: [0.48, 0.07, 0.72] })),
    ),

    // 3 City Node Beacons + Labels
    h(
      "group",
      { position: dhakaPos },
      h("mesh", { material: amberMat, position: [0, 0.10, 0], onUpdate: noInk }, h("cylinderGeometry", { args: [0.06, 0.08, 0.20, 14] })),
      h("mesh", { material: tagDhakaMat, position: [0, 0.28, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.52, 0.13] })),
    ),
    h(
      "group",
      { position: phPos },
      h("mesh", { material: emeraldMat, position: [0, 0.10, 0], onUpdate: noInk }, h("cylinderGeometry", { args: [0.07, 0.09, 0.20, 14] })),
      shotId !== 13 ? h("mesh", { material: tagPhMat, position: [0, 0.30, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.58, 0.15] })) : null,
    ),
    h(
      "group",
      { position: slPos },
      h("mesh", { material: amberMat, position: [0, 0.10, 0], onUpdate: noInk }, h("cylinderGeometry", { args: [0.07, 0.09, 0.20, 14] })),
      shotId !== 13 ? h("mesh", { material: tagSlMat, position: [0, 0.30, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.58, 0.15] })) : null,
    ),

    // Parabolic Money-Flow Arcs (kept below back board height!)
    h(WorldMapArc, { start: dhakaPos, end: phPos, peakY: 0.62, color: "#3cf2b8", progress: arcProg, packetCount: 5 }),
    h(WorldMapArc, { start: dhakaPos, end: slPos, peakY: 0.44, color: "#ffae38", progress: arcProg, packetCount: 3 }),

    // Shot 13: 3D Extruded Split-Comparison Columns ($81M PH vs $20M SL)
    shotId === 13
      ? h(
          "group",
          null,
          h("mesh", { material: emeraldMat, position: [phPos[0], 1.08 + hPh * 0.5, phPos[2]], castShadow: true, onUpdate: noInk }, h("boxGeometry", { args: [0.30, hPh, 0.30] })),
          h("mesh", { material: colPhMat, position: [phPos[0], 1.08 + hPh + 0.15, phPos[2]], onUpdate: noInk }, h("planeGeometry", { args: [0.62, 0.23] })),
          h("mesh", { material: amberMat, position: [slPos[0], 1.08 + hSl * 0.5, slPos[2]], castShadow: true, onUpdate: noInk }, h("boxGeometry", { args: [0.30, hSl, 0.30] })),
          h("mesh", { material: colSlMat, position: [slPos[0], 1.08 + hSl + 0.15, slPos[2]], onUpdate: noInk }, h("planeGeometry", { args: [0.62, 0.23] })),
        )
      : null,

    // Center-Back Curved Diegetic Ledger Board (1.88m x 1.00m, elevated above arcs)
    h(
      "group",
      { position: [0, 2.58, -2.10] },
      h("mesh", { material: tableMat, castShadow: true }, h("boxGeometry", { args: [1.98, 1.08, 0.14] })),
      h("mesh", { material: mainBoardMat, position: [0, 0, 0.08], onUpdate: noInk }, h("planeGeometry", { args: [1.86, 0.98] })),
    ),
    h(
      "group",
      { position: [-2.45, 2.15, -1.85], rotation: [0, 0.25, 0] },
      h("mesh", { material: tableMat }, h("boxGeometry", { args: [1.45, 0.80, 0.12] })),
      h("mesh", { material: leftBoardMat, position: [0, 0, 0.07], onUpdate: noInk }, h("planeGeometry", { args: [1.34, 0.70] })),
    ),
    h(
      "group",
      { position: [2.45, 2.15, -1.85], rotation: [0, -0.25, 0] },
      h("mesh", { material: tableMat }, h("boxGeometry", { args: [1.45, 0.80, 0.12] })),
      h("mesh", { material: rightBoardMat, position: [0, 0, 0.07], onUpdate: noInk }, h("planeGeometry", { args: [1.34, 0.70] })),
    ),

    // 4 Perimeter Brass & Glass Analyst Lecterns
    ...[[-2.1, 0.9], [2.1, 0.9], [-2.1, -0.9], [2.1, -0.9]].map(([lx, lz], i) =>
      h("mesh", { key: `lec-${i}`, material: tableMat, position: [lx, 0.55, lz], castShadow: true }, h("boxGeometry", { args: [0.46, 1.10, 0.36] })),
    ),
  );
};

// ---------------- SET 7: DeutscheBankOfficeSet (Shots 18, 19) ----------------
export const DeutscheBankOfficeSet: React.FC<{
  shotId: ShotId;
  u: number;
}> = ({ shotId, u }) => {
  const floorMat = useMemo(() => toonLam("db_floor", () => ({ map: getDiegeticTexture("office_parquet") })), []);
  const wallMat = useMemo(() => toonLam("db_wall", () => ({ color: "#ebe5da" })), []);
  const birchMat = useMemo(() => toonLam("db_birch", () => ({ color: "#d8be98" })), []);
  const steelMat = useMemo(() => toonLam("db_steel", () => ({ color: "#6a7684" })), []);
  const blueMat = useMemo(() => toonLam("db_blue", () => ({ color: "#1e4a9a" })), []);
  const windowSkyMat = useMemo(() => basicMat("db_sky", () => ({ color: "#d2ebff", toneMapped: false })), []);
  const chairMat = useMemo(() => toonLam("db_chair", () => ({ color: "#626c7a" })), []);
  const plantMat = useMemo(() => toonLam("db_plant", () => ({ color: "#4c8a52" })), []);
  const potMat = useMemo(() => toonLam("db_pot", () => ({ color: "#c26e44" })), []);
  const mugMat = useMemo(() => toonLam("db_mug", () => ({ color: "#f4f2ec" })), []);
  const redPadMat = useMemo(() => basicMat("db_red_pad", () => ({ color: "#dc2626", toneMapped: false })), []);
  const amberPadMat = useMemo(() => basicMat("db_amb_pad", () => ({ color: "#f59e0b", toneMapped: false })), []);
  const headerMat = useMemo(() => basicMat("db_hdr", () => ({ map: getDiegeticTexture("deutsche_wall_header"), toneMapped: false })), []);
  const regMat = useMemo(() => basicMat("db_reg", () => ({ map: getDiegeticTexture("deutsche_registry_book"), toneMapped: false })), []);

  const monTex = shotId === 19 ? "deutsche_query_halt" : "deutsche_screen_spot";
  const monMat = useMemo(
    () => basicMat(`db_mon_${monTex}`, () => ({ map: getDiegeticTexture(monTex), toneMapped: false })),
    [monTex],
  );
  const buttonPressed = shotId === 19 && u >= 0.30;

  return h(
    "group",
    null,
    // Sunlit Frankfurt Office Shell
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [12, 12] })),
    h("mesh", { material: wallMat, position: [0, 2.4, -2.1], receiveShadow: true }, h("boxGeometry", { args: [12, 5.0, 0.24] })),
    h("mesh", { material: wallMat, position: [-4.5, 2.4, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [10, 5.0, 0.24] })),
    h("mesh", { material: wallMat, position: [4.5, 2.4, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [10, 5.0, 0.24] })),
    // Tall Daylight Window Wall on Left
    h("mesh", { material: windowSkyMat, position: [-1.85, 2.15, -1.94], onUpdate: noInk }, h("planeGeometry", { args: [2.2, 2.4] })),
    // Iconic Royal-Blue Deutsche Bank Wall Header
    h(
      "group",
      { position: [0.0, 2.02, -1.92] },
      h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [1.52, 0.42, 0.08] })),
      h("mesh", { material: headerMat, position: [0, 0, 0.045], onUpdate: noInk }, h("planeGeometry", { args: [1.44, 0.35] })),
    ),

    // Primary Birch & Steel Analyst Desk
    h(
      "group",
      { position: [0.26, 0, -0.52] },
      h("mesh", { material: birchMat, position: [0, 0.76, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.92, 0.05, 0.78] })),
      ...[[-0.84, -0.30], [0.84, -0.30], [-0.84, 0.30], [0.84, 0.30]].map(([lx, lz], i) =>
        h("mesh", { key: `dl-${i}`, material: steelMat, position: [lx, 0.38, lz], castShadow: true }, h("boxGeometry", { args: [0.06, 0.76, 0.06] })),
      ),
      // Primary Flagged Routing Monitor (facing +Z toward camera/clerk)
      h(
        "group",
        { position: [0.16, 1.16, -0.02], rotation: [0, -0.14, 0] },
        h("mesh", { material: steelMat, position: [0, -0.24, -0.02] }, h("cylinderGeometry", { args: [0.03, 0.05, 0.22, 10] })),
        h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.64, 0.48, 0.06] })),
        h("mesh", { material: monMat, position: [0, 0, 0.035], onUpdate: noInk }, h("planeGeometry", { args: [0.58, 0.43] })),
        buttonPressed
          ? h("mesh", { material: redPadMat, position: [0, 0.25, 0.04], onUpdate: noInk }, h("boxGeometry", { args: [0.58, 0.022, 0.01] }))
          : null,
      ),
      // Secondary Compliance Monitor
      h(
        "group",
        { position: [0.66, 1.10, -0.14], rotation: [0, -0.45, 0] },
        h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.48, 0.38, 0.05] })),
        h("mesh", { material: monMat, position: [0, 0, 0.03], onUpdate: noInk }, h("planeGeometry", { args: [0.43, 0.33] })),
      ),
      // Physical Red/Amber "HOLD / SEND QUERY" Verification Console Pad
      h(
        "group",
        { position: [-0.36, 0.80, 0.24] },
        h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.22, 0.04, 0.16] })),
        h("mesh", { material: buttonPressed ? redPadMat : amberPadMat, position: [0, buttonPressed ? 0.015 : 0.028, 0], onUpdate: noInk }, h("boxGeometry", { args: [0.12, 0.025, 0.08] })),
      ),
      // Printed Open NGO Registry Book + Magnifying Loupe
      h("mesh", { material: regMat, position: [-0.62, 0.79, 0.16], rotation: [-Math.PI / 2, 0, 0.14], onUpdate: noInk }, h("planeGeometry", { args: [0.34, 0.34] })),
      h("mesh", { material: steelMat, position: [-0.44, 0.80, 0.30] }, h("torusGeometry", { args: [0.045, 0.008, 8, 18] })),
      // Blue-striped Mug & Filing Binders
      h("mesh", { material: mugMat, position: [0.54, 0.84, 0.22], castShadow: true }, h("cylinderGeometry", { args: [0.042, 0.038, 0.10, 14] })),
      ...[0, 1, 2].map((bi) =>
        h("mesh", { key: `fb-${bi}`, material: blueMat, position: [0.80, 0.90, -0.22 + bi * 0.09], castShadow: true }, h("boxGeometry", { args: [0.24, 0.28, 0.07] })),
      ),
      // Silver Architect Desk Lamp
      h("mesh", { material: steelMat, position: [-0.84, 1.05, -0.22], rotation: [0.2, 0, -0.3] }, h("cylinderGeometry", { args: [0.015, 0.015, 0.55, 10] })),
    ),

    // Chair, Plant, Ceiling Linear Lights
    h("mesh", { material: chairMat, position: [1.35, 0.44, -0.65], castShadow: true }, h("boxGeometry", { args: [0.42, 0.08, 0.42] })),
    h(
      "group",
      { position: [-1.85, 0, -0.85] },
      h("mesh", { material: potMat, position: [0, 0.24, 0], castShadow: true }, h("cylinderGeometry", { args: [0.24, 0.18, 0.48, 12] })),
      h("mesh", { material: plantMat, position: [0, 0.78, 0], castShadow: true }, h("sphereGeometry", { args: [0.42, 12, 10] })),
    ),
    ...[-1.0, 1.0].map((lx, i) =>
      h("mesh", { key: `dcl-${i}`, material: windowSkyMat, position: [lx, 3.4, -0.4], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [1.4, 0.28] })),
    ),
  );
};

// ---------------- SET 8: FedReviewRoomSet (Shots 20, 21) ----------------
export const FedReviewRoomSet: React.FC<{
  shotId: ShotId;
  u: number;
}> = ({ shotId, u }) => {
  const floorMat = useMemo(() => toonLam("fed_floor", () => ({ map: getDiegeticTexture("fed_carpet") })), []);
  const wallMat = useMemo(() => toonLam("fed_wall", () => ({ map: getDiegeticTexture("limestone_wall") })), []);
  const mahoganyMat = useMemo(() => toonLam("fed_mahog", () => ({ color: "#6e4730" })), []);
  const brassMat = useMemo(() => toonLam("fed_brass", () => ({ color: "#d8ae4c" })), []);
  const steelMat = useMemo(() => toonLam("fed_steel", () => ({ color: "#3d4858" })), []);
  const chairMat = useMemo(() => toonLam("fed_chair", () => ({ color: "#523b2d" })), []);
  const lampShadeMat = useMemo(() => basicMat("fed_lamp", () => ({ color: "#38a868", toneMapped: false })), []);
  const redBarMat = useMemo(() => basicMat("fed_red_bar", () => ({ color: "#ff3b30", toneMapped: false })), []);
  const scanMat = useMemo(() => basicMat("fed_scan", () => ({ color: "#4cf2ff", transparent: true, opacity: 0.72, toneMapped: false })), []);
  const binderMat = useMemo(() => toonLam("fed_binder", () => ({ color: "#9e2a2b" })), []);

  const headerMat = useMemo(() => basicMat("fed_hdr", () => ({ map: getDiegeticTexture("fed_wall_header"), toneMapped: false })), []);
  const matrixTex = shotId === 21 && u >= 0.20 ? "fed_stopped_board" : "fed_review_matrix";
  const matrixMat = useMemo(
    () => basicMat(`fed_mtx_${matrixTex}`, () => ({ map: getDiegeticTexture(matrixTex), toneMapped: false })),
    [matrixTex],
  );
  const leftWingMat = useMemo(() => basicMat("fed_lw", () => ({ map: getDiegeticTexture("fed_wing_left"), toneMapped: false })), []);
  const rightWingMat = useMemo(() => basicMat("fed_rw", () => ({ map: getDiegeticTexture("fed_wing_right"), toneMapped: false })), []);

  const scanY = 2.55 - smoothstep(0.05, 0.95, u) * 0.90;
  const clampShut = shotId === 21 ? smoothstep(0.16, 0.30, u) : 0;

  return h(
    "group",
    null,
    // Limestone & Mahogany Operations Hall
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [14, 14] })),
    h("mesh", { material: wallMat, position: [0, 2.6, -2.5], receiveShadow: true }, h("boxGeometry", { args: [14, 5.4, 0.28] })),
    h("mesh", { material: mahoganyMat, position: [0, 0.52, -2.35], receiveShadow: true }, h("boxGeometry", { args: [14, 1.04, 0.12] })),
    h("mesh", { material: wallMat, position: [-5.5, 2.6, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [12, 5.4, 0.28] })),
    h("mesh", { material: wallMat, position: [5.5, 2.6, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [12, 5.4, 0.28] })),

    // Overhead Brushed-Bronze Federal Reserve Header
    h(
      "group",
      { position: [0, 3.05, -2.22] },
      h("mesh", { material: brassMat, castShadow: true }, h("boxGeometry", { args: [1.72, 0.44, 0.12] })),
      h("mesh", { material: headerMat, position: [0, 0, 0.065], onUpdate: noInk }, h("planeGeometry", { args: [1.62, 0.38] })),
    ),

    // Giant Center 30-Request Review Matrix Wall (1.64m x 1.18m, frustum-fitted for Shot 21)
    h(
      "group",
      { position: [0, 2.12, -2.22] },
      h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [1.72, 1.24, 0.12] })),
      h("mesh", { material: matrixMat, position: [0, 0, 0.065], onUpdate: noInk }, h("planeGeometry", { args: [1.62, 1.15] })),
      // Sweeping inspection laser bar in Shot 20
      shotId === 20
        ? h("mesh", { material: scanMat, position: [0, scanY - 2.12, 0.08], onUpdate: noInk }, h("planeGeometry", { args: [1.60, 0.045] }))
        : null,
      // Physical 3D crimson lockdown steel perimeter frame bars clamping in Shot 21 (never crossing cells!)
      clampShut > 0.02
        ? h(
            "group",
            { position: [0, 0, 0.09] },
            h("mesh", { material: redBarMat, position: [-0.84, 0, 0], scale: [1, clampShut, 1], onUpdate: noInk }, h("boxGeometry", { args: [0.05, 1.22, 0.04] })),
            h("mesh", { material: redBarMat, position: [0.84, 0, 0], scale: [1, clampShut, 1], onUpdate: noInk }, h("boxGeometry", { args: [0.05, 1.22, 0.04] })),
            h("mesh", { material: redBarMat, position: [0, 0.60, 0], scale: [clampShut, 1, 1], onUpdate: noInk }, h("boxGeometry", { args: [1.72, 0.05, 0.04] })),
            h("mesh", { material: redBarMat, position: [0, -0.60, 0], scale: [clampShut, 1, 1], onUpdate: noInk }, h("boxGeometry", { args: [1.72, 0.05, 0.04] })),
          )
        : null,
    ),

    // Left & Right Status Wing Boards
    h(
      "group",
      { position: [-1.42, 2.12, -2.05], rotation: [0, 0.22, 0] },
      h("mesh", { material: steelMat }, h("boxGeometry", { args: [0.96, 0.54, 0.10] })),
      h("mesh", { material: leftWingMat, position: [0, 0, 0.06], onUpdate: noInk }, h("planeGeometry", { args: [0.88, 0.46] })),
    ),
    h(
      "group",
      { position: [1.42, 2.12, -2.05], rotation: [0, -0.22, 0] },
      h("mesh", { material: steelMat }, h("boxGeometry", { args: [0.96, 0.54, 0.10] })),
      h("mesh", { material: rightWingMat, position: [0, 0, 0.06], onUpdate: noInk }, h("planeGeometry", { args: [0.88, 0.46] })),
    ),

    // Front-Row Tiered Mahogany Review Console + Master Lockdown Lever Console
    h("mesh", { material: mahoganyMat, position: [0, 0.42, -0.15], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [3.6, 0.84, 0.78] })),
    h(DeskConsoleUnit, { position: [-1.35, 0, -0.15], rotationY: Math.PI, screenTex: "fed_review_matrix", binderColor: "#9e2a2b" }),
    h(DeskConsoleUnit, { position: [1.35, 0, -0.15], rotationY: Math.PI, screenTex: "fed_review_matrix", binderColor: "#9e2a2b" }),
    // Master Lockdown Lever Console (actuated by fed_director in Shot 21)
    h(
      "group",
      { position: [-0.36, 0.86, 0.08] },
      h("mesh", { material: steelMat, castShadow: true }, h("boxGeometry", { args: [0.34, 0.08, 0.24] })),
      h("mesh", { material: redBarMat, position: [0, 0.12, 0], rotation: [clampShut * 0.75, 0, 0], onUpdate: noInk }, h("cylinderGeometry", { args: [0.025, 0.025, 0.24, 10] })),
    ),

    // Bankers' Green-Shade Lamps, Chairs, Audit Binders, Flanking Encryption Racks
    ...[-0.9, 0.9].map((lx, i) =>
      h(
        "group",
        { key: `bl-${i}`, position: [lx, 0.86, 0.06] },
        h("mesh", { material: brassMat, position: [0, 0.14, 0] }, h("cylinderGeometry", { args: [0.03, 0.08, 0.28, 12] })),
        h("mesh", { material: lampShadeMat, position: [0, 0.28, 0], rotation: [0, 0, Math.PI / 2], onUpdate: noInk }, h("cylinderGeometry", { args: [0.06, 0.06, 0.18, 10] })),
      ),
    ),
    ...[-1.58, -0.78, 1.38].map((cx, i) =>
      h("mesh", { key: `fch-${i}`, material: chairMat, position: [cx, 0.44, 0.62], castShadow: true }, h("boxGeometry", { args: [0.42, 0.08, 0.42] })),
    ),
    h("mesh", { material: binderMat, position: [0.18, 0.88, -0.05], castShadow: true }, h("boxGeometry", { args: [0.24, 0.05, 0.30] })),
    h(ServerRackUnit, { position: [-2.75, 0, -1.65], rotationY: 0.25, breachProg: shotId === 21 ? 0.9 : 0.3 }),
    h(ServerRackUnit, { position: [2.75, 0, -1.65], rotationY: -0.25, breachProg: shotId === 21 ? 0.9 : 0.3 }),
  );
};
