import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { applyCam, assertCamAppliedThisFrame } from "../common/applyCam";
import { Character3D } from "../common/inkbeat-char/char/Character3D";
import { DEMO_CAST } from "../inkbeat-family-demo/demoCast";
import { StreetSet } from "../inkbeat-family-demo/world";
import {
  DEMO_DURATION_FRAMES,
  DEMO_HEIGHT,
  DEMO_SUBJECTS,
  DEMO_WIDTH,
  sampleDemoCamera,
} from "./plan";

export const DEMO_FRAMES = DEMO_DURATION_FRAMES;

const StaticCast: React.FC = () => (
  <>
    <Character3D
      {...DEMO_CAST.adult}
      height={DEMO_SUBJECTS.S1.height}
      position={DEMO_SUBJECTS.S1.feet}
      yaw={DEMO_SUBJECTS.S1.facing}
      face={{ eyes: "open", mouth: "smile" }}
      castShadow
    />
    <Character3D
      {...DEMO_CAST.barrel}
      height={DEMO_SUBJECTS.S2.height}
      position={DEMO_SUBJECTS.S2.feet}
      yaw={DEMO_SUBJECTS.S2.facing}
      face={{ eyes: "open", mouth: "smirk" }}
      castShadow
    />
    <Character3D
      {...DEMO_CAST.tall}
      height={DEMO_SUBJECTS.S3.height}
      position={DEMO_SUBJECTS.S3.feet}
      yaw={DEMO_SUBJECTS.S3.facing}
      face={{ eyes: "open", mouth: "flat" }}
      castShadow
    />
    <Character3D
      {...DEMO_CAST.pear}
      height={DEMO_SUBJECTS.S4.height}
      position={DEMO_SUBJECTS.S4.feet}
      yaw={DEMO_SUBJECTS.S4.facing}
      face={{ eyes: "open", mouth: "smile" }}
      castShadow
    />
    <Character3D
      {...DEMO_CAST.kid}
      position={[-2.2, 0, -0.8]}
      yaw={0.25}
      face={{ eyes: "open", mouth: "grin" }}
      castShadow
    />
    <Character3D
      {...DEMO_CAST.elder}
      position={[1.35, 0, -0.95]}
      yaw={-0.35}
      face={{ eyes: "open", mouth: "smile" }}
      castShadow
    />
  </>
);

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const pose = sampleDemoCamera(frame);
  applyCam(camera, pose, frame);
  assertCamAppliedThisFrame(frame);

  return (
    <>
      <hemisphereLight args={["#fff2dd", "#5a4a3a", 0.9]} />
      <directionalLight position={[4.5, 7.5, 5.5]} intensity={1.55} />
      <directionalLight position={[-5, 3.5, -2]} intensity={0.35} />
      <StreetSet />
      <StaticCast />
    </>
  );
};

export const CameraRigDemo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#241c26" }}>
    <ThreeCanvas
      width={DEMO_WIDTH}
      height={DEMO_HEIGHT}
      shadows
      gl={{ antialias: true, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.2, far: 1500 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene />
    </ThreeCanvas>
  </AbsoluteFill>
);
