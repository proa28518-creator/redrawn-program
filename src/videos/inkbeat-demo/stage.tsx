import React, { useMemo } from "react";
import * as THREE from "three";
import { getRepeatedTexture, getStageTextures } from "./textures";

const SkyDome: React.FC<{ skyTex: THREE.CanvasTexture }> = ({ skyTex }) => (
  <mesh position={[0, 12, -16]} userData={{ outline: false }}>
    <sphereGeometry args={[52, 24, 16]} />
    <meshBasicMaterial map={skyTex} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
  </mesh>
);

const CurbstoneRow: React.FC = () => {
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const x = -2.25 + i * 0.9;
    blocks.push(
      <mesh key={`c-back-${i}`} position={[x, 0.08, -2.55]} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.16, 0.26]} />
        <meshStandardMaterial color={i % 2 === 0 ? "#dfd1ba" : "#d0c1a8"} roughness={0.9} />
      </mesh>,
    );
  }
  for (let i = 0; i < 3; i++) {
    const z = -1.75 + i * 1.05;
    blocks.push(
      <mesh key={`c-left-${i}`} position={[-1.62, 0.07, z]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.14, 0.86]} />
        <meshStandardMaterial color="#d8cab2" roughness={0.9} />
      </mesh>,
      <mesh key={`c-right-${i}`} position={[1.62, 0.07, z]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.14, 0.86]} />
        <meshStandardMaterial color="#d8cab2" roughness={0.9} />
      </mesh>,
    );
  }
  return <>{blocks}</>;
};

const ShutteredWindowBay: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Recessed glazing */}
    <mesh position={[0, 0, 0.01]} receiveShadow>
      <boxGeometry args={[0.74, 0.92, 0.06]} />
      <meshStandardMaterial color="#5c6e7c" roughness={0.65} />
    </mesh>
    {/* Mullion cross */}
    <mesh position={[0, 0, 0.045]} castShadow>
      <boxGeometry args={[0.06, 0.88, 0.04]} />
      <meshStandardMaterial color="#e6d9c3" roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.06, 0.045]} castShadow>
      <boxGeometry args={[0.7, 0.06, 0.04]} />
      <meshStandardMaterial color="#e6d9c3" roughness={0.85} />
    </mesh>
    {/* Sill and lintel */}
    <mesh position={[0, -0.52, 0.08]} castShadow receiveShadow>
      <boxGeometry args={[0.98, 0.1, 0.18]} />
      <meshStandardMaterial color="#e3d5be" roughness={0.88} />
    </mesh>
    <mesh position={[0, 0.54, 0.07]} castShadow receiveShadow>
      <boxGeometry args={[0.98, 0.12, 0.16]} />
      <meshStandardMaterial color="#dfd1ba" roughness={0.88} />
    </mesh>
    {/* Left and right shutters with 4 louver slats each */}
    {([-1, 1] as const).map((side) => (
      <group key={side} position={[side * 0.54, 0, 0.06]} rotation={[0, side * -0.22, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.92, 0.05]} />
          <meshStandardMaterial color="#6b8f71" roughness={0.82} />
        </mesh>
        {[-0.3, -0.1, 0.1, 0.3].map((ly, idx) => (
          <mesh key={idx} position={[0, ly, 0.03]} castShadow>
            <boxGeometry args={[0.22, 0.08, 0.04]} />
            <meshStandardMaterial color="#7da383" roughness={0.8} />
          </mesh>
        ))}
      </group>
    ))}
    {/* Terracotta flower box + foliage */}
    <mesh position={[0, -0.66, 0.12]} castShadow receiveShadow>
      <boxGeometry args={[0.76, 0.18, 0.22]} />
      <meshStandardMaterial color="#c96943" roughness={0.85} />
    </mesh>
    {[-0.22, 0, 0.22].map((fx, i) => (
      <mesh key={i} position={[fx, -0.52, 0.13]} castShadow>
        <dodecahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial color={i === 1 ? "#77ab6f" : "#64945d"} roughness={0.85} />
      </mesh>
    ))}
  </group>
);

