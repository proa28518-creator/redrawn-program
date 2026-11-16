// Parametric character roster and deterministic pose/gesture drivers for "NasaOrbiter".
// Reuses src/videos/common/inkbeat-char/ (Character3D, holdInFront, blinkAt).
// CRITICAL: safeHoldInFront enforces forward <= 0.15 so arm reach checks always pass.
import React, { useMemo } from "react";
import * as THREE from "three";
import { Character3D, holdInFront } from "../common/inkbeat-char";
import type { CharacterSpec, Pose, V3 } from "../common/inkbeat-char";
import { clamp01, smoothstep } from "./story";
import { getDiegeticTexture, basicMat, h, toonLam } from "./build";
import { NOINK } from "../indiana-bell/ink";

export type CastMemberId =
  | "jpl_lead"
  | "jpl_traj"
  | "jpl_ops"
  | "jpl_telem"
  | "lock_lead"
  | "lock_sys"
  | "lock_cad";

export const NASA_CAST: Record<CastMemberId, CharacterSpec> = {
  jpl_lead: {
    height: 1.76,
    build: { torso: "block", torsoWidth: 1.02 },
    look: {
      skin: "#d39a72",
      outfit: "shirt",
      colors: {
        top: "#7eb6e6",
        inner: "#eef4fa",
        bottom: "#a88e63",
        shoes: "#4a3222",
        accent: "#20385e",
      },
      hair: "crop",
      hairColor: "#26232b",
      glasses: "#2d323c",
      face: { nose: "hook", blush: 0.18, brow: 1.1 },
      seed: 101,
    },
  },
  jpl_traj: {
    height: 1.68,
    build: { torso: "block", torsoWidth: 0.96 },
    look: {
      skin: "#e9b994",
      outfit: "sweater",
      colors: {
        top: "#ede6d6",
        inner: "#f4f6f8",
        bottom: "#3b3d46",
        shoes: "#3c2b22",
        accent: "#d6a137",
      },
      hair: "bun",
      hairColor: "#a04e2c",
      face: { nose: "button", blush: 0.25, lash: true },
      seed: 102,
    },
  },
  jpl_ops: {
    height: 1.80,
    build: { torso: "barrel", torsoWidth: 1.12, torsoDepth: 1.06 },
    look: {
      skin: "#5f3a28",
      outfit: "vest",
      colors: {
        top: "#263c5e",
        inner: "#f2f4f7",
        bottom: "#2e3440",
        shoes: "#22242a",
        accent: "#d6a137",
      },
      hair: "crop",
      hairColor: "#b9bbc0",
      mustache: "#4a4b52",
      face: { nose: "hook", blush: 0.12, brow: 1.2 },
      seed: 103,
    },
  },
  jpl_telem: {
    height: 1.72,
    build: { torso: "block", torsoWidth: 1.0 },
    look: {
      skin: "#b77a52",
      outfit: "shirt",
      colors: {
        top: "#98ccb8",
        inner: "#eef5f0",
        bottom: "#a88e63",
        shoes: "#523828",
        accent: "#e8d6a8",
      },
      hair: "swoop",
      hairColor: "#26232b",
      face: { nose: "button", blush: 0.2 },
      seed: 104,
    },
  },
  lock_lead: {
    height: 1.82,
    build: { torso: "block", torsoWidth: 1.0 },
    look: {
      skin: "#f2cfb6",
      outfit: "shirt",
      colors: {
        top: "#dfb15b",
        inner: "#f5efe2",
        bottom: "#353842",
        shoes: "#452e20",
        accent: "#2d323c",
      },
      hair: "sides",
      hairColor: "#c99a52",
      face: { nose: "hook", blush: 0.15, brow: 1.0 },
      seed: 201,
    },
  },
  lock_sys: {
    height: 1.70,
    build: { torso: "block", torsoWidth: 1.02 },
    look: {
      skin: "#8e5a3c",
      outfit: "jacket",
      colors: {
        top: "#d97b66",
        inner: "#f0e8d8",
        bottom: "#565c68",
        shoes: "#3b2a22",
        accent: "#e8d6a8",
      },
      hair: "curly",
      hairColor: "#26232b",
      face: { nose: "button", blush: 0.22, lash: true },
      seed: 202,
    },
  },
  lock_cad: {
    height: 1.66,
    build: { torso: "pear", torsoWidth: 0.98 },
    look: {
      skin: "#b77a52",
      outfit: "apron",
      colors: {
        top: "#e3d8c4",
        inner: "#4a78a8",
        bottom: "#393f4a",
        shoes: "#382b24",
        accent: "#c99f4b",
      },
      hair: "bob",
      hairColor: "#26232b",
      face: { nose: "button", blush: 0.28, lash: true },
      seed: 203,
    },
  },
};

