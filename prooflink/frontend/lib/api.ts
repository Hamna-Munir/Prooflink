export type User = {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
};

export type RiskLevel = "SAFE" | "SUSPICIOUS" | "HIGH_RISK";
export type InputType = "message" | "url" | "screenshot";

export type Signal = {
  id: string;
  label: string;
  kind: "evidence" | "inference";
  category: string;
  severity: number;
  detail: string;
  matched: string[];
  related: string[];
  source: "rules" | "ai";
};

export type Entity = {
  kind: "url" | "domain" | "phone" | "email" | "organization";
  value: string;
  flagged: boolean;
  flag_reason: string | null;
};

export type Analysis = {
  input_type: InputType;
  risk_level: RiskLevel;
  risk_score: number;
  confidence: number;
  headline: string;
  explanation: string;
  signals: Signal[];
  entities: Entity[];
  recommended_actions: string[];
  reassurances: string[];
  limitations: string[];
  ai_used: boolean;
  ai_note: string | null;
  claimed_sender: string | null;
};

export type DemoExample = {
  id: string;
  title: string;
  channel: string;
  text: string;
  analysis: Analysis;
};

export type InvestigationSummary = {
  id: number;
  created_at: string;
  input_type: InputType;
  risk_level: RiskLevel;
  risk_score: number;
  preview: string;
  top_signals: string[];
};

export type InvestigationDetail = {
  id: number;
  created_at: string;
  input_type: InputType;
  content: string;
  analysis: Analysis;
};

export type DashboardStats = {
  total: number;
  high_risk: number;
  suspicious: number;
  safe: number;
  recent: InvestigationSummary[];
};

export type GraphReason = {
  label: string;
  detail: string;
  kind: "evidence" | "inference";
  source: "rules" | "ai";
  severity: number;
};

export type GraphNodeKind = "message" | "sender" | "url" | "domain" | "email" | "phone" | "organization" | "signal" | "case";

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  value: string | null;
  flagged: boolean;
  note: string | null;
  reasons: GraphReason[];
  seen_before: number;
  risk_level: RiskLevel | null;
  risk_score: number | null;
  investigation_id: number | null;
  created_at: string | null;
  signal_kind: "evidence" | "inference" | null;
  source: "rules" | "ai" | null;
  severity: number | null;
  matched: string[];
};

export type GraphLink = { source: string; target: string; kind: string; label: string; inferred: boolean };

export type InvestigationGraph = {
  investigation_id: number;
  nodes: GraphNode[];
  links: GraphLink[];
  counts: { nodes: number; links: number; flagged: number; signals: number; related_cases: number };
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// All requests go through the Next.js proxy (/api/* -> FastAPI), so cookies are same-origin.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        message = String(data.detail[0].msg).replace(/^Value error, /, "");
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  signup: (body: { full_name: string; email: string; password: string }) =>
    request<User>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  health: () => request<{ status: string; ai_enabled: boolean }>("/health"),
  demoExamples: () => request<DemoExample[]>("/demo/examples"),
  createInvestigation: (content: string, inputType?: InputType) =>
    request<InvestigationDetail>("/investigations", {
      method: "POST",
      body: JSON.stringify(inputType ? { content, input_type: inputType } : { content }),
    }),
  updateProfile: (body: { full_name: string }) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<void>("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),
  deleteAccount: (password: string) =>
    request<void>("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),
  deleteAllInvestigations: () => request<void>("/investigations", { method: "DELETE" }),
  listInvestigations: (opts: { risk?: RiskLevel; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.risk) q.set("risk", opts.risk);
    q.set("limit", String(opts.limit ?? 20));
    q.set("offset", String(opts.offset ?? 0));
    return request<{ items: InvestigationSummary[]; total: number }>(`/investigations?${q}`);
  },
  getInvestigation: (id: number | string) => request<InvestigationDetail>(`/investigations/${id}`),
  getGraph: (id: number | string) => request<InvestigationGraph>(`/investigations/${id}/graph`),
  deleteInvestigation: (id: number) => request<void>(`/investigations/${id}`, { method: "DELETE" }),
  stats: () => request<DashboardStats>("/investigations/stats"),
  analyze: (content: string) =>
    request<Analysis>("/analyze", { method: "POST", body: JSON.stringify({ content }) }),
};