const StoneArchway: React.FC = () => {
  const voussoirs = useMemo(() => {
    const items: { x: number; y: number; rz: number }[] = [];
    const r = 1.02;
    for (let i = 0; i < 7; i++) {
      const ang = (Math.PI * (i + 0.5)) / 7;
      items.push({
        x: Math.cos(ang) * r,
        y: 3.1 + Math.sin(ang) * r,
        rz: ang - Math.PI / 2,
      });
    }
    return items;
  }, []);

  return (
    <group position={[0, 0, -4.05]}>
      {/* Twin fluted pilasters */}
      {([-1.02, 1.02] as const).map((px, idx) => (
        <group key={idx} position={[px, 0.12, 0]}>
          <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.48, 0.36, 0.56]} />
            <meshStandardMaterial color="#d8cab2" roughness={0.88} />
          </mesh>
          <mesh position={[0, 1.62, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.38, 2.52, 0.46]} />
            <meshStandardMaterial color="#e3d6c0" roughness={0.88} />
          </mesh>
          {[-0.1, 0, 0.1].map((fx, fi) => (
            <mesh key={fi} position={[fx, 1.62, 0.24]} castShadow>
              <boxGeometry args={[0.05, 2.3, 0.04]} />
              <meshStandardMaterial color="#cfc0a7" roughness={0.88} />
            </mesh>
          ))}
          <mesh position={[0, 2.98, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.22, 0.56]} />
            <meshStandardMaterial color="#d8cab2" roughness={0.88} />
          </mesh>
        </group>
      ))}
      {/* 7 Radial arch voussoir blocks */}
      {voussoirs.map((v, i) => (
        <mesh key={i} position={[v.x, v.y, 0]} rotation={[0, 0, v.rz]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.36, 0.48]} />
          <meshStandardMaterial color={i === 3 ? "#ebdEC8" : "#dfd1ba"} roughness={0.88} />
        </mesh>
      ))}
      {/* Spandrel lintel beam */}
      <mesh position={[0, 4.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.24, 0.56]} />
        <meshStandardMaterial color="#d8cab2" roughness={0.88} />
      </mesh>
      {/* Upper balustrade */}
      {Array.from({ length: 8 }, (_, i) => -0.98 + i * 0.28).map((bx, i) => (
        <mesh key={i} position={[bx, 4.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 0.52, 0.14]} />
          <meshStandardMaterial color="#e6d8c3" roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 5.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.14, 0.34]} />
        <meshStandardMaterial color="#dfd1ba" roughness={0.88} />
      </mesh>
    </group>
  );
};

const SlattedCrate: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  woodTex: THREE.CanvasTexture;
}> = ({ position, rotationY = 0, woodTex }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Core recessed block */}
    <mesh position={[0, 0.27, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.48, 0.48, 0.48]} />
      <meshStandardMaterial color="#9e6234" roughness={0.9} />
    </mesh>
    {/* 4 corner frame posts */}
    {[
      [-0.24, -0.24],
      [0.24, -0.24],
      [-0.24, 0.24],
      [0.24, 0.24],
    ].map(([cx, cz], idx) => (
      <mesh key={idx} position={[cx, 0.27, cz]} castShadow receiveShadow>
        <boxGeometry args={[0.07, 0.54, 0.07]} />
        <meshStandardMaterial map={woodTex} roughness={0.85} />
      </mesh>
    ))}
    {/* Horizontal slats on front/back & left/right */}
    {[0.09, 0.27, 0.45].map((sy, idx) => (
      <React.Fragment key={idx}>
        <mesh position={[0, sy, 0.26]} castShadow receiveShadow>
          <boxGeometry args={[0.52, 0.09, 0.04]} />
          <meshStandardMaterial map={woodTex} roughness={0.85} />
        </mesh>
        <mesh position={[0, sy, -0.26]} castShadow receiveShadow>
          <boxGeometry args={[0.52, 0.09, 0.04]} />
          <meshStandardMaterial map={woodTex} roughness={0.85} />
        </mesh>
        <mesh position={[0.26, sy, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.09, 0.52]} />
          <meshStandardMaterial map={woodTex} roughness={0.85} />
        </mesh>
        <mesh position={[-0.26, sy, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.09, 0.52]} />
          <meshStandardMaterial map={woodTex} roughness={0.85} />
        </mesh>
      </React.Fragment>
    ))}
    {/* Top lid planks */}
    <mesh position={[0, 0.54, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.54, 0.05, 0.54]} />
      <meshStandardMaterial map={woodTex} roughness={0.85} />
    </mesh>
  </group>
);

