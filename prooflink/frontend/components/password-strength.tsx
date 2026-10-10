import { Check, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PasswordCheck, Strength } from "@/lib/password";

const LABEL: Record<Strength, string> = { empty: "", weak: "Weak", okay: "Okay", strong: "Strong" };
const SEGMENTS: Record<Strength, number> = { empty: 0, weak: 1, okay: 2, strong: 3 };
const COLOR: Record<Strength, string> = {
  empty: "bg-border",
  weak: "bg-risk-high",
  okay: "bg-risk-suspicious",
  strong: "bg-risk-safe",
};

export function PasswordStrength({ check }: { check: PasswordCheck }) {
  const filled = SEGMENTS[check.strength];
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= filled ? COLOR[check.strength] : "bg-border")} />
          ))}
        </div>
        <span aria-live="polite" className="w-14 text-right text-xs font-medium text-muted-foreground">
          {LABEL[check.strength]}
        </span>
      </div>

      <ul aria-label="Password requirements" className="grid gap-1 text-xs sm:grid-cols-2">
        {check.rules.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-1.5", r.ok ? "text-foreground" : "text-muted-foreground")}>
            {r.ok ? (
              <Check className="h-3.5 w-3.5 text-risk-safe" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="sr-only">{r.ok ? "Done: " : "Missing: "}</span>
            {r.label}
          </li>
        ))}
      </ul>

      {check.problem && check.rules.every((r) => r.ok) && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {check.problem}
        </p>
      )}
    </div>
  );
}
