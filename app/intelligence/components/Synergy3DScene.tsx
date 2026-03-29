'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Grid, Html, Line, OrbitControls } from '@react-three/drei';
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
  /** Sinergia con `status === 'active'` — línea y flujo resaltados (demo Cartagena: p. ej. Reficar–Argos). */
  synergyActive?: boolean;
}

const DEMO_EMERALD_COMPANIES = new Set(['Reficar', 'Yara', 'Argos']);

type CompanySessionVisual = 'inactive' | 'emerald' | 'muted';

function companySessionVisual(sessionDemoActive: boolean, name: string): CompanySessionVisual {
  if (!sessionDemoActive) return 'inactive';
  if (DEMO_EMERALD_COMPANIES.has(name)) return 'emerald';
  return 'muted';
}

function mergeSceneLinks(links: SceneLink[]): SceneLink[] {
  const m = new Map<string, SceneLink>();
  for (const L of links) {
    const k = [L.sourceKey, L.targetKey].sort().join('|');
    const prev = m.get(k);
    if (!prev) {
      m.set(k, { ...L });
    } else {
      m.set(k, {
        ...prev,
        intensity: Math.max(prev.intensity, L.intensity),
        synergyActive: Boolean(prev.synergyActive || L.synergyActive),
      });
    }
  }
  return [...m.values()];
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
            gl_FragColor = vec4(vec3(0.94, 0.96, 0.98), glow * vAlpha);
          }
        `}
      />
    </points>
  );
}

function LinkFlux({
  a,
  b,
  count = 12,
  active = false,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  count?: number;
  active?: boolean;
}) {
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
    const speed = active ? 0.38 : 0.22;
    for (let i = 0; i < count; i += 1) {
      let t = progressRef.current[i] + delta * (speed + i * 0.003);
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
      <pointsMaterial
        color={active ? '#9aff8d' : '#ffffff'}
        size={active ? 0.15 : 0.09}
        transparent
        opacity={active ? 0.98 : 0.85}
        depthWrite={false}
      />
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
  onSelectCompany,
  sessionVisual,
}: {
  node: SceneNode;
  position: THREE.Vector3;
  selected: boolean;
  onSelect: () => void;
  onSelectCompany?: (name: string) => void;
  sessionVisual: CompanySessionVisual;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const target = selected ? 1.45 : hovered ? 1.25 : 1;
    const next = THREE.MathUtils.lerp(groupRef.current.scale.x, target, delta * 6);
    groupRef.current.scale.setScalar(next);
  });

  const emerald = sessionVisual === 'emerald';
  const inactive = sessionVisual === 'inactive';
  const muted = sessionVisual === 'muted';

  const baseColor =
    emerald && !selected ? '#10b981' : inactive || muted ? '#64748b' : selected ? '#9aff8d' : '#74ff9a';
  const emissiveCol =
    emerald && !selected ? '#059669' : inactive || muted ? '#334155' : '#59ff8f';
  const emissive = inactive
    ? selected
      ? 0.5
      : hovered
        ? 0.35
        : 0.12
    : muted
      ? selected
        ? 0.9
        : hovered
          ? 0.55
          : 0.22
      : selected
        ? 2.1
        : hovered
          ? 1.45
          : emerald
            ? 1.35
            : 0.85;

  const showLabel = hovered || selected;
  const lightColor = emerald ? '#10b981' : '#9aff8d';
  const lightIntensity = inactive ? (selected ? 0.6 : 0.25) : emerald ? (selected ? 2.2 : 1.5) : selected ? 2 : 1.2;

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
          onSelectCompany?.(node.name);
          onSelect();
        }}
      >
        <sphereGeometry args={[0.25 + Math.min(node.synergyCount, 6) * 0.03, 30, 30]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveCol}
          emissiveIntensity={emissive}
          metalness={inactive || muted ? 0.25 : 0.65}
          roughness={inactive || muted ? 0.82 : 0.18}
        />
      </mesh>
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.02, 12, 48]} />
          <meshBasicMaterial color={emerald ? '#10b981' : '#9aff8d'} transparent opacity={0.9} />
        </mesh>
      )}
      <pointLight color={lightColor} intensity={lightIntensity} distance={3.8} />
      {showLabel && (
        <Html sprite center distanceFactor={10}>
          <div className="px-2 py-1 rounded bg-gradient-to-b from-zinc-800/90 to-black/85 border border-zinc-500/35 text-[11px] text-white whitespace-nowrap">
            {node.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Fondo tipo “ecosistema industrial”: cúpula interior + suelo en rejilla (sin miles de partículas). */
function IndustrialEcosystemShell() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[72, 48, 48]} />
        <meshBasicMaterial color="#0b1522" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.5, 5.65, 64]} />
        <meshBasicMaterial color="#9aff8d" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <Grid
        infiniteGrid
        fadeDistance={55}
        fadeStrength={1.2}
        sectionSize={10}
        sectionThickness={1.1}
        sectionColor="#1c4d33"
        cellSize={1}
        cellThickness={0.6}
        cellColor="#0f2d1f"
        position={[0, -2.35, 0]}
      />
    </group>
  );
}

function GraphScene({
  nodes,
  links: _links,
  selectedNodeKey,
  onNodeSelect,
  onSelectCompany,
  industrialDemoMode = false,
  sessionDemoActive = false,
}: {
  nodes: SceneNode[];
  links: SceneLink[];
  selectedNodeKey: string | null;
  onNodeSelect: (nodeKey: string | null) => void;
  onSelectCompany?: (name: string) => void;
  industrialDemoMode?: boolean;
  /** Demo cargada: nodos Reficar/Yara/Argos en esmeralda y triángulo de enlaces brillantes. */
  sessionDemoActive?: boolean;
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

  const sessionTriangleLinks = useMemo((): SceneLink[] => {
    if (!sessionDemoActive) return [];
    const keyOf = (name: string) => nodes.find((n) => n.name === name)?.key;
    const r = keyOf('Reficar');
    const y = keyOf('Yara');
    const a = keyOf('Argos');
    if (!r || !y || !a) return [];
    const edge = (sourceKey: string, targetKey: string): SceneLink => ({
      sourceKey,
      targetKey,
      intensity: 3.2,
      synergyActive: true,
    });
    return [edge(r, y), edge(y, a), edge(r, a)];
  }, [sessionDemoActive, nodes]);

  const linksToRender = sessionDemoActive ? sessionTriangleLinks : [];

  return (
    <>
      <color attach="background" args={[industrialDemoMode ? '#070d14' : '#111418']} />
      <fog attach="fog" args={[industrialDemoMode ? '#070d14' : '#111418', 12, 42]} />
      {industrialDemoMode ? <IndustrialEcosystemShell /> : null}
      <Starfield count={industrialDemoMode ? 320 : sessionDemoActive ? 900 : 280} />

      <ambientLight intensity={industrialDemoMode ? 0.32 : sessionDemoActive ? 0.18 : 0.22} />
      <directionalLight position={[5, 8, 4]} intensity={industrialDemoMode ? 0.75 : 0.6} color="#f3f4f6" />
      <pointLight position={[0, 0, 0]} intensity={industrialDemoMode ? 1.35 : 1.1} color="#9aff8d" distance={9} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial
          color={sessionDemoActive ? '#9aff8d' : '#475569'}
          emissive={sessionDemoActive ? '#84ff9f' : '#1e293b'}
          emissiveIntensity={sessionDemoActive ? 1.4 : 0.22}
          metalness={sessionDemoActive ? 0.82 : 0.35}
          roughness={sessionDemoActive ? 0.14 : 0.78}
        />
      </mesh>

      {linksToRender.map((link) => {
        const a = positions.get(link.sourceKey);
        const b = positions.get(link.targetKey);
        if (!a || !b) return null;
        const hot = Boolean(link.synergyActive);
        const w = Math.max(0.9, Math.min(2.7, link.intensity));
        const brightDemo = sessionDemoActive && hot;
        return (
          <Line
            key={`line-${link.sourceKey}-${link.targetKey}`}
            points={[a.toArray(), b.toArray()]}
            color={brightDemo ? '#34d399' : hot ? '#9aff8d' : '#a8b0bc'}
            lineWidth={brightDemo ? 4.2 : hot ? Math.max(2.8, w * 1.15) : w}
            transparent
            opacity={brightDemo ? 1 : hot ? 0.95 : industrialDemoMode ? 0.32 : 0.38}
          />
        );
      })}

      {linksToRender.map((link) => {
        const a = positions.get(link.sourceKey);
        const b = positions.get(link.targetKey);
        if (!a || !b) return null;
        const hot = Boolean(link.synergyActive);
        return (
          <LinkFlux
            key={`flux-${link.sourceKey}-${link.targetKey}`}
            a={a}
            b={b}
            count={sessionDemoActive && hot ? 22 : hot ? 18 : 10}
            active={hot}
          />
        );
      })}

      {nodes.map((node) => {
        const pos = positions.get(node.key);
        if (!pos) return null;
        const sv = companySessionVisual(sessionDemoActive, node.name);
        return (
          <group key={node.key}>
            <CompanyNode
              node={node}
              position={pos}
              selected={selectedNodeKey === node.key}
              sessionVisual={sv}
              onSelectCompany={onSelectCompany}
              onSelect={() => onNodeSelect(selectedNodeKey === node.key ? null : node.key)}
            />
            {node.hasMassiveSynergy && sessionDemoActive && <CenterConvergence origin={pos} />}
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
        <Bloom
          intensity={sessionDemoActive ? 1.55 : 0.75}
          luminanceThreshold={sessionDemoActive ? 0.12 : 0.22}
          luminanceSmoothing={0.28}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function Synergy3DScene({
  nodes,
  links,
  selectedNodeKey,
  onNodeSelect,
  onSelectCompany,
  industrialDemoMode = false,
  sessionDemoActive = false,
}: {
  nodes: SceneNode[];
  links: SceneLink[];
  selectedNodeKey: string | null;
  onNodeSelect: (nodeKey: string | null) => void;
  onSelectCompany?: (name: string) => void;
  /** Demo Cartagena: fondo industrial + menos partículas; sinergias `active` resaltan el enlace. */
  industrialDemoMode?: boolean;
  sessionDemoActive?: boolean;
}) {
  return (
    <div className="h-[600px] bg-[#111418] rounded-lg overflow-hidden border border-zinc-700">
      <Canvas camera={{ position: [0, 4.8, 10], fov: 47 }} onPointerMissed={() => onNodeSelect(null)}>
        <GraphScene
          nodes={nodes}
          links={links}
          selectedNodeKey={selectedNodeKey}
          onNodeSelect={onNodeSelect}
          onSelectCompany={onSelectCompany}
          industrialDemoMode={industrialDemoMode}
          sessionDemoActive={sessionDemoActive}
        />
      </Canvas>
    </div>
  );
}
