import { ArrowRight, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { RiskBadge } from "@/components/risk-badge";
import type { GraphLink, GraphNode } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KIND_LABEL } from "./graph-style";

function impact(sev: number | null) {
  const s = sev ?? 0;
  return s >= 30 ? "High impact" : s >= 15 ? "Medium impact" : "Low impact";
}

function KindTag({ kind, source }: { kind: "evidence" | "inference"; source: "rules" | "ai" }) {
  if (source === "ai") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/50 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
        <Sparkles className="h-3 w-3" aria-hidden />
        AI inference
      </span>
    );
  }
  return kind === "evidence" ? (
    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium">Evidence</span>
  ) : (
    <span className="shrink-0 rounded-full border border-dashed border-muted-foreground/60 px-2 py-0.5 text-[11px] text-muted-foreground">Inference</span>
  );
}

export function NodeInspector({
  node, nodes, links, onSelect,
}: { node: GraphNode | null; nodes: GraphNode[]; links: GraphLink[]; onSelect: (id: string) => void }) {
  if (!node) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Select something in the graph</p>
        <p className="mt-1.5 leading-relaxed">
          Click any node to see what it is, why it was flagged, and how it connects to the rest. You can also pick items from the list view.
        </p>
      </div>
    );
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const connections = links
    .filter((l) => l.source === node.id || l.target === node.id)
    .map((l) => {
      const outgoing = l.source === node.id;
      const other = byId.get(outgoing ? l.target : l.source);
      return other ? { other, phrase: outgoing ? l.label : `${l.label} this`, inferred: l.inferred, outgoing } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div key={node.id} className="animate-in fade-in slide-in-from-right-2 rounded-xl border border-border bg-card p-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{KIND_LABEL[node.kind]}</p>
          <h2 className="mt-0.5 break-words text-lg font-semibold leading-snug">{node.kind === "signal" || node.kind === "case" ? node.label : node.value ?? node.label}</h2>
        </div>
        {node.flagged && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-risk-high/30 bg-risk-high/10 px-2 py-0.5 text-[11px] font-medium text-risk-high">
            <TriangleAlert className="h-3 w-3" aria-hidden />
            Flagged
          </span>
        )}
      </div>

      {(node.kind === "message" || node.kind === "case") && node.risk_level && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RiskBadge level={node.risk_level} />
          <span className="text-xs tabular-nums text-muted-foreground">Score {node.risk_score}/100</span>
          {node.created_at && <span className="text-xs text-muted-foreground">· {formatWhen(node.created_at)}</span>}
        </div>
      )}

      {node.kind === "signal" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {node.signal_kind && <KindTag kind={node.signal_kind} source={node.source ?? "rules"} />}
          <span className="text-xs text-muted-foreground">{impact(node.severity)}</span>
        </div>
      )}

      {node.note && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{node.note}</p>}

      {node.kind === "signal" && node.matched.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {node.matched.map((m) => (
            <code key={m} className="max-w-full break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{m}</code>
          ))}
        </div>
      )}

      {node.seen_before > 0 && (
        <p className="mt-4 rounded-lg bg-risk-suspicious/10 px-3 py-2 text-sm text-risk-suspicious">
          Seen before: this also appears in {node.seen_before} of your earlier {node.seen_before === 1 ? "investigation" : "investigations"}.
        </p>
      )}

      {node.kind === "case" && node.investigation_id && (
        <Link
          href={`/history/${node.investigation_id}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Open case #{node.investigation_id}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}

      {node.reasons.length > 0 && (
        <section className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{node.flagged ? "Why we flagged it" : "Linked warning signs"}</h3>
          <ul className="mt-3 space-y-3">
            {node.reasons.map((r) => (
              <li key={r.label}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{r.label}</p>
                  <KindTag kind={r.kind} source={r.source} />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.flagged === false && node.reasons.length === 0 && ["url", "domain", "email", "phone"].includes(node.kind) && (
        <p className="mt-4 text-sm text-muted-foreground">We found no problems with this item.</p>
      )}

      {connections.length > 0 && (
        <section className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Connections</h3>
          <ul className="mt-2 space-y-1">
            {connections.map((c) => (
              <li key={c.other.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.other.id)}
                  className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className={cn("text-xs text-muted-foreground", c.inferred && "italic")}>
                      {c.outgoing ? `${c.phrase}` : c.phrase}
                      {c.inferred ? " (guess)" : ""}
                    </span>
                    <span className="block truncate font-medium">{c.other.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