export type EngineerAction =
  | "typing"
  | "pointing"
  | "holding"
  | "lookup"
  | "slumped"
  | "inspecting";

/** Safe wrapper around holdInFront enforcing forward <= 0.15 (Phase-3 reach constraint). */
export function safeHoldInFront(o: {
  position: V3;
  yaw: number;
  height?: number;
  side?: "L" | "R";
  forward?: number;
  up?: number;
  out?: number;
  build?: CharacterSpec["build"];
}) {
  const safeForward = Math.min(0.15, o.forward ?? 0.15);
  return holdInFront({ ...o, forward: safeForward });
}

/** Deterministic pose function of localFrame & seed. */
export function computeEngineerPose(
  _role: CastMemberId,
  localFrame: number,
  action: EngineerAction,
  seed: number,
  u = 0,
): Pose {
  const f = localFrame;
  switch (action) {
    case "typing": {
      const tapL = Math.sin(f * 0.42 + seed) * 6;
      const tapR = Math.cos(f * 0.48 + seed * 1.7) * 6;
      return {
        lean: 5,
        armL: [34 + tapL, 62 - tapL * 0.6],
        armR: [34 + tapR, 62 - tapR * 0.6],
        armLFwd: 76,
        armRFwd: 76,
        headNod: 10 + Math.sin(f * 0.09 + seed) * 3,
        headYaw: Math.sin(f * 0.07 + seed) * 8,
      };
    }
    case "pointing": {
      const gesture = Math.sin(f * 0.14 + seed) * 6;
      return {
        lean: 2,
        armL: [14, 24],
        armLFwd: 30,
        armR: [96 + gesture, 16],
        armRFwd: 68,
        headNod: -8,
        headYaw: -10 + Math.sin(f * 0.08 + seed) * 6,
      };
    }
    case "inspecting": {
      const wave = Math.sin(f * 0.12 + seed) * 8;
      return {
        lean: 6,
        armL: [52 + wave, 34],
        armLFwd: 62,
        armR: [28, 42],
        armRFwd: 45,
        headNod: 8,
        headYaw: Math.sin(f * 0.09 + seed) * 8,
      };
    }
    case "lookup": {
      const lookProg = smoothstep(0.15, 0.55, u);
      const freeze = 1 - lookProg;
      const tap = Math.sin(f * 0.4 + seed) * 5 * freeze;
      return {
        lean: 4 * freeze,
        armL: [32 + tap - lookProg * 14, 60 - lookProg * 28],
        armR: [32 - tap - lookProg * 14, 60 - lookProg * 28],
        armLFwd: 74 - lookProg * 34,
        armRFwd: 74 - lookProg * 34,
        headNod: 14 - lookProg * 42,
        headYaw: Math.sin(f * 0.06 + seed) * 4,
      };
    }
    case "slumped": {
      return {
        lean: 11,
        armL: [24, 52],
        armR: [24, 52],
        armLFwd: 58,
        armRFwd: 58,
        headNod: 22 + Math.sin(f * 0.05 + seed) * 2,
        headYaw: 0,
      };
    }
    case "holding":
    default:
      return {
        lean: 3,
        headNod: 6,
      };
  }
}

export const EngineerRig: React.FC<{
  id: CastMemberId;
  position: V3;
  yaw: number;
  frame: number;
  localFrame: number;
  u: number;
  action: EngineerAction;
  faceCamera?: V3;
  hold?: "book" | "mug" | null;
  holdSide?: "L" | "R";
  mouth?: "smile" | "flat" | "frown" | "o";
}> = ({
  id,
  position,
  yaw,
  frame,
  localFrame,
  u,
  action,
  faceCamera,
  hold = null,
  holdSide = "R",
  mouth = "flat",
}) => {
  const spec = NASA_CAST[id];
  const seed = spec.look.seed ?? 1;
  const pose = useMemo(() => {
    const base = computeEngineerPose(id, localFrame, action, seed, u);
    if (action === "holding" || hold) {
      const held = safeHoldInFront({
        position,
        yaw,
        height: spec.height,
        side: holdSide,
        forward: 0.15,
        up: 0.45,
        out: 0.10,
        build: spec.build,
      });
      return { ...base, ...held.pose };
    }
    return base;
  }, [id, localFrame, action, seed, u, hold, position, yaw, spec.height, spec.build, holdSide]);

  return h(Character3D, {
    ...spec,
    position,
    yaw,
    t: frame / 30,
    face: { eyes: "open", mouth },
    pose,
    hold,
    holdSide,
    faceCamera,
    faceCameraAmount: faceCamera ? 0.35 : 0,
    castShadow: true,
  });
};

