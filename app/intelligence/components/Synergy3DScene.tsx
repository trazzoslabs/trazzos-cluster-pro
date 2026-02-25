'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export interface SceneNode {
  key: string;
  name: string;
  companyId: string | null;
  synergyCount: number;
  totalVolume: number;
  hasMassiveSynergy: boolean;
}

export interface SceneLink {
  sourceKey: string;
  targetKey: string;
  intensity: number;
}

function ParticleFlow({ origin, count = 28 }: { origin: THREE.Vector3; count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const progressRef = useRef<number[]>([]);

  const base = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const progress = Array.from({ length: count }, () => Math.random());
    progressRef.current = progress;
    return positions;
  }, [count]);

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const arr = points.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i += 1) {
      let t = progressRef.current[i] + delta * 0.25;
      if (t > 1) t = 0;
      progressRef.current[i] = t;

      const x = THREE.MathUtils.lerp(origin.x, 0, t) + Math.sin(i + t * Math.PI * 2) * 0.08;
      const y = THREE.MathUtils.lerp(origin.y, 0, t) + Math.cos(i + t * Math.PI * 2) * 0.08;
      const z = THREE.MathUtils.lerp(origin.z, 0, t);

      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }

    points.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[base, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#9aff8d" size={0.04} sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

function GraphScene({
  nodes,
  links,
  selectedNodeKey,
  onNodeSelect,
}: {
  nodes: SceneNode[];
  links: SceneLink[];
  selectedNodeKey: string | null;
  onNodeSelect: (nodeKey: string | null) => void;
}) {
  const positions = useMemo(() => {
    const out = new Map<string, THREE.Vector3>();
    const total = Math.max(nodes.length, 1);
    nodes.forEach((node, idx) => {
      const angle = (idx / total) * Math.PI * 2;
      const radius = 3.6 + (idx % 2) * 0.5;
      out.set(
        node.key,
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0.2 + (node.synergyCount % 3) * 0.2,
          Math.sin(angle) * radius
        )
      );
    });
    return out;
  }, [nodes]);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} color="#d4fff0" />
      <pointLight position={[0, 2.2, 0]} intensity={0.85} color="#9aff8d" />

      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.4, 64]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.35} />
      </mesh>

      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.4, 0.65, 1.1, 24]} />
        <meshStandardMaterial color="#9aff8d" emissive="#4ade80" emissiveIntensity={0.45} metalness={0.9} roughness={0.22} />
      </mesh>

      {links.map((link) => {
        const a = positions.get(link.sourceKey);
        const b = positions.get(link.targetKey);
        if (!a || !b) return null;
        return (
          <Line
            key={`${link.sourceKey}-${link.targetKey}`}
            points={[a.toArray(), b.toArray()]}
            color="#67e8f9"
            lineWidth={Math.max(0.8, Math.min(2.4, link.intensity))}
            transparent
            opacity={0.65}
          />
        );
      })}

      {nodes.map((node) => {
        const pos = positions.get(node.key);
        if (!pos) return null;
        const selected = selectedNodeKey === node.key;
        const h = 0.7 + Math.min(node.synergyCount, 5) * 0.27;
        const glow = selected ? 0.55 : 0.28;
        return (
          <group key={node.key} position={pos}>
            <mesh
              position={[0, h / 2, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onNodeSelect(selected ? null : node.key);
              }}
            >
              <boxGeometry args={[0.6, h, 0.6]} />
              <meshStandardMaterial
                color={selected ? '#86efac' : '#22c55e'}
                emissive="#16a34a"
                emissiveIntensity={glow}
                metalness={0.85}
                roughness={0.22}
              />
            </mesh>
            {node.hasMassiveSynergy && <ParticleFlow origin={new THREE.Vector3(0, h * 0.55, 0)} />}
          </group>
        );
      })}

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={12}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.0}
      />
      <Environment preset="city" />
    </>
  );
}

export default function Synergy3DScene({
  nodes,
  links,
  selectedNodeKey,
  onNodeSelect,
}: {
  nodes: SceneNode[];
  links: SceneLink[];
  selectedNodeKey: string | null;
  onNodeSelect: (nodeKey: string | null) => void;
}) {
  return (
    <div className="h-[600px] bg-black/50 rounded-lg overflow-hidden border border-zinc-800">
      <Canvas camera={{ position: [0, 5, 8], fov: 45 }} onPointerMissed={() => onNodeSelect(null)}>
        <GraphScene
          nodes={nodes}
          links={links}
          selectedNodeKey={selectedNodeKey}
          onNodeSelect={onNodeSelect}
        />
      </Canvas>
    </div>
  );
}
