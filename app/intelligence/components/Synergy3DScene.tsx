'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html, Line, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
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

function Starfield({ count = 2600 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const r = 16 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, phases };
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.01;
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          attribute float aPhase;
          uniform float uTime;
          varying float vAlpha;
          void main() {
            float twinkle = 0.6 + 0.4 * sin(uTime * 0.8 + aPhase);
            vAlpha = twinkle;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.4 + twinkle * 1.8) * (180.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(0.78, 0.9, 1.0), glow * vAlpha);
          }
        `}
      />
    </points>
  );
}

function LinkFlux({ a, b, count = 12 }: { a: THREE.Vector3; b: THREE.Vector3; count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const progressRef = useRef<number[]>([]);
  const base = useMemo(() => {
    const arr = new Float32Array(count * 3);
    progressRef.current = Array.from({ length: count }, () => Math.random());
    return arr;
  }, [count]);

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const arr = points.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i += 1) {
      let t = progressRef.current[i] + delta * (0.22 + i * 0.003);
      if (t > 1) t = 0;
      progressRef.current[i] = t;
      arr[i * 3] = THREE.MathUtils.lerp(a.x, b.x, t);
      arr[i * 3 + 1] = THREE.MathUtils.lerp(a.y, b.y, t);
      arr[i * 3 + 2] = THREE.MathUtils.lerp(a.z, b.z, t);
    }
    points.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[base, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#7dd3fc" size={0.09} transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

function CenterConvergence({ origin }: { origin: THREE.Vector3 }) {
  const pulseRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!pulseRef.current) return;
    const blend = (Math.sin(state.clock.elapsedTime * 0.7) + 1) / 2;
    pulseRef.current.position.set(
      THREE.MathUtils.lerp(origin.x, 0, blend),
      THREE.MathUtils.lerp(origin.y, 0, blend),
      THREE.MathUtils.lerp(origin.z, 0, blend)
    );
  });
  return (
    <mesh ref={pulseRef}>
      <sphereGeometry args={[0.06, 10, 10]} />
      <meshBasicMaterial color="#a7f3d0" />
    </mesh>
  );
}

function CompanyNode({
  node,
  position,
  selected,
  onSelect,
}: {
  node: SceneNode;
  position: THREE.Vector3;
  selected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const target = selected ? 1.45 : hovered ? 1.25 : 1;
    const next = THREE.MathUtils.lerp(groupRef.current.scale.x, target, delta * 6);
    groupRef.current.scale.setScalar(next);
  });

  const emissive = selected ? 1.8 : hovered ? 1.2 : 0.7;
  return (
    <group ref={groupRef} position={position}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <sphereGeometry args={[0.25 + Math.min(node.synergyCount, 6) * 0.03, 30, 30]} />
        <meshStandardMaterial
          color="#6ee7ff"
          emissive="#22d3ee"
          emissiveIntensity={emissive}
          metalness={0.65}
          roughness={0.18}
        />
      </mesh>
      <pointLight color="#38bdf8" intensity={selected ? 1.7 : 1.1} distance={3.5} />
      <Html sprite center distanceFactor={8}>
        <div className="px-2 py-1 rounded bg-black/55 border border-cyan-400/30 text-[11px] text-cyan-100 whitespace-nowrap">
          {node.name}
        </div>
      </Html>
    </group>
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
      const radius = 4.2 + (idx % 3) * 0.55;
      out.set(
        node.key,
        new THREE.Vector3(
          Math.cos(angle) * radius,
          (idx % 2) * 0.4 - 0.2,
          Math.sin(angle) * radius
        )
      );
    });
    return out;
  }, [nodes]);

  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 9, 36]} />
      <Starfield />

      <ambientLight intensity={0.18} />
      <directionalLight position={[5, 8, 4]} intensity={0.65} color="#dbeafe" />
      <pointLight position={[0, 0, 0]} intensity={1.2} color="#14b8a6" distance={8} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#22d3ee" emissiveIntensity={1.3} metalness={0.8} roughness={0.15} />
      </mesh>

      {links.map((link) => {
        const a = positions.get(link.sourceKey);
        const b = positions.get(link.targetKey);
        if (!a || !b) return null;
        return (
          <Line
            key={`line-${link.sourceKey}-${link.targetKey}`}
            points={[a.toArray(), b.toArray()]}
            color="#38bdf8"
            lineWidth={Math.max(0.9, Math.min(2.7, link.intensity))}
            transparent
            opacity={0.45}
          />
        );
      })}

      {links.map((link) => {
        const a = positions.get(link.sourceKey);
        const b = positions.get(link.targetKey);
        if (!a || !b) return null;
        return <LinkFlux key={`flux-${link.sourceKey}-${link.targetKey}`} a={a} b={b} count={10} />;
      })}

      {nodes.map((node) => {
        const pos = positions.get(node.key);
        if (!pos) return null;
        return (
          <group key={node.key}>
            <CompanyNode
              node={node}
              position={pos}
              selected={selectedNodeKey === node.key}
              onSelect={() => onNodeSelect(selectedNodeKey === node.key ? null : node.key)}
            />
            {node.hasMassiveSynergy && <CenterConvergence origin={pos} />}
          </group>
        );
      })}

      <OrbitControls
        enablePan={false}
        autoRotate={true}
        autoRotateSpeed={0.5}
        enableDamping={true}
        dampingFactor={0.06}
        minDistance={7}
        maxDistance={18}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={(Math.PI * 4) / 5}
      />
      <Environment preset="night" />
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.15} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
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
    <div className="h-[600px] bg-[#020617] rounded-lg overflow-hidden border border-zinc-800">
      <Canvas camera={{ position: [0, 4.8, 10], fov: 47 }} onPointerMissed={() => onNodeSelect(null)}>
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
