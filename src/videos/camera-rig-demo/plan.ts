import {
  camAtFrame,
  closeUp,
  heroLow,
  medium,
  wide,
  type CamPose,
  type SetupSpec,
  type SubjectSpec,
} from '../common/camera-rig';

export const DEMO_FPS = 30;
export const DEMO_DURATION_FRAMES = 369;
export const DEMO_WIDTH = 1080;
export const DEMO_HEIGHT = 1920;

export const DEMO_SUBJECTS: Readonly<Record<'S1' | 'S2' | 'S3' | 'S4', SubjectSpec>> = {
  S1: { feet: [0.0, 0, 0.2], height: 1.75, facing: 0, side: 20 },
  S2: { feet: [-1.2, 0, 0.35], height: 1.72, facing: 0.15, side: 28 },
  S3: { feet: [0.6, 0, 0.3], height: 1.78, facing: -0.2, side: -30 },
  S4: { feet: [2.1, 0, 0.25], height: 1.70, facing: 0.35, side: 25, headAt: 0.92 },
};

export const DEMO_SETUPS: readonly SetupSpec[] = [
  {
    id: 'S1',
    startFrame: 0,
    endFrame: 133,
    base: wide(DEMO_SUBJECTS.S1).cam,
    beats: [
      { t: 62 / DEMO_FPS, move: 'PUSH', dur: 0.63, prm: { frac: 0.14 } },
    ],
  },
  {
    id: 'S2',
    startFrame: 134,
    endFrame: 215,
    base: medium(DEMO_SUBJECTS.S2).cam,
    beats: [
      { t: 0 / DEMO_FPS, move: 'ORBIT_R', dur: 0.63, prm: { deg: 18 } },
      { t: 46 / DEMO_FPS, move: 'CRANE_UP', dur: 0.63, prm: { up: 0.65, tilt: 0.55 } },
    ],
  },
  {
    id: 'S3',
    startFrame: 216,
    endFrame: 287,
    base: heroLow(DEMO_SUBJECTS.S3).cam,
    beats: [
      { t: 36 / DEMO_FPS, move: 'DOLLY_L', dur: 0.63, prm: { side: 0.7 } },
    ],
  },
  {
    id: 'S4',
    startFrame: 288,
    endFrame: 368,
    base: closeUp(DEMO_SUBJECTS.S4).cam,
    beats: [
      { t: 0 / DEMO_FPS, move: 'TILT_UP', dur: 0.63, prm: { deg: 14 } },
    ],
  },
];

/** Deterministic frame-exact camera pose sampler for CameraRigDemo. */
export function sampleDemoCamera(frame: number): CamPose {
  return camAtFrame(DEMO_SETUPS, frame, DEMO_FPS);
}
