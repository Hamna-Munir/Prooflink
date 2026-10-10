"use client";

import { ArrowRight, FileSearch, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { InvestigationList, ListSkeleton } from "@/components/investigation-list";
import { StatCard } from "@/components/stat-card";
import { api, type DashboardStats } from "@/lib/api";
import { useRequireUser } from "@/lib/use-user";

export default function DashboardPage() {
  const { user, error } = useRequireUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.stats().then(setStats).catch(() => setStatsError(true));
  }, [user]);

  if (error) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{error}</main>;
  }
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your dashboard…</main>;
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section
          className="animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(224_64%_17%)] to-[hsl(196_58%_24%)] p-6 text-white duration-500 sm:p-8"
          style={{ animationFillMode: "both" }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 sm:flex">
                <ShieldCheck className="h-7 w-7" aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {user.full_name}</h1>
                <p className="mt-1.5 max-w-[48ch] text-sm leading-relaxed text-white/75">
                  Got a message or link that feels off? Check it before you trust it. Every check is saved here.
                </p>
              </div>
            </div>
            <Link
              href="/check"
              className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-6 text-base font-medium text-[hsl(224_64%_17%)] transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(224_64%_17%)] motion-reduce:transition-none"
            >
              Check something
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        </section>

        <section aria-label="Your numbers" className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Investigations"
            value={stats?.total ?? 0}
            total={stats?.total ?? 0}
            tone="primary"
            Icon={FileSearch}
            delay={80}
            split={{ high: stats?.high_risk ?? 0, suspicious: stats?.suspicious ?? 0, safe: stats?.safe ?? 0 }}
          />
          <StatCard label="High risk" value={stats?.high_risk ?? 0} total={stats?.total ?? 0} tone="high" Icon={ShieldAlert} delay={160} />
          <StatCard label="Suspicious" value={stats?.suspicious ?? 0} total={stats?.total ?? 0} tone="suspicious" Icon={ShieldQuestion} delay={240} />
          <StatCard label="Looks safe" value={stats?.safe ?? 0} total={stats?.total ?? 0} tone="safe" Icon={ShieldCheck} delay={320} />
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent investigations</h2>
            {stats && stats.total > 0 && (
              <Link href="/history" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                View all
              </Link>
            )}
          </div>

          {statsError ? (
            <p className="text-sm text-muted-foreground">We couldn&apos;t load your investigations. Refresh to try again.</p>
          ) : !stats ? (
            <ListSkeleton />
          ) : stats.recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <h3 className="font-semibold">No investigations yet</h3>
              <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted-foreground">
                Every check you run is saved here, so you can come back to it later.
              </p>
            </div>
          ) : (
            <InvestigationList items={stats.recent} />
          )}
        </section>
      </main>
    </>
  );
}