const HoopedBarrel: React.FC<{
  position: [number, number, number];
  woodTex: THREE.CanvasTexture;
}> = ({ position, woodTex }) => (
  <group position={position}>
    <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.29, 0.27, 0.84, 16]} />
      <meshStandardMaterial map={woodTex} roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.26, 0.26, 0.04, 16]} />
      <meshStandardMaterial color="#a86a38" roughness={0.86} />
    </mesh>
    {[0.14, 0.42, 0.7].map((hy, i) => (
      <mesh key={i} position={[0, hy, 0]} castShadow>
        <cylinderGeometry args={[0.31, 0.31, 0.055, 16]} />
        <meshStandardMaterial color="#636973" roughness={0.65} />
      </mesh>
    ))}
  </group>
);

const StreetLantern: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.38, 0.36, 0.38]} />
      <meshStandardMaterial color="#cfc1aa" roughness={0.9} />
    </mesh>
    <mesh position={[0, 1.68, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.06, 0.085, 2.65, 10]} />
      <meshStandardMaterial color="#5e646e" roughness={0.7} />
    </mesh>
    {/* Bracket arm */}
    <mesh position={[0.24, 2.94, 0]} castShadow>
      <boxGeometry args={[0.52, 0.07, 0.07]} />
      <meshStandardMaterial color="#5e646e" roughness={0.7} />
    </mesh>
    <mesh position={[0.14, 2.74, 0]} rotation={[0, 0, 0.72]} castShadow>
      <boxGeometry args={[0.42, 0.055, 0.055]} />
      <meshStandardMaterial color="#5e646e" roughness={0.7} />
    </mesh>
    {/* Hexagonal lantern head */}
    <mesh position={[0.44, 2.68, 0]} castShadow>
      <cylinderGeometry args={[0.16, 0.12, 0.32, 6]} />
      <meshStandardMaterial color="#f5d88a" emissive="#e8b85a" emissiveIntensity={0.35} roughness={0.4} />
    </mesh>
    <mesh position={[0.44, 2.88, 0]} castShadow>
      <coneGeometry args={[0.2, 0.14, 6]} />
      <meshStandardMaterial color="#5e646e" roughness={0.7} />
    </mesh>
    <mesh position={[0.44, 2.49, 0]} castShadow>
      <cylinderGeometry args={[0.14, 0.08, 0.07, 6]} />
      <meshStandardMaterial color="#5e646e" roughness={0.7} />
    </mesh>
  </group>
);

const AmphoraPlanter: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.2, 0.24, 0.2, 12]} />
      <meshStandardMaterial color="#d8cab2" roughness={0.88} />
    </mesh>
    <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.3, 0.2, 0.48, 14]} />
      <meshStandardMaterial color="#c96943" roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.19, 0.26, 0.16, 14]} />
      <meshStandardMaterial color="#c96943" roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.84, 0]} castShadow>
      <cylinderGeometry args={[0.26, 0.23, 0.07, 14]} />
      <meshStandardMaterial color="#d97b54" roughness={0.82} />
    </mesh>
    <mesh position={[0, 1.12, 0]} castShadow>
      <icosahedronGeometry args={[0.3, 1]} />
      <meshStandardMaterial color="#6d9e63" roughness={0.85} />
    </mesh>
    <mesh position={[0, 1.4, 0]} castShadow>
      <icosahedronGeometry args={[0.2, 1]} />
      <meshStandardMaterial color="#7db072" roughness={0.85} />
    </mesh>
  </group>
);

