import logging

import httpx

from app.ai import client
from app.ai.merge import merge
from app.ai.review import build_user_prompt, SYSTEM_PROMPT, interpret
from app.analysis import Analysis, analyze
from app.analysis.extract import normalize
from app.analysis.pipeline import MAX_CHARS

log = logging.getLogger("prooflink.ai")

AI_UNAVAILABLE = "AI review was unavailable, so this result uses ProofLink's built-in checks only."


def _short(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}: {exc.response.text[:300]}"
    return f"{type(exc).__name__}: {str(exc)[:300]}"


def analyze_with_ai(content: str, input_type: str | None = None) -> Analysis:
    """Rule-based analysis first (always), then an optional AI review on top.

    Any AI problem (no key, timeout, bad JSON, rate limit) falls back to the rule-based result.
    User text is never written to the logs.
    """
    base = analyze(content, input_type)
    if not client.enabled():
        return base

    text = normalize(content)[:MAX_CHARS]
    labels = [s.label for s in base.signals]
    try:
        raw = client.complete(SYSTEM_PROMPT, build_user_prompt(text, base.risk_level, base.risk_score, labels))
        review = interpret(raw, text)
        return merge(base, review, len(text))
    except Exception as exc:  # noqa: BLE001 - every failure must degrade gracefully
        log.warning("AI review failed, using rule-based result: %s", _short(exc))
        return base.model_copy(update={"ai_note": AI_UNAVAILABLE})
