"use client";

import { ArrowLeft, Box } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AnalysisResult } from "@/components/analysis-result";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { api, ApiError, type InvestigationDetail } from "@/lib/api";
import { formatWhen, inputTypeLabel } from "@/lib/format";
import { useRequireUser } from "@/lib/use-user";

export default function InvestigationPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, error: loadError } = useRequireUser();
  const [data, setData] = useState<InvestigationDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .getInvestigation(id)
      .then(setData)
      .catch((err) => (err instanceof ApiError && err.status === 404 ? setNotFound(true) : setFailed(true)));
  }, [user, id]);

  async function remove() {
    if (!data) return;
    setDeleting(true);
    try {
      await api.deleteInvestigation(data.id);
      router.replace("/history");
    } catch {
      setDeleting(false);
      setConfirming(false);
      setFailed(true);
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
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          History
        </Link>

        {notFound ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
            <h1 className="font-semibold">We couldn&apos;t find that investigation</h1>
            <p className="mx-auto mt-2 max-w-[44ch] text-sm text-muted-foreground">It may have been deleted, or it belongs to another account.</p>
          </div>
        ) : failed && !data ? (
          <p className="mt-8 text-sm text-muted-foreground">We couldn&apos;t load this investigation. Refresh to try again.</p>
        ) : !data ? (
          <div aria-busy="true" className="mt-8 space-y-5">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-52 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Investigation #{data.id}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Checked {formatWhen(data.created_at)} · {inputTypeLabel(data.input_type)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link href={`/history/${data.id}/graph`}>
                  <Box className="h-4 w-4" aria-hidden />
                  3D investigation
                </Link>
              </Button>
              {confirming ? (
                <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
                  <span className="text-sm text-muted-foreground">Delete this investigation?</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-destructive text-white hover:bg-destructive/90" onClick={remove} disabled={deleting}>
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              </div>
            </div>
            {failed && <p role="alert" className="mt-3 text-sm font-medium text-destructive">Couldn&apos;t delete it. Try again.</p>}

            <section className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-sm font-semibold">What you checked</h2>
              <blockquote className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2.5 text-sm leading-relaxed">
                {data.content}
              </blockquote>
            </section>

            <div className="mt-5">
              <AnalysisResult analysis={data.analysis} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
