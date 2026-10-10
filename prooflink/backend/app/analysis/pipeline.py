"""The analysis pipeline.

input -> normalise -> extract (URLs, emails, phones, brands) -> domain analysis
      -> text signals -> impersonation checks -> scoring -> explanation -> actions
"""
import re
from collections.abc import Iterable

from app.analysis import domains as dom
from app.analysis.brands import BRANDS, Brand
from app.analysis.explain import HEADLINES, build_actions, build_explanation
from app.analysis.extract import extract_all, find_brands, mask, normalize
from app.analysis.result import Analysis, Entity, Signal
from app.analysis.rules import _SENSITIVE, detect_text_signals
from app.analysis.scoring import confidence_for, level_for, score, unique_by_id

MAX_CHARS = 10_000
BRAND_NAMES = {b.name for b in BRANDS}
_WARNS_AGAINST_SHARING = re.compile(rf"\b(?:do not|don'?t|never)\b[^.\n]{{0,30}}\b{_SENSITIVE}\b|\b(?:do not|don'?t|never)\s+share\b", re.I)


def analyze(content: str, input_type: str | None = None) -> Analysis:
    text = normalize(content)[:MAX_CHARS]
    urls, emails, phones = extract_all(text)
    prose = mask(mask(text, urls), emails)  # the message without links/addresses

    if input_type not in ("message", "url", "screenshot"):
        input_type = "url" if (len(urls) == 1 and not emails and len(text.split()) == 1) else "message"

    # --- domain analysis (passive: nothing is ever fetched) ---
    infos = [dom.parse_url(u) for u in urls]
    email_infos = [(e, dom.parse_url(e.rsplit("@", 1)[1])) for e in emails]
    signals: list[Signal] = []
    for info in infos:
        signals += dom.domain_signals(info)
    for email, info in email_infos:
        for s in dom.domain_signals(info):
            s.related.append(email)
            signals.append(s)

    # --- text signals ---
    signals += detect_text_signals(prose if input_type in ("message", "screenshot") else text)

    # --- impersonation: message names a brand, but the links go somewhere else ---
    link_infos = infos + [i for _, i in email_infos]
    mentioned = find_brands(prose)
    mismatched = [b for b in mentioned if link_infos and not any(dom.is_official(i, b) for i in link_infos)]
    if mismatched:
        names = ", ".join(b.name for b in mismatched[:2])
        targets = sorted({i.registered for i in link_infos})
        signals.append(Signal(
            id="brand_link_mismatch", label=f"Mentions {names}, but the link goes elsewhere",
            kind="inference", category="impersonation", severity=16,
            detail=f"The message talks about {names}, but its links lead to {', '.join(targets[:3])}, which is not an official {names} domain. This may mean someone is posing as {names}.",
            matched=[names], related=[*targets, *[b.name for b in mismatched[:2]]],
        ))

    signals = unique_by_id(signals)
    signals.sort(key=lambda s: -s.severity)

    # --- scoring ---
    value = score(signals)
    level = level_for(value)
    all_official = bool(link_infos) and all(dom.official_brands(i) for i in link_infos)
    confidence = confidence_for(level, signals, len(text), input_type == "url", all_official)

    # --- entities ---
    entities = _build_entities(urls, emails, phones, infos, email_infos, mentioned, signals)

    reassurances = _reassurances(text, link_infos, level)
    limitations = _limitations(text, urls, signals, input_type)

    return Analysis(
        input_type=input_type,  # type: ignore[arg-type]
        risk_level=level, risk_score=value, confidence=confidence,
        headline=HEADLINES[level], explanation=build_explanation(level, signals),
        signals=signals, entities=entities,
        recommended_actions=build_actions(level, signals, has_link=bool(urls or emails)),
        reassurances=reassurances, limitations=limitations,
    )


def _build_entities(urls, emails, phones, infos, email_infos, mentioned: Iterable[Brand], signals: list[Signal]) -> list[Entity]:
    reasons: dict[str, str] = {}
    for s in signals:
        if s.category in ("link", "impersonation") or s.id == "callback_request":
            for v in s.related:
                reasons.setdefault(v, s.label)
    entities: list[Entity] = []
    seen: set[tuple[str, str]] = set()

    def add(kind: str, value: str, flag_value: str | None = None) -> None:
        if (kind, value) in seen:
            return
        seen.add((kind, value))
        reason = reasons.get(flag_value or value)
        entities.append(Entity(kind=kind, value=value, flagged=reason is not None, flag_reason=reason))  # type: ignore[arg-type]

    for u, info in zip(urls, infos):
        add("url", u)
    for info in infos:
        add("domain", info.registered)
    for e, info in email_infos:
        add("email", e)
        add("domain", info.registered)
    for p in phones:
        add("phone", p, flag_value=p if p in reasons else None)
    org_names = [b.name for b in mentioned]
    for s_ in signals:  # brands implied by look-alike domains
        for v in s_.related:
            if v in BRAND_NAMES and v not in org_names:
                org_names.append(v)
    for name in org_names:
        entities.append(Entity(kind="organization", value=name))
    if any(s.id == "callback_request" for s in signals):
        for ent in entities:
            if ent.kind == "phone" and not ent.flagged:
                ent.flagged, ent.flag_reason = True, "The message asks you to call this number"
    return entities


def _reassurances(text: str, link_infos, level) -> list[str]:
    out: list[str] = []
    for info in link_infos:
        for b in dom.official_brands(info):
            msg = f"A link goes to {info.registered}, which is {b.name}'s official domain."
            if msg not in out:
                out.append(msg)
    if _WARNS_AGAINST_SHARING.search(text):
        out.append("The message tells you not to share your code, which is what legitimate services say.")
    return out[:3]


def _limitations(text: str, urls, signals: list[Signal], input_type: str) -> list[str]:
    out = ["ProofLink looks for patterns in the text and links. It can't verify who really sent the message."]
    if urls:
        out.append("We didn't open the link or check how old the website is.")
    if len(text) < 25 and input_type in ("message", "screenshot"):
        out.append("The message is very short, so there's little to analyse.")
    if input_type == "screenshot":
        out.append("This text was read from a screenshot by automatic text recognition, so a few words may have been misread.")
    if any(s.kind == "inference" for s in signals):
        out.append("Some findings are inferences: reasonable guesses from the evidence, not proven facts.")
    return out