const SlattedBench: React.FC<{
  position: [number, number, number];
  rotationY: number;
  woodTex: THREE.CanvasTexture;
}> = ({ position, rotationY, woodTex }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Legs */}
    {[-0.56, 0.56].map((lx, i) => (
      <React.Fragment key={i}>
        <mesh position={[lx, 0.22, 0.18]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.44, 0.09]} />
          <meshStandardMaterial color="#636973" roughness={0.75} />
        </mesh>
        <mesh position={[lx, 0.44, -0.18]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.88, 0.09]} />
          <meshStandardMaterial color="#636973" roughness={0.75} />
        </mesh>
        <mesh position={[lx, 0.62, 0.02]} castShadow>
          <boxGeometry args={[0.08, 0.07, 0.44]} />
          <meshStandardMaterial color="#636973" roughness={0.75} />
        </mesh>
      </React.Fragment>
    ))}
    {/* 3 Seat planks + 2 Backrest planks */}
    {[-0.12, 0.01, 0.14].map((sz, i) => (
      <mesh key={`s-${i}`} position={[0, 0.45, sz]} castShadow receiveShadow>
        <boxGeometry args={[1.28, 0.05, 0.11]} />
        <meshStandardMaterial map={woodTex} roughness={0.82} />
      </mesh>
    ))}
    {[0.66, 0.82].map((by, i) => (
      <mesh key={`b-${i}`} position={[0, by, -0.15]} castShadow receiveShadow>
        <boxGeometry args={[1.28, 0.11, 0.05]} />
        <meshStandardMaterial map={woodTex} roughness={0.82} />
      </mesh>
    ))}
  </group>
);

const OctagonalWellhead: React.FC<{
  position: [number, number, number];
  woodTex: THREE.CanvasTexture;
}> = ({ position, woodTex }) => {
  const rimBlocks = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI * 2) / 8;
        return { x: Math.cos(a) * 0.46, z: Math.sin(a) * 0.46, ry: -a };
      }),
    [],
  );

  return (
    <group position={position}>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.66, 0.72, 0.18, 8]} />
        <meshStandardMaterial color="#d2c3aa" roughness={0.9} />
      </mesh>
      {rimBlocks.map((b, i) => (
        <mesh key={i} position={[b.x, 0.44, b.z]} rotation={[0, b.ry, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.54, 0.36]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#dfd1ba" : "#d0c1a8"} roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 0.56, 0]} receiveShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 16]} />
        <meshStandardMaterial color="#5ab4d6" roughness={0.25} />
      </mesh>
      {/* Timber cross-frame */}
      {[-0.44, 0.44].map((px, i) => (
        <mesh key={i} position={[px, 1.18, 0]} castShadow>
          <boxGeometry args={[0.09, 1.28, 0.09]} />
          <meshStandardMaterial map={woodTex} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.78, 0]} castShadow>
        <boxGeometry args={[1.08, 0.1, 0.12]} />
        <meshStandardMaterial map={woodTex} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.94, 0]} rotation={[0.42, 0, 0]} castShadow>
        <boxGeometry args={[1.18, 0.08, 0.56]} />
        <meshStandardMaterial color="#c96943" roughness={0.85} />
      </mesh>
    </group>
  );
};

const BistroSet: React.FC<{ position: [number, number, number]; woodTex: THREE.CanvasTexture }> = ({
  position,
  woodTex,
}) => (
  <group position={position}>
    {/* Table pedestal + base + top + wood rim */}
    <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.26, 0.3, 0.12, 12]} />
      <meshStandardMaterial color="#d2c3aa" roughness={0.88} />
    </mesh>
    <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.09, 0.12, 0.62, 12]} />
      <meshStandardMaterial color="#5e646e" roughness={0.72} />
    </mesh>
    <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.44, 0.44, 0.06, 18]} />
      <meshStandardMaterial color="#e8dcc6" roughness={0.8} />
    </mesh>
    <mesh position={[0, 0.72, 0]} castShadow>
      <cylinderGeometry args={[0.47, 0.47, 0.04, 18]} />
      <meshStandardMaterial map={woodTex} roughness={0.82} />
    </mesh>
    {/* Two ceramic pitchers */}
    <mesh position={[-0.12, 0.87, 0.08]} castShadow>
      <cylinderGeometry args={[0.055, 0.075, 0.2, 12]} />
      <meshStandardMaterial color="#d97b54" roughness={0.7} />
    </mesh>
    <mesh position={[0.14, 0.85, -0.08]} castShadow>
      <cylinderGeometry args={[0.045, 0.065, 0.16, 12]} />
      <meshStandardMaterial color="#5b88a8" roughness={0.7} />
    </mesh>
    {/* Two 3-legged stools */}
    {(
      [
        [0.44, 0.26],
        [-0.42, -0.32],
      ] as const
    ).map(([sx, sz], si) => (
      <group key={si} position={[sx, 0, sz]}>
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.18, 0.17, 0.06, 14]} />
          <meshStandardMaterial map={woodTex} roughness={0.82} />
        </mesh>
        {[0, 1, 2].map((li) => {
          const a = (li * Math.PI * 2) / 3;
          return (
            <mesh
              key={li}
              position={[Math.cos(a) * 0.1, 0.24, Math.sin(a) * 0.1]}
              rotation={[Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14]}
              castShadow
            >
              <cylinderGeometry args={[0.03, 0.028, 0.48, 8]} />
              <meshStandardMaterial color="#5e646e" roughness={0.75} />
            </mesh>
          );
        })}
      </group>
    ))}
  </group>
);

