import type { GraphNode, RiskLevel } from "@/lib/api";

// One restrained palette. Red is reserved for "flagged"; amber for warning signs.
export const COLORS = {
  message: "#1f3a8a",
  neutral: "#64748b",
  entity: "#334155",
  signal: "#b7791f",
  flagged: "#c0322b",
  safe: "#2f7d57",
  edge: "#94a3b8",
  edgeActive: "#1f3a8a",
  select: "#1f3a8a",
} as const;

export function riskColor(level: RiskLevel | null): string {
  return level === "HIGH_RISK" ? COLORS.flagged : level === "SUSPICIOUS" ? COLORS.signal : COLORS.safe;
}

export function nodeColor(n: GraphNode): string {
  if (n.flagged) return COLORS.flagged;
  switch (n.kind) {
    case "message": return COLORS.message;
    case "signal": return COLORS.signal;
    case "case": return riskColor(n.risk_level);
    case "organization":
    case "sender": return COLORS.entity;
    default: return COLORS.neutral;
  }
}

export const KIND_LABEL: Record<GraphNode["kind"], string> = {
  message: "Message you checked",
  sender: "Claimed sender",
  url: "Link",
  domain: "Website",
  email: "Email address",
  phone: "Phone number",
  organization: "Organization",
  signal: "Warning sign",
  case: "Earlier investigation",
};