// ---------------- Shot-Specific Room Cast Layouts (Zero Furniture Clipping) ----------------
export const JplRoomCrowd: React.FC<{
  shotId: number;
  frame: number;
  localFrame: number;
  u: number;
  camPos: V3;
}> = ({ shotId, frame, localFrame, u, camPos }) => {
  if (shotId === 4) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_ops", position: [-0.75, 0, -1.65], yaw: 2.65, frame, localFrame, u, action: "pointing", mouth: "smile" }),
      h(EngineerRig, { id: "jpl_lead", position: [-1.75, 0, 0.45], yaw: Math.PI - 0.18, frame, localFrame, u, action: "typing" }),
      h(EngineerRig, { id: "jpl_traj", position: [0.0, 0, 0.45], yaw: Math.PI + 0.12, frame, localFrame, u, action: "typing" }),
      h(EngineerRig, { id: "jpl_telem", position: [1.75, 0, 0.45], yaw: Math.PI + 0.22, frame, localFrame, u, action: "typing" }),
    );
  }

  if (shotId === 5) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_lead", position: [-0.95, 0, 0.25], yaw: 1.05, frame, localFrame, u, action: "inspecting", faceCamera: camPos, mouth: "smile" }),
      h(EngineerRig, { id: "jpl_ops", position: [2.25, 0, 0.72], yaw: -1.15, frame, localFrame, u, action: "pointing", faceCamera: camPos, mouth: "smile" }),
    );
  }

  if (shotId === 9) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_lead", position: [0.65, 0, 0.48], yaw: Math.PI - 0.35, frame, localFrame, u, action: "typing" }),
      h(EngineerRig, { id: "jpl_traj", position: [-0.35, 0, 0.72], yaw: 0.45, frame, localFrame, u, action: "holding", hold: "book", holdSide: "R", faceCamera: camPos }),
      h(EngineerRig, { id: "jpl_telem", position: [1.85, 0, 0.48], yaw: -2.55, frame, localFrame, u, action: "pointing" }),
    );
  }

  if (shotId === 15) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_lead", position: [-1.05, 0, 0.48], yaw: Math.PI - 0.25, frame, localFrame, u, action: "typing" }),
      h(EngineerRig, { id: "jpl_traj", position: [1.05, 0, 0.48], yaw: Math.PI + 0.25, frame, localFrame, u, action: "typing" }),
    );
  }

  if (shotId === 19) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_lead", position: [-1.75, 0, 0.45], yaw: Math.PI - 0.15, frame, localFrame, u, action: "lookup", mouth: "o" }),
      h(EngineerRig, { id: "jpl_traj", position: [-0.55, 0, 0.52], yaw: Math.PI, frame, localFrame, u, action: "lookup", mouth: "o" }),
      h(EngineerRig, { id: "jpl_ops", position: [0.65, 0, 0.52], yaw: Math.PI, frame, localFrame, u, action: "lookup", mouth: "flat" }),
      h(EngineerRig, { id: "jpl_telem", position: [1.75, 0, 0.45], yaw: Math.PI + 0.15, frame, localFrame, u, action: "lookup", mouth: "o" }),
    );
  }

  if (shotId === 22 && u >= 0.58) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_lead", position: [-0.95, 0, 0.48], yaw: Math.PI - 0.22, frame, localFrame, u, action: "slumped", mouth: "frown" }),
      h(EngineerRig, { id: "jpl_ops", position: [0.95, 0, 0.48], yaw: Math.PI + 0.22, frame, localFrame, u, action: "slumped", mouth: "frown" }),
    );
  }

  if (shotId === 23) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "jpl_lead", position: [-1.55, 0, 0.48], yaw: Math.PI - 0.35, frame, localFrame, u, action: "slumped", mouth: "frown" }),
      h(EngineerRig, { id: "jpl_traj", position: [0.05, 0, 0.48], yaw: Math.PI - 0.15, frame, localFrame, u, action: "slumped", mouth: "frown" }),
      h(EngineerRig, { id: "jpl_ops", position: [1.65, 0, 0.48], yaw: Math.PI + 0.05, frame, localFrame, u, action: "slumped", mouth: "frown" }),
    );
  }

  return null;
};

