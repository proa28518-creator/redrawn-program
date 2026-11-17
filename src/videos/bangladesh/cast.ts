// Parametric character roster and deterministic pose/gesture drivers for "BangladeshHeist".
// Reuses src/videos/common/inkbeat-char/ (Character3D, holdInFront).
// CRITICAL: safeHoldInFront enforces forward <= 0.15 so arm reach checks always pass.
import React, { useMemo } from "react";
import { Character3D, holdInFront } from "../common/inkbeat-char";
import type { CharacterSpec, Pose, V3 } from "../common/inkbeat-char";
import { smoothstep } from "./story";
import { h } from "./build";

export type CastMemberId =
  | "hacker_lead"
  | "hacker_net"
  | "hacker_route"
  | "bank_admin"
  | "bank_colleague"
  | "deutsche_clerk"
  | "fed_director"
  | "fed_analyst_1"
  | "fed_analyst_2";

export const BANGLADESH_CAST: Record<CastMemberId, CharacterSpec> = {
  hacker_lead: {
    height: 1.75,
    build: { torso: "block", torsoWidth: 1.0 },
    look: {
      skin: "#d8a882",
      outfit: "jacket",
      colors: {
        top: "#5ea4c4",
        inner: "#e6ebf0",
        bottom: "#b89f78",
        shoes: "#3c3028",
        accent: "#243a4d",
      },
      hair: "swoop",
      hairColor: "#26232b",
      glasses: "#2d323c",
      face: { nose: "hook", blush: 0.15, brow: 1.1 },
      seed: 301,
    },
  },
  hacker_net: {
    height: 1.70,
    build: { torso: "block", torsoWidth: 0.96 },
    look: {
      skin: "#c48a62",
      outfit: "vest",
      colors: {
        top: "#dfaa4c",
        inner: "#ede6d8",
        bottom: "#4a5260",
        shoes: "#2c2f36",
        accent: "#c47e24",
      },
      hair: "crop",
      hairColor: "#242129",
      face: { nose: "button", blush: 0.16, brow: 1.0 },
      seed: 302,
    },
  },
  hacker_route: {
    height: 1.78,
    build: { torso: "barrel", torsoWidth: 1.06 },
    look: {
      skin: "#e8bea0",
      outfit: "sweater",
      colors: {
        top: "#7ec4b0",
        inner: "#e8eef2",
        bottom: "#3b4f6e",
        shoes: "#302b28",
        accent: "#e8d8a8",
      },
      hair: "sides",
      hairColor: "#b89056",
      face: { nose: "hook", blush: 0.18 },
      seed: 303,
    },
  },
  bank_admin: {
    height: 1.74,
    build: { torso: "block", torsoWidth: 1.0 },
    look: {
      skin: "#9c6444",
      outfit: "shirt",
      colors: {
        top: "#8ec2eb",
        inner: "#f2f6fa",
        bottom: "#bfa882",
        shoes: "#422d20",
        accent: "#223b66",
      },
      hair: "crop",
      hairColor: "#1f1d24",
      mustache: "#241d1c",
      face: { nose: "hook", blush: 0.15, brow: 1.1 },
      seed: 304,
    },
  },
  bank_colleague: {
    height: 1.68,
    build: { torso: "block", torsoWidth: 0.96 },
    look: {
      skin: "#a86e4c",
      outfit: "vest",
      colors: {
        top: "#5c7ca0",
        inner: "#f0ece4",
        bottom: "#565e6b",
        shoes: "#362b24",
        accent: "#d4a848",
      },
      hair: "bob",
      hairColor: "#242028",
      glasses: "#2c3440",
      face: { nose: "button", blush: 0.20, lash: true },
      seed: 305,
    },
  },
  deutsche_clerk: {
    height: 1.69,
    build: { torso: "block", torsoWidth: 0.94 },
    look: {
      skin: "#f0cbb2",
      outfit: "jacket",
      colors: {
        top: "#3d72c4",
        inner: "#f5efe4",
        bottom: "#b8bec8",
        shoes: "#362e2a",
        accent: "#d9b04c",
      },
      hair: "bun",
      hairColor: "#9c4b2d",
      glasses: "#2b323c",
      face: { nose: "button", blush: 0.24, lash: true },
      seed: 306,
    },
  },
  fed_director: {
    height: 1.82,
    build: { torso: "barrel", torsoWidth: 1.10, torsoDepth: 1.04 },
    look: {
      skin: "#6b432e",
      outfit: "jacket",
      colors: {
        top: "#c9a678",
        inner: "#f4f6f8",
        bottom: "#5c4d42",
        shoes: "#33241e",
        accent: "#8c2a32",
      },
      hair: "crop",
      hairColor: "#b8bac0",
      face: { nose: "hook", blush: 0.12, brow: 1.2 },
      seed: 307,
    },
  },
  fed_analyst_1: {
    height: 1.68,
    build: { torso: "block", torsoWidth: 0.96 },
    look: {
      skin: "#d8a57e",
      outfit: "vest",
      colors: {
        top: "#426288",
        inner: "#9cc8b0",
        bottom: "#b8a07a",
        shoes: "#3b2c22",
        accent: "#d6ad58",
      },
      hair: "bob",
      hairColor: "#221f26",
      face: { nose: "button", blush: 0.22, lash: true },
      seed: 308,
    },
  },
  fed_analyst_2: {
    height: 1.74,
    build: { torso: "block", torsoWidth: 1.0 },
    look: {
      skin: "#edc5a6",
      outfit: "sweater",
      colors: {
        top: "#e8dec8",
        inner: "#b8d6f0",
        bottom: "#6a7380",
        shoes: "#382e28",
        accent: "#5a7496",
      },
      hair: "curly",
      hairColor: "#6e4c34",
      face: { nose: "button", blush: 0.18 },
      seed: 309,
    },
  },
};

