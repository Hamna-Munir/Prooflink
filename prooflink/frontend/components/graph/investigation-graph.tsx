"use client";

import { Box, List, Pause, Play, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { InvestigationGraph } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GraphList } from "./graph-list";
import { layoutGraph } from "./graph-layout";
import { COLORS } from "./graph-style";
import { NodeInspector } from "./node-inspector";

// three.js only loads on this page, and only in the browser.
const GraphScene = dynamic(() => import("./graph-scene"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading 3D view…</div>,
});

class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function LegendItem({ children, swatch }: { children: ReactNode; swatch: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex h-4 w-4 items-center justify-center" aria-hidden>{swatch}</span>
      {children}
    </li>
  );
}

export function InvestigationGraphView({ graph }: { graph: InvestigationGraph }) {
  const [view, setView] = useState<"3d" | "list">("3d");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const ok = hasWebGL();
    setWebgl(ok);
    if (!ok) setView("list");
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const positions = useMemo(() => layoutGraph(graph.nodes, graph.links), [graph]);
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const only = graph.nodes.length === 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="View" className="inline-flex rounded-lg border border-border bg-card p-1">
            {([["3d", "3D view", Box], ["list", "List view", List]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                disabled={v === "3d" && !webgl}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          {view === "3d" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAutoRotate((a) => !a)} aria-pressed={autoRotate}>
                {autoRotate ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                {autoRotate ? "Pause rotation" : "Auto-rotate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setResetKey((k) => k + 1); }}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset view
              </Button>
            </div>
          )}
        </div>

        {!webgl && (
          <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Your browser can&apos;t show the 3D view, so here is the same information as a list.
          </p>
        )}

        {view === "3d" && webgl ? (
          <div
            className="relative h-[26rem] overflow-hidden rounded-xl border border-border bg-card sm:h-[34rem]"
            role="img"
            aria-label={`3D relationship graph with ${graph.counts.nodes} items. Use the list view for a text version.`}
          >
            <SceneBoundary onFail={() => { setWebgl(false); setView("list"); }}>
              <GraphScene
                nodes={graph.nodes}
                links={graph.links}
                positions={positions}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={setSelectedId}
                onHover={setHoveredId}
                autoRotate={autoRotate}
                resetKey={resetKey}
                reduceMotion={reduceMotion}
              />
            </SceneBoundary>
            <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-muted-foreground">
              Drag to rotate · Scroll to zoom · Click a node
            </p>
            {only && (
              <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground">
                Nothing else was found in this message, so there is nothing to connect.
              </p>
            )}
          </div>
        ) : (
          <GraphList nodes={graph.nodes} selectedId={selectedId} onSelect={setSelectedId} />
        )}

        <ul aria-label="Legend" className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <LegendItem swatch={<span className="h-3 w-3 rounded-sm" style={{ background: COLORS.message }} />}>The message you checked</LegendItem>
          <LegendItem swatch={<span className="h-3 w-3 rounded-full" style={{ background: COLORS.neutral }} />}>Link, website, contact</LegendItem>
          <LegendItem swatch={<span className="h-3 w-3" style={{ background: COLORS.entity }} />}>Organization or sender</LegendItem>
          <LegendItem swatch={<span className="h-3 w-3 rotate-45" style={{ background: COLORS.signal }} />}>Warning sign (solid = evidence)</LegendItem>
          <LegendItem swatch={<span className="h-3 w-3 rotate-45 border" style={{ borderColor: COLORS.signal, background: `${COLORS.signal}55` }} />}>Faded = inference (a guess)</LegendItem>
          <LegendItem swatch={<span className="h-3 w-3 rounded-full" style={{ background: COLORS.flagged }} />}>Flagged</LegendItem>
          <LegendItem swatch={<span className="h-3 w-3 rounded-full border-2" style={{ borderColor: COLORS.safe }} />}>Earlier investigation</LegendItem>
          <LegendItem swatch={<span className="block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: COLORS.edge }} />}>Dashed line = a guess</LegendItem>
        </ul>
      </div>

      <aside aria-label="Details" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <NodeInspector node={selected} nodes={graph.nodes} links={graph.links} onSelect={setSelectedId} />
      </aside>
    </div>
  );
}
