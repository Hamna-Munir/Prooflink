"""Fold a validated AI review into the rule-based analysis, then re-score with the same engine."""
from app.ai.review import FINDING_TYPES, Review, explanation_ok
from app.analysis.explain import HEADLINES, build_actions, build_explanation
from app.analysis.result import Analysis, Entity, Signal
from app.analysis.scoring import confidence_for, level_for, score, unique_by_id

AI_LIMITATION = "An AI model also reviewed the text. AI can make mistakes, so its findings are marked as inferences."


def merge(base: Analysis, review: Review, text_len: int) -> Analysis:
    ai_signals: list[Signal] = []
    for f in review.findings:
        label, category, severity = FINDING_TYPES[f.type]
        about_org = f.type in ("brand_impersonation", "unusual_sender_claim")
        ai_signals.append(Signal(
            id=f"ai_{f.type}", label=label, kind="inference", category=category,  # type: ignore[arg-type]
            severity=severity, source="ai",
            detail=f.detail or f"{label}. This is an AI judgement, not a proven fact.",
            matched=[f.quote], related=review.organizations if about_org else [],
        ))

    # Same scoring engine as before. The AI can only ADD concerns, never subtract.
    signals = unique_by_id([*base.signals, *ai_signals])
    signals.sort(key=lambda s: -s.severity)
    value = score(signals)
    level = level_for(value)
    all_official = any("official domain" in r for r in base.reassurances) and not any(s.category == "link" for s in signals)
    confidence = confidence_for(level, signals, text_len, base.input_type == "url", all_official)

    entities = list(base.entities)
    have_orgs = {e.value.lower() for e in entities if e.kind == "organization"}
    for name in review.organizations:
        if name.lower() not in have_orgs:
            entities.append(Entity(kind="organization", value=name))
            have_orgs.add(name.lower())

    explanation = review.explanation if explanation_ok(review.explanation, level) else build_explanation(level, signals)
    has_link = any(e.kind in ("url", "email") for e in entities)

    return base.model_copy(update={
        "risk_level": level, "risk_score": value, "confidence": confidence,
        "headline": HEADLINES[level], "explanation": explanation,
        "signals": signals, "entities": entities,
        "recommended_actions": build_actions(level, signals, has_link),
        "limitations": [*base.limitations, AI_LIMITATION],
        "ai_used": True, "ai_note": None, "claimed_sender": review.claimed_sender,
    })

