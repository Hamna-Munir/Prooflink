from datetime import datetime, timezone

from app.analysis import analyze
from app.graph import CaseRef, MAX_ENTITY_NODES, build_graph

HIGH = "Your Netflix payment failed. Update your billing now: netflix-billing-help.top/update"
A = {"full_name": "Alice Test", "email": "alice@example.com", "password": "Correct-Horse-1"}
B = {"full_name": "Bobby Other", "email": "bobby@example.com", "password": "tr4in-Shelf*Lamp"}


def kinds(g, kind):
    return [n for n in g.nodes if n.kind == kind]


def edge(g, a, b, kind=None):
    return any(l.source == a and l.target == b and (kind is None or l.kind == kind) for l in g.links)


def test_high_risk_graph_structure():
    g = build_graph(7, analyze(HIGH))
    ids = {n.id for n in g.nodes}
    assert len(ids) == len(g.nodes)  # no duplicate nodes
    assert all(l.source in ids and l.target in ids for l in g.links)  # no dangling edges
    url = kinds(g, "url")[0]
    dom = kinds(g, "domain")[0]
    org = kinds(g, "organization")[0]
    assert edge(g, "message", url.id, "contains")
    assert edge(g, url.id, dom.id, "points_to")
    assert edge(g, "message", org.id)
    assert edge(g, dom.id, org.id, "imitates")
    assert [l for l in g.links if l.kind == "imitates"][0].inferred is True  # a guess, so it is drawn dashed


def test_clicking_a_flagged_domain_explains_why():
    g = build_graph(1, analyze(HIGH))
    dom = kinds(g, "domain")[0]
    assert dom.flagged and dom.note
    assert dom.reasons and all(r.detail for r in dom.reasons)
    assert any("Netflix" in r.label for r in dom.reasons)
    # the signal nodes that explain it are attached to the website
    flagging = [l.source for l in g.links if l.target == dom.id and l.kind == "flags"]
    assert flagging and all(s.startswith("signal:") for s in flagging)


def test_text_only_signals_attach_to_the_message():
    g = build_graph(1, analyze("Urgent! Act now and send your OTP right away"))
    sig = [n for n in g.nodes if n.kind == "signal"]
    assert sig and all(edge(g, s.id, "message", "flags") for s in sig)


def test_safe_message_is_just_the_message():
    g = build_graph(2, analyze("Hey are we still on for dinner at 8?"))
    assert [n.id for n in g.nodes] == ["message"] and g.links == []
    assert g.counts["flagged"] == 0


def test_evidence_and_inference_signals_are_labelled():
    g = build_graph(1, analyze(HIGH))
    sigs = [n for n in g.nodes if n.kind == "signal"]
    assert {n.signal_kind for n in sigs} == {"evidence", "inference"}
    assert all(n.source == "rules" for n in sigs)


def test_claimed_sender_becomes_node_or_merges_with_org():
    base = analyze(HIGH)
    g1 = build_graph(1, base.model_copy(update={"claimed_sender": "Netflix Billing Team"}))
    assert kinds(g1, "sender") and edge(g1, "message", kinds(g1, "sender")[0].id, "claims")
    g2 = build_graph(1, base.model_copy(update={"claimed_sender": "Netflix"}))
    assert not kinds(g2, "sender")  # same as the organization node, not duplicated
    assert [l.label for l in g2.links if l.kind == "claims"] == ["claims to be from"]


def test_related_cases_are_linked_and_capped():
    a = analyze(HIGH)
    dom = [e for e in a.entities if e.kind == "domain"][0].value
    now = datetime.now(timezone.utc)
    cases = [CaseRef(id=100 + i, risk_level="HIGH_RISK", risk_score=80, created_at=now, preview="x") for i in range(30)]
    g = build_graph(1, a, {("domain", dom): cases})
    case_nodes = kinds(g, "case")
    assert 0 < len(case_nodes) <= 5  # per-entity cap
    assert all(edge(g, f"domain:{dom}", c.id, "also_seen") for c in case_nodes)
    assert [n for n in g.nodes if n.id == f"domain:{dom}"][0].seen_before == 30


def test_graph_size_is_bounded():
    text = " ".join(f"https://site{i}-login-verify.top/x" for i in range(80))
    g = build_graph(1, analyze(text))
    entity_nodes = [n for n in g.nodes if n.kind in ("url", "domain", "email", "phone", "organization")]
    assert len(entity_nodes) <= MAX_ENTITY_NODES


# ---------- API ----------

def signup(c, user):
    assert c.post("/auth/signup", json=user).status_code == 201


def test_graph_endpoint_links_earlier_cases_of_same_user(client):
    signup(client, A)
    first = client.post("/investigations", json={"content": HIGH}).json()["id"]
    second = client.post("/investigations", json={"content": "Please re-check: " + HIGH}).json()["id"]
    client.post("/investigations", json={"content": "Hey are we still on for dinner at 8?"})
    g = client.get(f"/investigations/{second}/graph").json()
    cases = [n for n in g["nodes"] if n["kind"] == "case"]
    assert [c["investigation_id"] for c in cases] == [first]
    assert cases[0]["risk_level"] == "HIGH_RISK"
    assert g["counts"]["related_cases"] == 1
    assert any(l["kind"] == "also_seen" for l in g["links"])
    dom = [n for n in g["nodes"] if n["kind"] == "domain"][0]
    assert dom["seen_before"] == 1


def test_graph_never_mixes_users(client, client2):
    signup(client, A)
    signup(client2, B)
    mine = client.post("/investigations", json={"content": HIGH}).json()["id"]
    theirs = client2.post("/investigations", json={"content": HIGH}).json()["id"]
    g = client.get(f"/investigations/{mine}/graph").json()
    assert [n for n in g["nodes"] if n["kind"] == "case"] == []  # B's identical case must not appear
    assert client2.get(f"/investigations/{mine}/graph").status_code == 404
    assert client.get(f"/investigations/{theirs}/graph").status_code == 404


def test_graph_requires_login(client):
    assert client.get("/investigations/1/graph").status_code == 401
