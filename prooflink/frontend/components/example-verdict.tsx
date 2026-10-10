"use client";

import { useEffect, useState } from "react";

import { api, type DemoExample, type RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

const LEVELS: Record<RiskLevel, { label: string; className: string }> = {
  HIGH_RISK: { label: "High risk", className: "text-risk-high" },
  SUSPICIOUS: { label: "Suspicious", className: "text-risk-suspicious" },
  SAFE: { label: "Looks safe", className: "text-risk-safe" },
};

// Live output of the real analysis engine on three fixed sample messages.
export function ExampleVerdict() {
  const [examples, setExamples] = useState<DemoExample[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    api
      .demoExamples()
      .then(setExamples)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Live examples are unavailable right now. Create an account to check your own message.
      </section>
    );
  }

  if (!examples) {
    return (
      <section
        aria-busy="true"
        className="min-h-[30rem] rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
      >
        Running the analysis…
      </section>
    );
  }

  const ex = examples[active];
  const a = ex.analysis;
  const level = LEVELS[a.risk_level];
  const findings = a.signals.slice(0, 4);

  return (
    <section aria-label="Live example results" className="rounded-lg border border-border bg-card">
      <div role="tablist" aria-label="Example messages" className="flex border-b border-border">
        {examples.map((e, i) => (
          <button
            key={e.id}
            role="tab"
            id={`tab-${e.id}`}
            aria-selected={i === active}
            aria-controls="example-panel"
            onClick={() => setActive(i)}
            className={cn(
              "flex-1 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              i === active
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {e.title}
          </button>
        ))}
      </div>

      <div id="example-panel" role="tabpanel" aria-labelledby={`tab-${ex.id}`} className="p-6">
        <p className="text-xs text-muted-foreground">Message received by {ex.channel}</p>
        <blockquote className="mt-2 rounded-md bg-muted px-3 py-2.5 text-sm leading-relaxed">
          {ex.text}
        </blockquote>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("text-2xl font-semibold", level.className)}>{level.label}</span>
          <span className="text-muted-foreground">{a.risk_score} / 100</span>
          <span className="text-sm text-muted-foreground">
            Confidence {Math.round(a.confidence * 100)}%
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{a.headline}</p>

        <h2 className="mt-5 text-sm font-semibold">
          {findings.length ? "Why we flagged it" : "What we found"}
        </h2>
        <ul className="mt-2 space-y-2 text-sm">
          {findings.length ? (
            findings.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3">
                <span>{s.label}</span>
                <span className="mt-0.5 shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {s.kind === "evidence" ? "Evidence" : "Inference"}
                </span>
              </li>
            ))
          ) : (
            <li>{a.reassurances[0] ?? "No common scam warning signs in this message."}</li>
          )}
        </ul>

        <h2 className="mt-5 text-sm font-semibold">What you should do</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {a.recommended_actions.slice(0, 2).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <p className="mt-5 text-xs text-muted-foreground">{a.limitations[0]}</p>
      </div>
    </section>
  );
}
