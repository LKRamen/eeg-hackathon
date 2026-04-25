"use client";

import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { MutableRefObject, useRef } from "react";
import * as THREE from "three";

import { PhoneAppScreen } from "../components/phone-app";

type PointerRef = MutableRefObject<{ x: number; y: number }>;
type HoverRef = MutableRefObject<boolean>;

function CameraCluster() {
  return (
    <group position={[-0.76, 2.06, -0.19]}>
      <RoundedBox args={[1.18, 1.18, 0.16]} radius={0.28} smoothness={6}>
        <meshPhysicalMaterial color="#132544" metalness={0.3} roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} />
      </RoundedBox>
      {[
        [-0.28, 0.26],
        [0.28, 0.26],
        [-0.28, -0.28],
      ].map(([x, y], index) => (
        <group key={index} position={[x, y, -0.08]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.13, 32]} />
            <meshPhysicalMaterial color="#0b1220" metalness={0.7} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, -0.045]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.06, 32]} />
            <meshPhysicalMaterial color="#152746" metalness={0.1} roughness={0.02} clearcoat={1} clearcoatRoughness={0} transmission={0.12} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.28, -0.28, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.05, 24]} />
        <meshStandardMaterial color="#0a111f" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0.28, -0.02, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 24]} />
        <meshBasicMaterial color="#f3f6ff" />
      </mesh>
    </group>
  );
}

function SideButtons() {
  return (
    <>
      <mesh position={[-1.49, 1.46, -0.02]}>
        <boxGeometry args={[0.05, 0.54, 0.08]} />
        <meshStandardMaterial color="#90afff" metalness={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[1.49, 1.12, -0.01]}>
        <boxGeometry args={[0.05, 0.82, 0.08]} />
        <meshStandardMaterial color="#90afff" metalness={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[-1.49, 2.12, -0.02]}>
        <boxGeometry args={[0.05, 0.22, 0.08]} />
        <meshStandardMaterial color="#90afff" metalness={0.9} roughness={0.24} />
      </mesh>
    </>
  );
}

function PhoneModel({
  pointerRef,
  phoneHoverRef,
}: {
  pointerRef: PointerRef;
  phoneHoverRef: HoverRef;
}) {
  const rigRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!rigRef.current) return;

    const time = state.clock.elapsedTime;
    const autoRotateX = 0.12 + Math.sin(time * 0.62) * 0.04;
    const autoRotateY = -0.34 + Math.cos(time * 0.48) * 0.08;
    const autoRotateZ = -0.08 + Math.sin(time * 0.38) * 0.025;
    const pointerInfluence = phoneHoverRef.current ? { x: 0, y: 0 } : pointerRef.current;

    const targetX = autoRotateX + pointerInfluence.y * -0.22;
    const targetY = autoRotateY + pointerInfluence.x * 0.34;
    const targetZ = autoRotateZ + pointerInfluence.x * -0.05;

    rigRef.current.rotation.x = THREE.MathUtils.damp(rigRef.current.rotation.x, targetX, 4.6, delta);
    rigRef.current.rotation.y = THREE.MathUtils.damp(rigRef.current.rotation.y, targetY, 4.6, delta);
    rigRef.current.rotation.z = THREE.MathUtils.damp(rigRef.current.rotation.z, targetZ, 4.6, delta);
    rigRef.current.position.y = THREE.MathUtils.damp(rigRef.current.position.y, Math.sin(time * 0.55) * 0.12, 3.2, delta);
  });

  return (
    <group ref={rigRef} scale={1.86}>
      <group>
        <RoundedBox args={[3.06, 6.18, 0.34]} radius={0.36} smoothness={8}>
          <meshPhysicalMaterial color="#213867" metalness={0.92} roughness={0.22} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={1.3} />
        </RoundedBox>
        <RoundedBox position={[-0.08, 0, -0.14]} args={[2.9, 6, 0.13]} radius={0.33} smoothness={8}>
          <meshPhysicalMaterial color="#14264c" metalness={0.15} roughness={0.1} clearcoat={1} clearcoatRoughness={0.04} reflectivity={1} envMapIntensity={1.4} />
        </RoundedBox>
        <RoundedBox position={[0, 0, 0.09]} args={[2.78, 5.9, 0.14]} radius={0.31} smoothness={8}>
          <meshPhysicalMaterial color="#0b1221" metalness={0.35} roughness={0.36} clearcoat={1} clearcoatRoughness={0.18} />
        </RoundedBox>
        <RoundedBox position={[0, 0, 0.165]} args={[2.64, 5.76, 0.04]} radius={0.27} smoothness={8}>
          <meshPhysicalMaterial color="#11182b" metalness={0} roughness={0.08} transmission={0.14} transparent opacity={0.62} clearcoat={1} clearcoatRoughness={0.04} />
        </RoundedBox>
        <RoundedBox position={[0, 2.47, 0.186]} args={[0.94, 0.29, 0.05]} radius={0.15} smoothness={6}>
          <meshStandardMaterial color="#020306" metalness={0.3} roughness={0.5} />
        </RoundedBox>
        <CameraCluster />
        <SideButtons />
        <Html transform position={[0, 0, 0.19]} distanceFactor={1.48} wrapperClass="phone-screen-html-wrap" zIndexRange={[20, 0]}>
          <div className="phone-screen-html">
            <PhoneAppScreen />
          </div>
        </Html>
      </group>
    </group>
  );
}

export default function Phone3DScene({
  pointerRef,
  phoneHoverRef,
}: {
  pointerRef: PointerRef;
  phoneHoverRef: HoverRef;
}) {
  return (
    <div className="phone-3d-canvas">
      <Canvas camera={{ position: [0, 0, 8.2], fov: 28 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.25} />
        <directionalLight position={[4, 4, 6]} intensity={2.1} color="#ffffff" />
        <directionalLight position={[-5, 1, 3]} intensity={1.4} color="#7ba8ff" />
        <pointLight position={[0, -3, 5]} intensity={1.1} color="#f0e7ff" />
        <pointLight position={[3, -2, -2]} intensity={0.9} color="#4d7fff" />
        <PhoneModel pointerRef={pointerRef} phoneHoverRef={phoneHoverRef} />
        <ContactShadows position={[0, -3.85, 0]} opacity={0.38} scale={8} blur={2.5} far={6} color="#000000" />
      </Canvas>
    </div>
  );
}
