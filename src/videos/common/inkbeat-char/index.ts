// Barrel for the ported inkbeat-shorts character family (Phase 3, as-is port).
// The kit files under char/ and core/ are verbatim; this file only re-exports them.
export { Character3D, blinkAt, bodyYawOf, headOf } from "./char/Character3D";
export type { CharacterProps, CharacterSpec, FaceState, Look, Pose } from "./char/Character3D";
export { CAST } from "./char/cast";
export { holdInFront, handWorld, solveArm } from "./core/ik";
export type { Build, FaceStyle, TorsoKind } from "./char/family";
export type { ArmPose, Layout } from "./char/skeleton";
export type { Eyes, Hat, Mouth, V3 } from "./types";
