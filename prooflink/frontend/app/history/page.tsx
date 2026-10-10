"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { InvestigationList, ListSkeleton } from "@/components/investigation-list";
import { Button } from "@/components/ui/button";
import { api, type InvestigationSummary, type RiskLevel } from "@/lib/api";
import { useRequireUser } from "@/lib/use-user";
import { cn } from "@/lib/utils";

const PAGE = 20;
const FILTERS: { label: string; value: RiskLevel | undefined }[] = [
  { label: "All", value: undefined },
  { label: "High risk", value: "HIGH_RISK" },
  { label: "Suspicious", value: "SUSPICIOUS" },
  { label: "Looks safe", value: "SAFE" },
];

export default function HistoryPage() {
  const { user, error: loadError } = useRequireUser();
  const [filter, setFilter] = useState<RiskLevel | undefined>(undefined);
  const [items, setItems] = useState<InvestigationSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [moreLoading, setMoreLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (risk: RiskLevel | undefined) => {
    setItems(null);
    setFailed(false);
    try {
      const res = await api.listInvestigations({ risk, limit: PAGE, offset: 0 });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (user) load(filter);
  }, [user, filter, load]);

  async function loadMore() {
    if (!items) return;
    setMoreLoading(true);
    try {
      const res = await api.listInvestigations({ risk: filter, limit: PAGE, offset: items.length });
      setItems([...items, ...res.items]);
      setTotal(res.total);
    } catch {
      setFailed(true);
    } finally {
      setMoreLoading(false);
    }
  }

  if (loadError) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{loadError}</main>;
  }
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</main>;
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">History</h1>
            <p className="mt-1 text-sm text-muted-foreground">Everything you&apos;ve checked, newest first. Only you can see this.</p>
          </div>
          <Button asChild>
            <Link href="/check">Check something</Link>
          </Button>
        </div>

        <div role="group" aria-label="Filter by result" className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {failed ? (
            <p className="text-sm text-muted-foreground">We couldn&apos;t load your history. Refresh to try again.</p>
          ) : !items ? (
            <ListSkeleton rows={4} />
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <h2 className="font-semibold">{filter ? "Nothing here" : "No investigations yet"}</h2>
              <p className="mx-auto mt-2 max-w-[44ch] text-sm text-muted-foreground">
                {filter ? "None of your checks have this result." : "Check a suspicious message or link and it will be saved here."}
              </p>
            </div>
          ) : (
            <>
              <InvestigationList items={items} />
              <p className="mt-3 text-xs text-muted-foreground">
                Showing {items.length} of {total}
              </p>
              {items.length < total && (
                <Button variant="outline" className="mt-3" onClick={loadMore} disabled={moreLoading}>
                  {moreLoading ? "Loading…" : "Load more"}
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
