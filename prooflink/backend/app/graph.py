"""Build the relationship graph for one investigation.

Message -> Sender / Contact / Link -> Website -> Organization, with the scam signals attached to
whatever they are about, and earlier cases (same user only) that share a link, website, email or phone.

The graph is derived from the saved analysis, so it always matches the result the user saw.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.analysis import Analysis
from app.analysis.domains import parse_url

NodeKind = Literal["message", "sender", "url", "domain", "email", "phone", "organization", "signal", "case"]

MAX_ENTITY_NODES = 40
MAX_CASE_NODES = 10
MAX_CASES_PER_ENTITY = 5
IMITATION_SIGNALS = {"lookalike_domain", "brand_in_subdomain", "brand_embedded_domain", "brand_unofficial_tld", "brand_link_mismatch"}


class Reason(BaseModel):
    label: str
    detail: str
    kind: Literal["evidence", "inference"]
    source: Literal["rules", "ai"]
    severity: int


class GraphNode(BaseModel):
    id: str
    kind: NodeKind
    label: str
    value: str | None = None
    flagged: bool = False
    note: str | None = None
    reasons: list[Reason] = Field(default_factory=list)
    seen_before: int = 0  # how many of the user's earlier investigations contain this same item
    # message / case
    risk_level: str | None = None
    risk_score: int | None = None
    investigation_id: int | None = None
    created_at: datetime | None = None
    # signal
    signal_kind: Literal["evidence", "inference"] | None = None
    source: Literal["rules", "ai"] | None = None
    severity: int | None = None
    matched: list[str] = Field(default_factory=list)


class GraphLink(BaseModel):
    source: str
    target: str
    kind: str
    label: str
    inferred: bool = False  # drawn dashed: a guess, not a fact found in the text


class Graph(BaseModel):
    investigation_id: int
    nodes: list[GraphNode]
    links: list[GraphLink]
    counts: dict[str, int]


@dataclass
class CaseRef:
    id: int
    risk_level: str
    risk_score: int
    created_at: datetime
    preview: str


def _short(text: str, n: int = 34) -> str:
    return text if len(text) <= n else text[: n - 1] + "…"


def _nid(kind: str, value: str) -> str:
    return f"{kind}:{value}"


def build_graph(
    investigation_id: int,
    analysis: Analysis,
    related: dict[tuple[str, str], list[CaseRef]] | None = None,
) -> Graph:
    related = related or {}
    nodes: dict[str, GraphNode] = {}
    links: list[GraphLink] = []
    seen_links: set[tuple[str, str, str]] = set()

    def link(a: str, b: str, kind: str, label: str, inferred: bool = False) -> None:
        if a == b or a not in nodes or b not in nodes or (a, b, kind) in seen_links:
            return
        seen_links.add((a, b, kind))
        links.append(GraphLink(source=a, target=b, kind=kind, label=label, inferred=inferred))

    # --- the message itself ---
    nodes["message"] = GraphNode(
        id="message", kind="message", label={"url": "This link", "screenshot": "This screenshot"}.get(analysis.input_type, "This message"),
        risk_level=analysis.risk_level, risk_score=analysis.risk_score, investigation_id=investigation_id,
        note=analysis.headline,
    )

    # --- things found inside it ---
    by_value: dict[str, list[str]] = defaultdict(list)
    for e in analysis.entities[:MAX_ENTITY_NODES]:
        nid = _nid(e.kind, e.value)
        if nid in nodes:
            continue
        label = _short(e.value)
        nodes[nid] = GraphNode(id=nid, kind=e.kind, label=label, value=e.value, flagged=e.flagged, note=e.flag_reason)
        by_value[e.value].append(nid)

    for n in list(nodes.values()):
        if n.kind == "url":
            link("message", n.id, "contains", "contains")
            link(n.id, _nid("domain", parse_url(n.value or "").registered), "points_to", "points to")
        elif n.kind == "email":
            link("message", n.id, "contains", "contains")
            link(n.id, _nid("domain", parse_url((n.value or "").rsplit("@", 1)[-1]).registered), "uses_domain", "uses website")
        elif n.kind == "phone":
            link("message", n.id, "contains", "contains")

    # --- who it claims to be from ---
    orgs = {n.value.lower(): n.id for n in nodes.values() if n.kind == "organization" and n.value}
    claimed_org: str | None = None
    sender = analysis.claimed_sender
    if sender and sender.lower() in orgs:
        claimed_org = orgs[sender.lower()]
    elif sender:
        sid = _nid("sender", sender)
        nodes[sid] = GraphNode(id=sid, kind="sender", label=_short(sender), value=sender, note="Who the message says it is from. We can't verify this.")
        link("message", sid, "claims", "claims to be from", inferred=True)
    for oid in orgs.values():
        if oid == claimed_org:
            link("message", oid, "claims", "claims to be from", inferred=True)
        else:
            link("message", oid, "mentions", "mentions")

    # --- scam signals, attached to what they are about ---
    def resolve(values: list[str]) -> list[str]:
        ids: list[str] = []
        for v in values:
            for nid in by_value.get(v, []):
                if nid not in ids:
                    ids.append(nid)
        return ids

    for s in analysis.signals:
        sid = f"signal:{s.id}"
        nodes[sid] = GraphNode(
            id=sid, kind="signal", label=s.label, note=s.detail, signal_kind=s.kind, source=s.source,
            severity=s.severity, matched=s.matched[:3],
        )
        rel = resolve(s.related)
        rel_orgs = [i for i in rel if nodes[i].kind == "organization"]
        rel_other = [i for i in rel if nodes[i].kind != "organization"]
        # If both a link and its website are involved, attach to the website (that is what gets flagged).
        domain_ids = {i for i in rel_other if nodes[i].kind == "domain"}
        rel_other = [i for i in rel_other if not (nodes[i].kind == "url" and _nid("domain", parse_url(nodes[i].value or "").registered) in domain_ids)]

        targets = rel_other or rel_orgs or ["message"]
        for t in targets:
            link(sid, t, "flags", "flags", inferred=s.kind == "inference")

        reason = Reason(label=s.label, detail=s.detail, kind=s.kind, source=s.source, severity=s.severity)
        for i in rel:
            if all(r.label != reason.label for r in nodes[i].reasons):
                nodes[i].reasons.append(reason)

        # A look-alike / impersonation signal ties the website to the organization it imitates.
        if s.id in IMITATION_SIGNALS and rel_orgs:
            for d in rel_other:
                target = d
                if nodes[d].kind == "url":
                    target = _nid("domain", parse_url(nodes[d].value or "").registered)
                for o in rel_orgs:
                    link(target, o, "imitates", "may imitate", inferred=True)

    # --- earlier cases that share something with this one (the user's own only) ---
    case_ids: set[int] = set()
    for (kind, value), cases in related.items():
        ent = _nid(kind, value)
        if ent not in nodes:
            continue
        shown = 0
        for c in cases:
            if shown >= MAX_CASES_PER_ENTITY:
                break
            if c.id not in case_ids and len(case_ids) >= MAX_CASE_NODES:
                continue
            cid = f"case:{c.id}"
            if cid not in nodes:
                case_ids.add(c.id)
                nodes[cid] = GraphNode(
                    id=cid, kind="case", label=f"Case #{c.id}", investigation_id=c.id, risk_level=c.risk_level,
                    risk_score=c.risk_score, created_at=c.created_at, note=c.preview,
                )
            link(ent, cid, "also_seen", "also seen in")
            shown += 1
        nodes[ent].seen_before = len(cases)

    counts = {
        "nodes": len(nodes), "links": len(links),
        "flagged": sum(1 for n in nodes.values() if n.flagged),
        "signals": sum(1 for n in nodes.values() if n.kind == "signal"),
        "related_cases": len(case_ids),
    }
    return Graph(investigation_id=investigation_id, nodes=list(nodes.values()), links=links, counts=counts)