const BookLectern: React.FC<{
  position: [number, number, number];
  woodTex: THREE.CanvasTexture;
}> = ({ position, woodTex }) => (
  <group position={position} rotation={[0, -0.35, 0]}>
    <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.44, 0.14, 0.4]} />
      <meshStandardMaterial color="#a3602d" roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.56, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.07, 0.09, 0.86, 10]} />
      <meshStandardMaterial color="#a3602d" roughness={0.85} />
    </mesh>
    <mesh position={[0, 1.02, 0]} rotation={[0.25, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.56, 0.06, 0.42]} />
      <meshStandardMaterial map={woodTex} roughness={0.82} />
    </mesh>
    {/* 4 stacked tomes */}
    <mesh position={[-0.08, 1.09, 0]} rotation={[0.25, 0.12, 0]} castShadow>
      <boxGeometry args={[0.24, 0.06, 0.3]} />
      <meshStandardMaterial color="#c45b4d" roughness={0.8} />
    </mesh>
    <mesh position={[-0.07, 1.15, -0.01]} rotation={[0.25, -0.18, 0]} castShadow>
      <boxGeometry args={[0.22, 0.055, 0.28]} />
      <meshStandardMaterial color="#5882ab" roughness={0.8} />
    </mesh>
    <mesh position={[0.14, 1.08, 0.04]} rotation={[0.25, 0.35, 0]} castShadow>
      <boxGeometry args={[0.18, 0.05, 0.24]} />
      <meshStandardMaterial color="#d4a24e" roughness={0.8} />
    </mesh>
    <mesh position={[0.13, 1.13, 0.03]} rotation={[0.25, -0.05, 0]} castShadow>
      <boxGeometry args={[0.17, 0.048, 0.22]} />
      <meshStandardMaterial color="#6b966a" roughness={0.8} />
    </mesh>
  </group>
);

