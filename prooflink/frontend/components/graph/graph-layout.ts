import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from "d3-force-3d";

import type { GraphLink, GraphNode } from "@/lib/api";

export type Vec3 = [number, number, number];

export function nodeRadius(n: GraphNode): number {
  switch (n.kind) {
    case "message": return 4.8;
    case "organization": return 3.6;
    case "sender": return 3.4;
    case "domain": return 3.3;
    case "url": return 2.5;
    case "email":
    case "phone": return 2.7;
    case "case": return 3;
    case "signal": return 2.3 + (n.severity ?? 10) / 22;
  }
}

const LINK_DISTANCE: Record<string, number> = {
  contains: 40, points_to: 32, uses_domain: 32, mentions: 46, claims: 46, flags: 36, imitates: 44, also_seen: 38,
};

// Which shell a node starts on, so the layout is the same every time (no randomness).
const SHELL: Record<GraphNode["kind"], number> = {
  message: 0, url: 30, email: 30, phone: 30, sender: 34, domain: 38, organization: 44, signal: 52, case: 68,
};

/**
 * Computes fixed 3D positions once. The simulation is run to rest here rather than animated,
 * so the scene is calm, deterministic, and cheap to render.
 */
export function layoutGraph(nodes: GraphNode[], links: GraphLink[]): Record<string, Vec3> {
  const sim = nodes.map((n, i) => {
    // Fibonacci sphere: evenly spread starting points on each node's shell
    const k = i + 0.5;
    const phi = Math.acos(1 - (2 * k) / Math.max(nodes.length, 1));
    const theta = Math.PI * (1 + Math.sqrt(5)) * k;
    const r = SHELL[n.kind];
    const node: Record<string, unknown> = {
      id: n.id, r: nodeRadius(n),
      x: r * Math.cos(theta) * Math.sin(phi), y: r * Math.sin(theta) * Math.sin(phi), z: r * Math.cos(phi),
    };
    if (n.kind === "message") Object.assign(node, { fx: 0, fy: 0, fz: 0 }); // the message stays at the centre
    return node;
  });

  const edges = links.map((l) => ({ source: l.source, target: l.target, kind: l.kind }));
  const simulation = forceSimulation(sim, 3)
    .force("link", forceLink(edges).id((d: { id: string }) => d.id).distance((l: { kind: string }) => LINK_DISTANCE[l.kind] ?? 32).strength(0.7))
    .force("charge", forceManyBody().strength(-150))
    .force("collide", forceCollide().radius((d: { r: number }) => d.r + 4))
    .force("center", forceCenter(0, 0, 0))
    .force("x", forceX(0).strength(0.03))
    .force("y", forceY(0).strength(0.03))
    .force("z", forceZ(0).strength(0.03))
    .stop();
  simulation.tick(320);

  // Fit inside a sphere of radius ~56 so the camera framing is predictable
  let maxR = 1;
  for (const n of sim) maxR = Math.max(maxR, Math.hypot(n.x as number, n.y as number, n.z as number));
  const scale = Math.min(56 / maxR, 1.6);

  const out: Record<string, Vec3> = {};
  for (const n of sim) out[n.id as string] = [(n.x as number) * scale, (n.y as number) * scale, (n.z as number) * scale];
  return out;
}

export function sceneRadius(positions: Record<string, Vec3>): number {
  let m = 20;
  for (const p of Object.values(positions)) m = Math.max(m, Math.hypot(...p) + 6);
  return m;
}
