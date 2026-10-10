"use client";

import {
  Building2, Check, Globe, Info, KeyRound, Link2, ListChecks, Mail, MessageCircle, Phone, Search,
  ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles, Timer, TriangleAlert, UserX, type LucideIcon,
} from "lucide-react";
import { forwardRef, useEffect, useState } from "react";

import type { Analysis, Entity, RiskLevel, Signal } from "@/lib/api";
import { cn } from "@/lib/utils";

// Full class names (not built dynamically) so Tailwind can see them.
export const LEVELS: Record<
  RiskLevel,
  { label: string; text: string; bar: string; tint: string; Icon: LucideIcon }
> = {
  HIGH_RISK: { label: "High risk", text: "text-risk-high", bar: "bg-risk-high", tint: "border-risk-high/30 bg-risk-high/5", Icon: ShieldAlert },
  SUSPICIOUS: { label: "Suspicious", text: "text-risk-suspicious", bar: "bg-risk-suspicious", tint: "border-risk-suspicious/30 bg-risk-suspicious/5", Icon: ShieldQuestion },
  SAFE: { label: "Looks safe", text: "text-risk-safe", bar: "bg-risk-safe", tint: "border-risk-safe/30 bg-risk-safe/5", Icon: ShieldCheck },
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  link: Link2, pressure: Timer, request: KeyRound, scam_type: TriangleAlert, impersonation: UserX, contact: MessageCircle,
};

const ENTITY_ICON: Record<Entity["kind"], LucideIcon> = {
  url: Link2, domain: Globe, phone: Phone, email: Mail, organization: Building2,
};
const ENTITY_LABEL: Record<Entity["kind"], string> = {
  url: "Link", domain: "Website", phone: "Phone number", email: "Email address", organization: "Organization",
};

function impact(severity: number) {
  if (severity >= 30) return { label: "High impact", wrap: "bg-risk-high/10 text-risk-high" };
  if (severity >= 15) return { label: "Medium impact", wrap: "bg-risk-suspicious/10 text-risk-suspicious" };
  return { label: "Low impact", wrap: "bg-muted text-muted-foreground" };
}

// Fade + rise on mount. Reduced-motion users get no animation (see globals.css).
function Reveal({ delay = 0, className, children }: { delay?: number; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-2 duration-500", className)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

function Panel({ title, Icon, delay, className, children }: { title: string; Icon: LucideIcon; delay: number; className?: string; children: React.ReactNode }) {
  return (
    <Reveal delay={delay} className={cn("rounded-xl border border-border bg-card p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Reveal>
  );
}

function EvidenceTag({ kind, source }: { kind: Signal["kind"]; source: Signal["source"] }) {
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

function FlagBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-risk-high/30 bg-risk-high/10 px-2 py-0.5 text-[11px] font-medium text-risk-high">
      <TriangleAlert className="h-3 w-3" aria-hidden />
      Flagged
    </span>
  );
}

// The score on a 0-100 track with the SAFE / SUSPICIOUS / HIGH RISK zones marked.
function ScoreMeter({ score, level }: { score: number; level: RiskLevel }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 60);
    return () => clearTimeout(t);
  }, [score]);
  return (
    <div role="img" aria-label={`Risk score ${score} out of 100. Safe below 30, suspicious 30 to 54, high risk 55 and above.`}>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", LEVELS[level].bar)} style={{ width: `${width}%` }} />
        <span className="absolute inset-y-0 w-0.5 bg-background" style={{ left: "30%" }} />
        <span className="absolute inset-y-0 w-0.5 bg-background" style={{ left: "55%" }} />
      </div>
      <div className="mt-1.5 flex text-[11px] text-muted-foreground" aria-hidden>
        <span style={{ width: "30%" }}>Safe</span>
        <span style={{ width: "25%" }}>Suspicious</span>
        <span className="flex-1">High risk</span>
      </div>
    </div>
  );
}

function SignalRow({ s }: { s: Signal }) {
  const Icon = CATEGORY_ICON[s.category] ?? TriangleAlert;
  const imp = impact(s.severity);
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", imp.wrap)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-snug">{s.label}</p>
          <EvidenceTag kind={s.kind} source={s.source} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {(s.kind === "evidence" || s.source === "ai") &&
            s.matched.slice(0, 2).map((m) => (
              <code key={m} className="max-w-full break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {m}
              </code>
            ))}
          <span className="text-xs text-muted-foreground">{imp.label}</span>
        </div>
      </div>
    </li>
  );
}

