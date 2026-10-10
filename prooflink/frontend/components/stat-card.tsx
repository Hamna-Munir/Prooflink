"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "high" | "suspicious" | "safe";

// Complete class names per tone so Tailwind can find them.
const TONE: Record<Tone, { strip: string; tile: string; chip: string; bar: string; hover: string }> = {
  primary: {
    strip: "bg-primary",
    tile: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
    chip: "bg-primary/10 text-primary",
    bar: "bg-primary",
    hover: "hover:border-primary/40 hover:shadow-[0_18px_34px_-18px_hsl(var(--primary)/0.6)]",
  },
  high: {
    strip: "bg-risk-high",
    tile: "bg-risk-high/10 text-risk-high group-hover:bg-risk-high group-hover:text-background",
    chip: "bg-risk-high/10 text-risk-high",
    bar: "bg-risk-high",
    hover: "hover:border-risk-high/40 hover:shadow-[0_18px_34px_-18px_hsl(var(--risk-high)/0.6)]",
  },
  suspicious: {
    strip: "bg-risk-suspicious",
    tile: "bg-risk-suspicious/10 text-risk-suspicious group-hover:bg-risk-suspicious group-hover:text-background",
    chip: "bg-risk-suspicious/10 text-risk-suspicious",
    bar: "bg-risk-suspicious",
    hover: "hover:border-risk-suspicious/40 hover:shadow-[0_18px_34px_-18px_hsl(var(--risk-suspicious)/0.6)]",
  },
  safe: {
    strip: "bg-risk-safe",
    tile: "bg-risk-safe/10 text-risk-safe group-hover:bg-risk-safe group-hover:text-background",
    chip: "bg-risk-safe/10 text-risk-safe",
    bar: "bg-risk-safe",
    hover: "hover:border-risk-safe/40 hover:shadow-[0_18px_34px_-18px_hsl(var(--risk-safe)/0.6)]",
  },
};

type Props = {
  label: string;
  value: number;
  total: number;
  tone: Tone;
  Icon: LucideIcon;
  delay?: number;
  // For the "Investigations" card: show how the total splits across the three results.
  split?: { high: number; suspicious: number; safe: number };
};

export function StatCard({ label, value, total, tone, Icon, delay = 0, split }: Props) {
  const t = TONE[tone];
  const shown = useCountUp(value);
  const share = total > 0 ? Math.round((value / total) * 100) : 0;

  // Bars start empty and grow once the card is on screen.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setGrown(true), 120 + delay);
    return () => clearTimeout(id);
  }, [delay]);
  const pct = (n: number) => (grown && total > 0 ? `${(n / total) * 100}%` : "0%");

  return (
    // The wrapper does the entrance animation; the card inside does the hover motion.
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border bg-card p-5 pt-6",
          "transition-all duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          t.hover
        )}
      >
        <span className={cn("absolute inset-x-0 top-0 h-1", t.strip)} aria-hidden />

        <div className="flex items-start justify-between">
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3", t.tile)}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          {!split && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", t.chip)}>{share}%</span>
          )}
        </div>

        <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight" aria-label={`${label}: ${value}`}>
          {shown}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>

        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {split ? (
            <>
              <span className="h-full bg-risk-high transition-[width] duration-700 ease-out" style={{ width: pct(split.high) }} />
              <span className="h-full bg-risk-suspicious transition-[width] duration-700 ease-out" style={{ width: pct(split.suspicious) }} />
              <span className="h-full bg-risk-safe transition-[width] duration-700 ease-out" style={{ width: pct(split.safe) }} />
            </>
          ) : (
            <span className={cn("h-full rounded-full transition-[width] duration-700 ease-out", t.bar)} style={{ width: pct(value) }} />
          )}
        </div>
      </div>
    </div>
  );
}
