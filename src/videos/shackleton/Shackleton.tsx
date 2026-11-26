// ShackletonShort — "The Third Man" (RicksClips build, transferred 2026-11-26).
// The scene itself is the plain-JSX RicksClips Scene (Scene.jsx + engine/);
// this thin wrapper gives Root.tsx a typed import and the frame count.
// durationInFrames: project.json duration 60.365s * 30fps = 1811 frames.
// @ts-ignore -- Scene.jsx is plain JSX, bundled by webpack; not type-checked.
import { Scene } from "./Scene.jsx";

export const SHACKLETON_FRAMES = 1811;
export const ShackletonShort = Scene;
