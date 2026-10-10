import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { RiskBadge } from "@/components/risk-badge";
import type { InvestigationSummary } from "@/lib/api";
import { formatWhen, inputTypeLabel } from "@/lib/format";

export function InvestigationList({ items }: { items: InvestigationSummary[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {items.map((it) => (
        <li key={it.id}>
          <Link
            href={`/history/${it.id}`}
            className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5"
          >
            <div className="flex w-28 shrink-0 flex-col items-start gap-1.5">
              <RiskBadge level={it.risk_level} />
              <span className="pl-0.5 text-xs tabular-nums text-muted-foreground">Score {it.risk_score}/100</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-sm font-medium">{it.preview}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {it.top_signals.length ? it.top_signals.join(" · ") : "No common warning signs found"}
              </p>
            </div>
            <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
              <p>{formatWhen(it.created_at)}</p>
              <p className="mt-1">{inputTypeLabel(it.input_type)}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-px overflow-hidden rounded-xl border border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[4.5rem] animate-pulse bg-muted" />
      ))}
    </div>
  );
}
