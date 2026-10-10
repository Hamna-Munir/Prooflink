"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { InvestigationGraphView } from "@/components/graph/investigation-graph";
import { api, ApiError, type InvestigationGraph } from "@/lib/api";
import { useRequireUser } from "@/lib/use-user";

export default function GraphPage() {
  const { id } = useParams<{ id: string }>();
  const { user, error: loadError } = useRequireUser();
  const [graph, setGraph] = useState<InvestigationGraph | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .getGraph(id)
      .then(setGraph)
      .catch((err) => (err instanceof ApiError && err.status === 404 ? setNotFound(true) : setFailed(true)));
  }, [user, id]);

  if (loadError) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{loadError}</main>;
  }
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</main>;
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link href={`/history/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Investigation #{id}
        </Link>

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">3D investigation</h1>
          <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            How everything in this message connects: who it claims to be, the links and websites it uses, and the warning signs attached to each.
            {graph && graph.counts.related_cases > 0 && " Items you have seen before link to your earlier investigations."}
          </p>
        </div>

        {notFound ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <h2 className="font-semibold">We couldn&apos;t find that investigation</h2>
          </div>
        ) : failed ? (
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the graph. Refresh to try again.</p>
        ) : !graph ? (
          <div aria-busy="true" className="h-[34rem] animate-pulse rounded-xl bg-muted" />
        ) : (
          <InvestigationGraphView graph={graph} />
        )}
      </main>
    </>
  );
}
