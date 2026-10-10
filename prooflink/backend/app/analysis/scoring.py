"""Step 6: risk scoring. Deterministic and explainable: no model decides the number alone.

score  = how risky the input looks, 3-97
level  = SAFE (<30), SUSPICIOUS (30-54), HIGH_RISK (55+)
confidence = how sure we are about the level
"""
from app.analysis.result import RiskLevel, Signal

SAFE_BELOW = 30
HIGH_FROM = 55

LINK_IMPERSONATION = {
    "lookalike_domain", "brand_in_subdomain", "brand_embedded_domain", "brand_unofficial_tld",
    "punycode_domain", "userinfo_trick",
}
MONEY_OR_CREDS = {"credential_request", "payment_request", "untraceable_payment"}


def unique_by_id(signals: list[Signal]) -> list[Signal]:
    """Merge repeated signals (e.g. two bad domains) into one entry per signal id."""
    merged: dict[str, Signal] = {}
    for s in signals:
        if s.id not in merged:
            merged[s.id] = s.model_copy(deep=True)
            continue
        m = merged[s.id]
        m.severity = max(m.severity, s.severity)
        m.matched += [x for x in s.matched if x not in m.matched]
        m.related += [x for x in s.related if x not in m.related]
    return list(merged.values())


def synergy_bonus(signals: list[Signal]) -> int:
    ids = {s.id for s in signals}
    cats = {s.category for s in signals}
    pressure = {s.id for s in signals if s.category == "pressure"}
    link_ids = {s.id for s in signals if s.category == "link" and s.id != "insecure_http"}
    bonus = 0
    if ids & MONEY_OR_CREDS and pressure:
        bonus += 12  # asking for something sensitive while rushing you
    if ids & LINK_IMPERSONATION and (pressure or ids & MONEY_OR_CREDS or "click_to_verify" in ids):
        bonus += 12  # a fake-looking site that is also being pushed at you
    if "credential_request" in ids and (link_ids or "click_to_verify" in ids):
        bonus += 10
    if "brand_link_mismatch" in ids and ids & MONEY_OR_CREDS:
        bonus += 10
    scam_types = ids & {"delivery_notice", "reward_scam", "job_scam", "investment_scam", "family_impersonation"}
    if scam_types and ids & {"payment_request", "untraceable_payment"}:
        bonus += 14  # a known scam story that also wants money
    elif scam_types and link_ids:
        bonus += 10  # a known scam story pushing a questionable link
    if "brand_link_mismatch" in ids and ids & LINK_IMPERSONATION:
        bonus += 10  # claims to be a brand and uses a fake-looking domain for it
    if "authority_claim" in ids and ids & (MONEY_OR_CREDS | {"install_request"}):
        bonus += 10  # "I'm from support" + wants access or money
    if len(cats) >= 4:
        bonus += 8  # many independent kinds of warning sign
    return bonus


def score(signals: list[Signal]) -> int:
    survival = 1.0
    for s in signals:
        survival *= 1 - min(s.severity, 50) / 100
    value = (1 - survival) * 100 + synergy_bonus(signals)
    # Weak-evidence guard: with only inferences and no observed facts we never go above SUSPICIOUS.
    if signals and not any(s.kind == "evidence" for s in signals):
        value = min(value, 45)
    return max(3, min(97, round(value)))


def level_for(value: int) -> RiskLevel:
    if value >= HIGH_FROM:
        return "HIGH_RISK"
    if value >= SAFE_BELOW:
        return "SUSPICIOUS"
    return "SAFE"


def confidence_for(level: RiskLevel, signals: list[Signal], text_len: int, url_only: bool, all_links_official: bool) -> float:
    cats = {s.category for s in signals}
    n_evidence = sum(s.kind == "evidence" for s in signals)
    if level == "SAFE":
        c = 0.35 if text_len < 25 else 0.55
        if text_len >= 80:
            c += 0.1
        if all_links_official:
            c += 0.05
        c = min(c, 0.7)  # absence of warning signs is never strong proof
    else:
        c = 0.45 + 0.1 * len(cats) + 0.03 * min(n_evidence, 4)
        c = min(c, 0.75 if level == "SUSPICIOUS" else 0.92)
    if url_only:
        c = min(c, 0.7)  # we never open the link, so a bare URL gets less certainty
    return round(c, 2)
