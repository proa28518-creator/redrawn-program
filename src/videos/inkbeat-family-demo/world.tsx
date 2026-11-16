// Simple street set in the Indiana Bell idiom, written fresh for this demo with
// primitives only (boxes / planes / cylinders). It imports nothing from any
// existing production. Flat-shaded standard materials, warm daylight.
import React from "react";

const FacadeWindows: React.FC = () => {
  const windows: React.ReactNode[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 7; col++) {
      const lit = (row * 7 + col) % 5 === 2;
      windows.push(
        <mesh key={`${row}-${col}`} position={[-6.3 + col * 2.1, 2.1 + row * 1.9, -3.16]}>
          <boxGeometry args={[1.05, 1.3, 0.06]} />
          <meshStandardMaterial color={lit ? "#d8a95c" : "#54626e"} roughness={0.9} />
        </mesh>,
      );
    }
  }
  return <>{windows}</>;
};

export const StreetSet: React.FC = () => (
  <group>
    {/* street */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 4]} receiveShadow>
      <planeGeometry args={[46, 30]} />
      <meshStandardMaterial color="#7d7264" roughness={1} />
    </mesh>
    {/* sidewalk */}
    <mesh position={[0, 0, -0.6]} receiveShadow>
      <boxGeometry args={[18, 0.12, 4.6]} />
      <meshStandardMaterial color="#b3a184" roughness={1} />
    </mesh>
    {/* building facade backdrop */}
    <mesh position={[0, 3.9, -3.4]}>
      <boxGeometry args={[18, 7.8, 0.4]} />
      <meshStandardMaterial color="#c4ab8d" roughness={1} />
    </mesh>
    <FacadeWindows />
    {/* cornice */}
    <mesh position={[0, 7.85, -3.3]}>
      <boxGeometry args={[18.4, 0.35, 0.7]} />
      <meshStandardMaterial color="#a68d6d" roughness={1} />
    </mesh>
    {/* storefront + awning, left */}
    <mesh position={[-5.6, 1.05, -3.05]}>
      <boxGeometry args={[3.4, 2.1, 0.25]} />
      <meshStandardMaterial color="#4c5a63" roughness={0.85} />
    </mesh>
    <mesh position={[-5.6, 2.35, -2.75]} rotation={[0.5, 0, 0]}>
      <boxGeometry args={[3.7, 0.08, 1.1]} />
      <meshStandardMaterial color="#b0503c" roughness={1} />
    </mesh>
    {/* streetlamp, right */}
    <mesh position={[3.6, 1.9, -1.9]}>
      <cylinderGeometry args={[0.05, 0.07, 3.8, 10]} />
      <meshStandardMaterial color="#3b3d46" roughness={0.7} />
    </mesh>
    <mesh position={[3.6, 3.9, -1.9]}>
      <sphereGeometry args={[0.17, 14, 10]} />
      <meshStandardMaterial color="#f2d492" emissive="#d8a95c" emissiveIntensity={0.55} roughness={0.4} />
    </mesh>
    {/* crates for depth, right foreground */}
    <mesh position={[2.9, 0.31, 1.6]}>
      <boxGeometry args={[0.62, 0.62, 0.62]} />
      <meshStandardMaterial color="#96754d" roughness={1} />
    </mesh>
    <mesh position={[2.85, 0.9, 1.55]} rotation={[0, 0.4, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#a8834f" roughness={1} />
    </mesh>
    {/* barrel, left foreground */}
    <mesh position={[-3.1, 0.42, 1.3]}>
      <cylinderGeometry args={[0.34, 0.3, 0.84, 14]} />
      <meshStandardMaterial color="#6b4b3b" roughness={1} />
    </mesh>
  </group>
);
