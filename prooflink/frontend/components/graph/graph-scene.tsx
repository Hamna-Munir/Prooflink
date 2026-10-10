"use client";

import { Billboard, Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { GraphLink, GraphNode } from "@/lib/api";
import { COLORS, nodeColor } from "./graph-style";
import { nodeRadius, sceneRadius, type Vec3 } from "./graph-layout";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  positions: Record<string, Vec3>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  autoRotate: boolean;
  resetKey: number;
  reduceMotion: boolean;
};

const FOV = 45;
const fitDistance = (radius: number) => (radius / Math.sin((FOV / 2) * (Math.PI / 180))) * 0.98;

function Geometry({ kind, r }: { kind: GraphNode["kind"]; r: number }) {
  switch (kind) {
    case "message": return <icosahedronGeometry args={[r, 1]} />;
    case "organization":
    case "sender": return <boxGeometry args={[r * 1.5, r * 1.5, r * 1.5]} />;
    case "signal": return <octahedronGeometry args={[r, 0]} />;
    case "case": return <torusGeometry args={[r * 0.8, r * 0.3, 14, 36]} />;
    default: return <sphereGeometry args={[r, 28, 20]} />;
  }
}

function NodeMesh({
  node, position, index, state, onSelect, onHover, reduceMotion,
}: {
  node: GraphNode; position: Vec3; index: number;
  state: { selected: boolean; hovered: boolean; dimmed: boolean; showLabel: boolean };
  onSelect: Props["onSelect"]; onHover: Props["onHover"]; reduceMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const r = nodeRadius(node);
  const color = nodeColor(node);
  const inferred = node.kind === "signal" && node.signal_kind === "inference";
  const gl = useThree((s) => s.gl);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const intro = reduceMotion ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - born.current - index * 0.04) / 0.5));
    const eased = 1 - Math.pow(1 - intro, 3);
    const target = (state.selected ? 1.35 : state.hovered ? 1.18 : 1) * eased;
    const next = reduceMotion ? target : THREE.MathUtils.damp(g.scale.x, target, 10, delta);
    g.scale.setScalar(Math.max(next, 0.0001));
    if (node.kind === "message" && !reduceMotion) g.rotation.y += delta * 0.25;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  return (
    <group ref={group} position={position} scale={0.0001}>
      <mesh
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node.id); gl.domElement.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); gl.domElement.style.cursor = "grab"; }}
      >
        <Geometry kind={node.kind} r={r} />
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0.08}
          transparent
          opacity={state.dimmed ? 0.18 : inferred ? 0.5 : 1}
          emissive={node.flagged ? COLORS.flagged : color}
          emissiveIntensity={node.flagged ? 0.35 : state.selected || state.hovered ? 0.25 : 0.05}
        />
      </mesh>

      {state.selected && (
        <Billboard>
          <mesh>
            <ringGeometry args={[r * 1.6, r * 1.8, 56]} />
            <meshBasicMaterial color={COLORS.select} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      )}

      {state.showLabel && !state.dimmed && (
        <Html center position={[0, -(r + 3.4), 0]} distanceFactor={120} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            className={
              "whitespace-nowrap rounded border bg-card/95 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm " +
              (node.flagged ? "border-risk-high/50 text-risk-high" : "border-border text-foreground")
            }
          >
            {node.label.length > 30 ? node.label.slice(0, 29) + "…" : node.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function Edge({
  link, a, b, active, dimmed, showLabel,
}: { link: GraphLink; a: Vec3; b: Vec3; active: boolean; dimmed: boolean; showLabel: boolean }) {
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return (
    <>
      <Line
        points={[a, b]}
        color={active ? COLORS.edgeActive : COLORS.edge}
        lineWidth={active ? 2.2 : 1}
        transparent
        opacity={dimmed ? 0.12 : active ? 1 : 0.55}
        dashed={link.inferred}
        dashSize={2.2}
        gapSize={1.6}
      />
      {showLabel && (
        <Html center position={mid} distanceFactor={120} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[10px] leading-tight text-primary-foreground">{link.label}</div>
        </Html>
      )}
    </>
  );
}

function Rig({
  positions, selectedId, resetKey, autoRotate, reduceMotion, radius,
}: { positions: Record<string, Vec3>; selectedId: string | null; resetKey: number; autoRotate: boolean; reduceMotion: boolean; radius: number }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const [touched, setTouched] = useState(false);

  // Frame the whole graph on load and whenever the user presses "Reset view"
  useEffect(() => {
    const d = fitDistance(radius);
    camera.position.set(0.38, 0.28, 0.88).setLength(d);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    setTouched(false);
  }, [resetKey, radius, camera]);

  // Glide the view's centre to the selected node (or back to the middle)
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const p = selectedId ? positions[selectedId] : undefined;
    goal.set(...(p ?? [0, 0, 0]));
    if (reduceMotion) c.target.copy(goal);
    else c.target.lerp(goal, 0.08);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      minDistance={28}
      maxDistance={420}
      autoRotate={autoRotate && !touched && !reduceMotion}
      autoRotateSpeed={0.6}
      onStart={() => setTouched(true)}
    />
  );
}

export default function GraphScene({
  nodes, links, positions, selectedId, hoveredId, onSelect, onHover, autoRotate, resetKey, reduceMotion,
}: Props) {
  const radius = useMemo(() => sceneRadius(positions), [positions]);
  const focusId = selectedId ?? hoveredId;

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) {
      if (!m.has(l.source)) m.set(l.source, new Set());
      if (!m.has(l.target)) m.set(l.target, new Set());
      m.get(l.source)!.add(l.target);
      m.get(l.target)!.add(l.source);
    }
    return m;
  }, [links]);

  const near = focusId ? neighbours.get(focusId) : undefined;

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.5, far: 2500, position: [0, 0, 160] }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl }) => { gl.domElement.style.cursor = "grab"; }}
    >
      <ambientLight intensity={1.05} />
      <directionalLight position={[60, 80, 90]} intensity={1.2} />
      <directionalLight position={[-60, -40, -60]} intensity={0.35} />

      <Rig positions={positions} selectedId={selectedId} resetKey={resetKey} autoRotate={autoRotate} reduceMotion={reduceMotion} radius={radius} />

      {links.map((l) => {
        const a = positions[l.source];
        const b = positions[l.target];
        if (!a || !b) return null;
        const active = !!focusId && (l.source === focusId || l.target === focusId);
        return (
          <Edge key={`${l.source}>${l.target}>${l.kind}`} link={l} a={a} b={b} active={active} dimmed={!!selectedId && !active} showLabel={active} />
        );
      })}

      {nodes.map((n, i) => {
        const p = positions[n.id];
        if (!p) return null;
        const selected = n.id === selectedId;
        const hovered = n.id === hoveredId;
        const isNear = !!near?.has(n.id);
        return (
          <NodeMesh
            key={n.id}
            node={n}
            position={p}
            index={i}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
            onHover={onHover}
            state={{
              selected,
              hovered,
              dimmed: !!selectedId && !selected && !isNear,
              // Signals are wordy, so their labels only appear when relevant
              showLabel: n.kind !== "signal" || selected || hovered || isNear,
            }}
          />
        );
      })}
    </Canvas>
  );
}