export type HeistAction =
  | "typing"
  | "pointing"
  | "holding"
  | "lookup"
  | "inspecting"
  | "celebrating"
  | "pull_lever"
  | "walking";

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

/** Deterministic pose driver computed purely from localFrame, seed, and u. */
export function computeHeistPose(
  _role: CastMemberId,
  localFrame: number,
  action: HeistAction,
  seed: number,
  u = 0,
): Pose {
  const f = localFrame;
  switch (action) {
    case "typing": {
      const tapL = Math.sin(f * 0.45 + seed) * 6;
      const tapR = Math.cos(f * 0.50 + seed * 1.7) * 6;
      return {
        lean: 5,
        armL: [34 + tapL, 62 - tapL * 0.6],
        armR: [34 + tapR, 62 - tapR * 0.6],
        armLFwd: 74,
        armRFwd: 74,
        headNod: 10 + Math.sin(f * 0.09 + seed) * 3,
        headYaw: Math.sin(f * 0.07 + seed) * 8,
      };
    }
    case "pointing": {
      const gesture = Math.sin(f * 0.14 + seed) * 5;
      return {
        lean: 4,
        armL: [14, 24],
        armLFwd: 28,
        armR: [92 + gesture, 18],
        armRFwd: 66,
        headNod: -6,
        headYaw: -8 + Math.sin(f * 0.08 + seed) * 5,
      };
    }
    case "inspecting": {
      const wave = Math.sin(f * 0.12 + seed) * 6;
      return {
        lean: 6,
        armL: [48 + wave, 34],
        armLFwd: 58,
        armR: [28, 42],
        armRFwd: 45,
        headNod: 8,
        headYaw: Math.sin(f * 0.09 + seed) * 7,
      };
    }
    case "lookup": {
      const lookProg = smoothstep(0.10, 0.55, u);
      const freeze = 1 - lookProg;
      const tap = Math.sin(f * 0.4 + seed) * 4 * freeze;
      return {
        lean: 3 * freeze,
        armL: [30 + tap - lookProg * 14, 56 - lookProg * 26],
        armR: [30 - tap - lookProg * 14, 56 - lookProg * 26],
        armLFwd: 70 - lookProg * 34,
        armRFwd: 70 - lookProg * 34,
        headNod: 8 - lookProg * 34,
        headYaw: Math.sin(f * 0.06 + seed) * 4,
      };
    }
    case "celebrating": {
      const pump = Math.sin(f * 0.22 + seed) * 10;
      return {
        lean: -6,
        armL: [128 + pump, 22],
        armR: [128 - pump, 22],
        armLFwd: 24,
        armRFwd: 24,
        headNod: -12,
        headYaw: Math.sin(f * 0.10 + seed) * 10,
      };
    }
    case "pull_lever": {
      const pull = smoothstep(0.15, 0.35, u);
      return {
        lean: 6 + pull * 5,
        armL: [18, 28],
        armLFwd: 25,
        armR: [95 - pull * 45, 20 + pull * 30],
        armRFwd: 78,
        headNod: -10,
        headYaw: 8,
      };
    }
    case "walking": {
      return {
        walk: f * 0.26 + seed,
        lean: 3,
        headNod: 4,
        headYaw: Math.sin(f * 0.07 + seed) * 6,
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

export const HeistActorRig: React.FC<{
  id: CastMemberId;
  position: V3;
  yaw: number;
  frame: number;
  localFrame: number;
  u: number;
  action: HeistAction;
  faceCamera?: V3;
  hold?: "book" | "mug" | "key" | "phone" | null;
  holdSide?: "L" | "R";
  mouth?: "smile" | "flat" | "frown" | "o" | "grin";
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
  const spec = BANGLADESH_CAST[id];
  const seed = spec.look.seed ?? 1;
  const pose = useMemo(() => {
    const base = computeHeistPose(id, localFrame, action, seed, u);
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

// ---------------- Shot-Specific Room Cast Layouts ----------------

export const HackerTeamRig: React.FC<{
  shotId: number;
  frame: number;
  localFrame: number;
  u: number;
  camPos: V3;
}> = ({ shotId, frame, localFrame, u, camPos }) => {
  if (shotId === 4 && u < 0.46) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "hacker_lead", position: [-0.55, 0, 0.46], yaw: Math.PI - 0.15, frame, localFrame, u, action: "typing" }),
      h(HeistActorRig, { id: "hacker_net", position: [0.85, 0, 0.55], yaw: Math.PI + 0.25, frame, localFrame, u, action: "pointing", faceCamera: camPos }),
    );
  }

  if (shotId === 5) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "hacker_lead", position: [-0.55, 0, 0.46], yaw: Math.PI, frame, localFrame, u, action: "typing" }),
      h(HeistActorRig, { id: "hacker_route", position: [-1.45, 0, 0.72], yaw: 0.42, frame, localFrame, u, action: "holding", hold: "book", holdSide: "R", faceCamera: camPos }),
      h(HeistActorRig, { id: "hacker_net", position: [1.05, 0, 0.48], yaw: Math.PI + 0.35, frame, localFrame, u, action: "inspecting", faceCamera: camPos }),
    );
  }

  if (shotId === 6) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "hacker_lead", position: [-0.42, 0, -0.15], yaw: Math.PI - 0.65, frame, localFrame, u, action: "pointing", faceCamera: camPos }),
      h(HeistActorRig, { id: "hacker_net", position: [1.35, 0, 0.42], yaw: Math.PI + 0.45, frame, localFrame, u, action: "inspecting", faceCamera: camPos }),
      h(HeistActorRig, { id: "hacker_route", position: [-1.15, 0, 0.62], yaw: Math.PI - 0.28, frame, localFrame, u, action: "holding", hold: "book", holdSide: "R", faceCamera: camPos }),
    );
  }

  if (shotId === 9) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "hacker_lead", position: [-0.95, 0, 0.48], yaw: Math.PI - 0.2, frame, localFrame, u, action: "typing" }),
      h(HeistActorRig, { id: "hacker_net", position: [0.95, 0, 0.48], yaw: Math.PI + 0.2, frame, localFrame, u, action: "typing" }),
      h(HeistActorRig, { id: "hacker_route", position: [-1.85, 0, 0.58], yaw: Math.PI - 0.35, frame, localFrame, u, action: "typing" }),
    );
  }

  if (shotId === 14) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "hacker_lead", position: [-0.72, 0, 0.48], yaw: 0.28, frame, localFrame, u, action: "celebrating", faceCamera: camPos, mouth: "grin" }),
      h(HeistActorRig, { id: "hacker_net", position: [0.68, 0, 0.50], yaw: -0.28, frame, localFrame, u, action: "celebrating", faceCamera: camPos, mouth: "smile" }),
      h(HeistActorRig, { id: "hacker_route", position: [-0.08, 0, 0.65], yaw: 0.15, frame, localFrame, u, action: "holding", hold: "mug", holdSide: "R", faceCamera: camPos, mouth: "smile" }),
    );
  }

  return null;
};