export const CourtyardStage: React.FC = () => {
  const { skyTex } = getStageTextures();
  const cobbleTex = getRepeatedTexture("cobble", 10, 12);
  const brickTex = getRepeatedTexture("brick", 3, 6);
  const plasterTex = getRepeatedTexture("plaster", 3, 6);
  const woodTex = getRepeatedTexture("wood", 2, 2);

  return (
    <group>
      <SkyDome skyTex={skyTex} />

      {/* Lighting rig targeting sunlit courtyard mean L* 50-54 */}
      <directionalLight
        color="#fff6e5"
        intensity={2.6}
        position={[6, 11, 7]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-bias={-0.0005}
      />
      <directionalLight color="#b8dcff" intensity={1.1} position={[-5, 6, 4]} />
      <hemisphereLight args={["#e6f2ff", "#b89f7d", 0.95]} />
      <ambientLight color="#fffaf0" intensity={0.45} />

      {/* 1. Stepped Plaza Platform & 12 Curbstone Blocks */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[22, 0.1, 26]} />
        <meshStandardMaterial map={cobbleTex} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.06, -3.75]} receiveShadow>
        <boxGeometry args={[9.2, 0.12, 2.3]} />
        <meshStandardMaterial map={plasterTex} roughness={0.9} />
      </mesh>
      <CurbstoneRow />

      {/* 2. Left Terracotta Facade + 6 corner quoins + cornice */}
      <group position={[-2.45, 0, -3.75]}>
        <mesh position={[0, 2.92, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 5.6, 0.45]} />
          <meshStandardMaterial map={brickTex} roughness={0.88} />
        </mesh>
        {[0.65, 1.48, 2.31, 3.14, 3.97, 4.8].map((qy, idx) => (
          <mesh key={idx} position={[1.28, qy, 0.02]} castShadow receiveShadow>
            <boxGeometry args={[idx % 2 === 0 ? 0.34 : 0.24, 0.42, 0.5]} />
            <meshStandardMaterial color="#e2d4bd" roughness={0.88} />
          </mesh>
        ))}
        <mesh position={[0, 5.82, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[2.76, 0.22, 0.68]} />
          <meshStandardMaterial color="#dfd0b8" roughness={0.88} />
        </mesh>
      </group>

      {/* 3. Left Shuttered Window Bays (x2) */}
      <ShutteredWindowBay position={[-1.95, 2.15, -3.48]} />
      <ShutteredWindowBay position={[-1.95, 3.95, -3.48]} />

      {/* 4. Center Stone Archway & Balustrade */}
      <StoneArchway />

      {/* 5. Right Timber-Framed Bakery Facade */}
      <group position={[2.45, 0, -3.65]}>
        <mesh position={[0, 3.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 5.8, 0.45]} />
          <meshStandardMaterial map={plasterTex} roughness={0.9} />
        </mesh>
        {/* 8 relief timber beams/posts & cross-braces */}
        {[-1.12, 0, 1.12].map((bx, i) => (
          <mesh key={`vp-${i}`} position={[bx, 3.0, 0.24]} castShadow receiveShadow>
            <boxGeometry args={[0.14, 5.7, 0.09]} />
            <meshStandardMaterial map={woodTex} roughness={0.85} />
          </mesh>
        ))}
        {[1.7, 3.55, 5.35].map((by, i) => (
          <mesh key={`hb-${i}`} position={[0, by, 0.24]} castShadow receiveShadow>
            <boxGeometry args={[2.56, 0.14, 0.09]} />
            <meshStandardMaterial map={woodTex} roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[-0.56, 4.45, 0.24]} rotation={[0, 0, 0.64]} castShadow>
          <boxGeometry args={[0.12, 1.9, 0.08]} />
          <meshStandardMaterial color="#8f5b34" roughness={0.85} />
        </mesh>
        <mesh position={[0.56, 4.45, 0.24]} rotation={[0, 0, -0.64]} castShadow>
          <boxGeometry args={[0.12, 1.9, 0.08]} />
          <meshStandardMaterial color="#8f5b34" roughness={0.85} />
        </mesh>
        <mesh position={[0, 5.95, 0.22]} rotation={[0.2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.16, 0.95]} />
          <meshStandardMaterial color="#b56343" roughness={0.86} />
        </mesh>
      </group>

      {/* 6. Market Stall & Striped Canopy (with DoubleSide hanging cloth valance) */}
      <group position={[1.92, 0, -2.15]} rotation={[0, -0.22, 0]}>
        {[
          [-0.56, -0.32],
          [0.56, -0.32],
          [-0.56, 0.32],
          [0.56, 0.32],
        ].map(([px, pz], idx) => (
          <mesh key={idx} position={[px, 1.15, pz]} castShadow receiveShadow>
            <boxGeometry args={[0.1, 2.3, 0.1]} />
            <meshStandardMaterial map={woodTex} roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.24, 0.88, 0.72]} />
          <meshStandardMaterial map={woodTex} roughness={0.86} />
        </mesh>
        {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((ax, i) => (
          <mesh key={i} position={[ax, 2.36, 0.06]} rotation={[0.26, 0, 0]} castShadow>
            <boxGeometry args={[0.19, 0.06, 1.02]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#e85d4a" : "#f7ecd5"} roughness={0.82} />
          </mesh>
        ))}
        {/* DoubleSide valance cloth flap exercising clothFlat */}
        <mesh position={[0, 2.08, 0.54]} rotation={[0.08, 0, 0]} castShadow>
          <planeGeometry args={[1.18, 0.34, 6, 2]} />
          <meshStandardMaterial color="#e85d4a" side={THREE.DoubleSide} roughness={0.84} />
        </mesh>
      </group>

      {/* 7. Slatted Wooden Crates (x3) */}
      <SlattedCrate position={[-1.78, 0, -1.12]} rotationY={0.22} woodTex={woodTex} />
      <SlattedCrate position={[-1.74, 0.56, -1.08]} rotationY={-0.32} woodTex={woodTex} />
      <SlattedCrate position={[1.68, 0, -1.28]} rotationY={-0.18} woodTex={woodTex} />

      {/* 8. Hooped Wooden Barrels (x2) */}
      <HoopedBarrel position={[-1.78, 0, -2.02]} woodTex={woodTex} />
      <HoopedBarrel position={[-1.25, 0, -2.35]} woodTex={woodTex} />

      {/* 9. Street Lantern Post */}
      <StreetLantern position={[-1.74, 0, 0.42]} />

      {/* 10. Terracotta Amphora Planters (x2) */}
      <AmphoraPlanter position={[-1.12, 0.12, -3.12]} />
      <AmphoraPlanter position={[1.12, 0.12, -3.12]} />

      {/* 11. Slatted Wooden Market Bench */}
      <SlattedBench position={[-1.88, 0, -0.32]} rotationY={Math.PI / 2 - 0.16} woodTex={woodTex} />

      {/* 12. Octagonal Stone Wellhead / Fountain */}
      <OctagonalWellhead position={[1.55, 0, -2.95]} woodTex={woodTex} />

      {/* 13. Bistro Table & Two Stools */}
      <BistroSet position={[-1.58, 0, 1.25]} woodTex={woodTex} />

      {/* 14. Hanging Guild Signboard */}
      <group position={[1.54, 3.15, -3.22]}>
        <mesh position={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.36, 0.14]} />
          <meshStandardMaterial color="#5e646e" roughness={0.72} />
        </mesh>
        <mesh position={[-0.08, 0.14, 0]} castShadow>
          <boxGeometry args={[0.78, 0.06, 0.06]} />
          <meshStandardMaterial color="#5e646e" roughness={0.72} />
        </mesh>
        {[-0.24, 0.08].map((sx, i) => (
          <mesh key={i} position={[sx, -0.02, 0]} castShadow>
            <boxGeometry args={[0.05, 0.26, 0.05]} />
            <meshStandardMaterial color="#5e646e" roughness={0.72} />
          </mesh>
        ))}
        <mesh position={[-0.08, -0.34, 0]} castShadow>
          <boxGeometry args={[0.56, 0.48, 0.08]} />
          <meshStandardMaterial map={woodTex} roughness={0.82} />
        </mesh>
        <mesh position={[-0.08, -0.34, 0.05]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
          <meshStandardMaterial color="#e2b659" roughness={0.55} />
        </mesh>
      </group>

      {/* 15. Stone Bollards (x4) & Timber Railings */}
      {(
        [
          [-1.82, 1.85],
          [-1.82, 2.75],
          [1.68, 1.35],
          [1.68, 2.25],
        ] as const
      ).map(([bx, bz], i) => (
        <group key={i} position={[bx, 0, bz]}>
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.26, 0.24, 0.26]} />
            <meshStandardMaterial color="#d6c7ae" roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.42, 12]} />
            <meshStandardMaterial color="#dfd1ba" roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.68, 0]} castShadow>
            <sphereGeometry args={[0.11, 12, 10]} />
            <meshStandardMaterial color="#e6d8c3" roughness={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[-1.82, 0.5, 2.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.9, 10]} />
        <meshStandardMaterial color="#a3602d" roughness={0.84} />
      </mesh>
      <mesh position={[1.68, 0.5, 1.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.9, 10]} />
        <meshStandardMaterial color="#a3602d" roughness={0.84} />
      </mesh>

      {/* 16. Scholar's Book Lectern & Stacked Tomes */}
      <BookLectern position={[1.22, 0, -0.22]} woodTex={woodTex} />
    </group>
  );
};
