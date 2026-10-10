import type { RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

const STYLE: Record<RiskLevel, { label: string; cls: string; dot: string }> = {
  HIGH_RISK: { label: "High risk", cls: "border-risk-high/30 bg-risk-high/10 text-risk-high", dot: "bg-risk-high" },
  SUSPICIOUS: { label: "Suspicious", cls: "border-risk-suspicious/30 bg-risk-suspicious/10 text-risk-suspicious", dot: "bg-risk-suspicious" },
  SAFE: { label: "Looks safe", cls: "border-risk-safe/30 bg-risk-safe/10 text-risk-safe", dot: "bg-risk-safe" },
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const s = STYLE[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