// ---------------- Shot 7 & Shot 10 Dual Team / Handoff Rig ----------------
export const DualTeamRoomRig: React.FC<{
  shotId: number;
  frame: number;
  localFrame: number;
  u: number;
}> = ({ shotId, frame, localFrame, u }) => {
  const cartridgeMat = useMemo(
    () => toonLam("handoff_cart", () => ({ color: "#ff9f2e" })),
    [],
  );
  const cartridgeLabelMat = useMemo(
    () =>
      basicMat("handoff_cart_lbl", () => ({
        map: getDiegeticTexture("sticky_note"),
        toneMapped: false,
      })),
    [],
  );

  if (shotId === 7) {
    return h(
      "group",
      null,
      h(EngineerRig, { id: "lock_lead", position: [-2.35, 0, 0.55], yaw: Math.PI - 0.35, frame, localFrame, u, action: "pointing", mouth: "smile" }),
      h(EngineerRig, { id: "lock_sys", position: [-1.15, 0, 0.58], yaw: Math.PI - 0.15, frame, localFrame, u, action: "typing" }),
      h(EngineerRig, { id: "jpl_lead", position: [1.15, 0, 0.58], yaw: Math.PI + 0.15, frame, localFrame, u, action: "typing" }),
      h(EngineerRig, { id: "jpl_traj", position: [2.35, 0, 0.55], yaw: Math.PI + 0.35, frame, localFrame, u, action: "pointing" }),
    );
  }

  if (shotId === 10) {
    const passT = clamp01((u - 0.15) / 0.7);
    const lockPos: V3 = [-0.56, 0, 0.78];
    const jplPos: V3 = [0.56, 0, 0.78];
    const lockYaw = 1.15;
    const jplYaw = -1.15;
    const hLock = safeHoldInFront({
      position: lockPos,
      yaw: lockYaw,
      height: NASA_CAST.lock_lead.height,
      side: "R",
      forward: 0.15,
      up: 0.48,
      out: 0.10,
      build: NASA_CAST.lock_lead.build,
    });
    const hJpl = safeHoldInFront({
      position: jplPos,
      yaw: jplYaw,
      height: NASA_CAST.jpl_lead.height,
      side: "L",
      forward: 0.15,
      up: 0.48,
      out: 0.10,
      build: NASA_CAST.jpl_lead.build,
    });
    const cartX = hLock.hand[0] + (hJpl.hand[0] - hLock.hand[0]) * passT;
    const cartY = hLock.hand[1] + (hJpl.hand[1] - hLock.hand[1]) * passT + Math.sin(passT * Math.PI) * 0.04;
    const cartZ = hLock.hand[2] + (hJpl.hand[2] - hLock.hand[2]) * passT;

    return h(
      "group",
      null,
      h(Character3D, {
        ...NASA_CAST.lock_lead,
        position: lockPos,
        yaw: lockYaw,
        t: frame / 30,
        face: { eyes: "open", mouth: "smile" },
        pose: { ...hLock.pose, lean: 4, headNod: 8 },
        castShadow: true,
      }),
      h(Character3D, {
        ...NASA_CAST.jpl_lead,
        position: jplPos,
        yaw: jplYaw,
        t: frame / 30,
        face: { eyes: "open", mouth: "flat" },
        pose: { ...hJpl.pose, lean: 4, headNod: 8 },
        castShadow: true,
      }),
      h(
        "group",
        { position: [cartX, cartY, cartZ], rotation: [0.2, 0.15, 0.08] },
        h("mesh", { material: cartridgeMat, castShadow: true }, h("boxGeometry", { args: [0.24, 0.16, 0.04] })),
        h(
          "mesh",
          { material: cartridgeLabelMat, position: [0, 0, 0.022], onUpdate: (s: THREE.Mesh) => s.layers.set(NOINK) },
          h("planeGeometry", { args: [0.18, 0.12] }),
        ),
      ),
    );
  }

  return null;
};

// ---------------- Shot 8 Lockheed Office Team Rig ----------------
export const LockheedTeamRig: React.FC<{
  frame: number;
  localFrame: number;
  u: number;
  camPos: V3;
}> = ({ frame, localFrame, u, camPos }) =>
  h(
    "group",
    null,
    h(EngineerRig, { id: "lock_lead", position: [0.0, 0, -1.24], yaw: 0.05, frame, localFrame, u, action: "holding", hold: "book", holdSide: "R", faceCamera: camPos, mouth: "smile" }),
    h(EngineerRig, { id: "lock_sys", position: [-1.72, 0, -0.18], yaw: 1.22, frame, localFrame, u, action: "pointing", faceCamera: camPos, mouth: "smile" }),
    h(EngineerRig, { id: "lock_cad", position: [1.72, 0, -0.35], yaw: -1.12, frame, localFrame, u, action: "typing", faceCamera: camPos }),
  );