export const BankStaffRig: React.FC<{
  shotId: number;
  frame: number;
  localFrame: number;
  u: number;
  camPos: V3;
}> = ({ shotId, frame, localFrame, u, camPos }) => {
  if (shotId === 3) {
    return h(
      "group",
      null,
      h(HeistActorRig, {
        id: "bank_admin",
        position: [-2.05 - u * 0.18, 0, -0.35],
        yaw: -0.35,
        frame,
        localFrame,
        u,
        action: "holding",
        hold: "book",
        holdSide: "R",
        faceCamera: camPos,
      }),
    );
  }

  if (shotId === 7 && u < 0.45) {
    return h(
      "group",
      null,
      h(HeistActorRig, {
        id: "bank_admin",
        position: [-1.15 + u * 4.4, 0, -2.35],
        yaw: Math.PI / 2,
        frame,
        localFrame,
        u,
        action: "walking",
      }),
    );
  }

  if (shotId === 23) {
    return h(
      "group",
      null,
      h(HeistActorRig, {
        id: "bank_admin",
        position: [-0.95, 0, -0.25],
        yaw: Math.PI - 0.35,
        frame,
        localFrame,
        u,
        action: "lookup",
        faceCamera: camPos,
        mouth: "smile",
      }),
      h(HeistActorRig, {
        id: "bank_colleague",
        position: [0.95, 0, -0.25],
        yaw: Math.PI + 0.35,
        frame,
        localFrame,
        u,
        action: "lookup",
        faceCamera: camPos,
        mouth: "smile",
      }),
    );
  }

  return null;
};

