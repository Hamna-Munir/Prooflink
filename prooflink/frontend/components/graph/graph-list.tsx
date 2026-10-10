import { RiskBadge } from "@/components/risk-badge";
import type { GraphNode } from "@/lib/api";
import { cn } from "@/lib/utils";
import { KIND_LABEL } from "./graph-style";

const SECTIONS: { title: string; kinds: GraphNode["kind"][] }[] = [
  { title: "Message", kinds: ["message"] },
  { title: "Links and contacts", kinds: ["url", "email", "phone"] },
  { title: "Websites", kinds: ["domain"] },
  { title: "Organizations and senders", kinds: ["organization", "sender"] },
  { title: "Warning signs", kinds: ["signal"] },
  { title: "Earlier investigations", kinds: ["case"] },
];

// The same graph as plain grouped lists. Used for keyboard and screen-reader users,
// small screens, and any device without WebGL.
export function GraphList({ nodes, selectedId, onSelect }: { nodes: GraphNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-5">
      {SECTIONS.map((sec) => {
        const items = nodes.filter((n) => sec.kinds.includes(n.kind));
        if (!items.length) return null;
        return (
          <section key={sec.title} aria-label={sec.title}>
            <h3 className="text-sm font-semibold">{sec.title}</h3>
            <ul className="mt-2 space-y-1">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    aria-pressed={n.id === selectedId}
                    onClick={() => onSelect(n.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      n.id === selectedId ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">{KIND_LABEL[n.kind]}</span>
                      <span className="block break-words font-medium">{n.label}</span>
                    </span>
                    {n.flagged && <span className="shrink-0 rounded-full border border-risk-high/30 bg-risk-high/10 px-2 py-0.5 text-[11px] font-medium text-risk-high">Flagged</span>}
                    {n.kind === "case" && n.risk_level && <RiskBadge level={n.risk_level} />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