function EntityRow({ e }: { e: Entity }) {
  const Icon = ENTITY_ICON[e.kind];
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", e.flagged ? "bg-risk-high/10 text-risk-high" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{ENTITY_LABEL[e.kind]}</p>
        <p className="break-all font-mono text-sm">{e.value}</p>
        {e.flagged && e.flag_reason && <p className="mt-0.5 text-xs text-risk-high">{e.flag_reason}</p>}
      </div>
      {e.flagged && <FlagBadge />}
    </li>
  );
}

export function ResultSkeleton() {
  return (
    <div aria-busy="true" aria-label="Checking" className="space-y-5">
      <div className="h-52 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-3" />
        <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-2" />
      </div>
    </div>
  );
}

export const AnalysisResult = forwardRef<HTMLElement, { analysis: Analysis }>(({ analysis: a }, ref) => {
  const level = LEVELS[a.risk_level];
  const hasSignals = a.signals.length > 0;

  return (
    <article ref={ref} tabIndex={-1} aria-label="Analysis result" className="space-y-5 focus:outline-none">
      {/* 1. Verdict */}
      <Reveal className={cn("rounded-xl border p-6 sm:p-8", level.tint)}>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <level.Icon className={cn("h-9 w-9 shrink-0", level.text)} aria-hidden />
              <h2 className={cn("text-3xl font-semibold tracking-tight", level.text)}>{level.label}</h2>
            </div>
            <p className="mt-4 font-medium">{a.headline}</p>
            <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{a.explanation}</p>
            {a.ai_used && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                AI helped with this review. Its findings are checked against your text and marked as inferences.
              </p>
            )}
          </div>
          <dl className="flex shrink-0 gap-10 md:flex-col md:gap-5 md:text-right">
            <div>
              <dt className="text-xs text-muted-foreground">Risk score</dt>
              <dd className="text-4xl font-semibold tabular-nums">
                {a.risk_score}
                <span className="text-lg font-normal text-muted-foreground">/100</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Confidence</dt>
              <dd className="text-xl font-semibold tabular-nums">{Math.round(a.confidence * 100)}%</dd>
              <dd className="text-xs text-muted-foreground">How sure we are about this level</dd>
            </div>
          </dl>
        </div>
        <div className="mt-6">
          <ScoreMeter score={a.risk_score} level={a.risk_level} />
        </div>
      </Reveal>

      {/* 2. Why + what to do */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title={hasSignals ? "Why we flagged it" : "What we found"} Icon={Search} delay={120} className="lg:col-span-3">
          {hasSignals ? (
            <ul className="divide-y divide-border">
              {a.signals.map((s) => (
                <SignalRow key={s.id} s={s} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No common scam warning signs were found.</p>
          )}
          {a.reassurances.length > 0 && (
            <ul className="mt-5 space-y-2 rounded-lg bg-risk-safe/10 p-3 text-sm">
              {a.reassurances.map((r) => (
                <li key={r} className="flex gap-2 text-risk-safe">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {hasSignals && (
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Evidence</strong> is something we found in what you pasted.{" "}
              <strong className="font-medium text-foreground">Inference</strong> is a best guess from that evidence, made by our rules or by AI, and may be wrong.
            </p>
          )}
        </Panel>

        <Panel title="What you should do" Icon={ListChecks} delay={220} className="lg:col-span-2">
          <ol className="space-y-4">
            {a.recommended_actions.map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed">{t}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {/* 3. What was inside */}
      {a.entities.length > 0 && (
        <Panel title="What we found inside it" Icon={Link2} delay={320}>
          <ul className="divide-y divide-border">
            {a.entities.map((e) => (
              <EntityRow key={`${e.kind}-${e.value}`} e={e} />
            ))}
          </ul>
        </Panel>
      )}

      {/* 4. Limits */}
      <Reveal delay={400} className="flex gap-2.5 rounded-lg bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{[...a.limitations, a.ai_note].filter(Boolean).join(" ")}</p>
      </Reveal>
    </article>
  );
});
AnalysisResult.displayName = "AnalysisResult";