export const DeutscheBankClerkRig: React.FC<{
  shotId: number;
  frame: number;
  localFrame: number;
  u: number;
  camPos: V3;
}> = ({ shotId, frame, localFrame, u, camPos }) => {
  if (shotId === 18) {
    return h(
      "group",
      null,
      h(HeistActorRig, {
        id: "deutsche_clerk",
        position: [-0.42, 0, -0.04],
        yaw: 0.64,
        frame,
        localFrame,
        u,
        action: "pointing",
        hold: "book",
        holdSide: "L",
        faceCamera: camPos,
        mouth: "o",
      }),
    );
  }

  if (shotId === 19) {
    return h(
      "group",
      null,
      h(HeistActorRig, {
        id: "deutsche_clerk",
        position: [-0.42, 0, -0.04],
        yaw: 0.66,
        frame,
        localFrame,
        u,
        action: "pull_lever",
        faceCamera: camPos,
        mouth: "flat",
      }),
    );
  }

  return null;
};

export const FedReviewTeamRig: React.FC<{
  shotId: number;
  frame: number;
  localFrame: number;
  u: number;
  camPos: V3;
}> = ({ shotId, frame, localFrame, u, camPos }) => {
  if (shotId === 20) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "fed_director", position: [-0.72, 0, 0.58], yaw: Math.PI - 0.35, frame, localFrame, u, action: "pointing", faceCamera: camPos }),
      h(HeistActorRig, { id: "fed_analyst_1", position: [-1.58, 0, 0.52], yaw: Math.PI - 0.15, frame, localFrame, u, action: "holding", hold: "book", holdSide: "R" }),
      h(HeistActorRig, { id: "fed_analyst_2", position: [1.38, 0, 0.52], yaw: Math.PI + 0.18, frame, localFrame, u, action: "typing" }),
    );
  }

  if (shotId === 21) {
    return h(
      "group",
      null,
      h(HeistActorRig, { id: "fed_director", position: [-0.78, 0, 0.58], yaw: Math.PI - 0.45, frame, localFrame, u, action: "pull_lever", faceCamera: camPos }),
      h(HeistActorRig, { id: "fed_analyst_1", position: [-1.58, 0, 0.52], yaw: Math.PI - 0.15, frame, localFrame, u, action: "lookup", mouth: "o" }),
      h(HeistActorRig, { id: "fed_analyst_2", position: [1.38, 0, 0.52], yaw: Math.PI + 0.18, frame, localFrame, u, action: "lookup" }),
    );
  }

  return null;
};
