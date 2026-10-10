"""Thin, provider-agnostic LLM client. Plain HTTPS via httpx; no vendor SDK needed.

Providers:
  anthropic          Claude Messages API
  openai_compatible  anything that speaks /chat/completions (xAI Grok, OpenAI, Groq, ...)
"""
import httpx

from app.config import get_settings

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001"


def _model() -> str:
    s = get_settings()
    if s.llm_provider == "anthropic":
        return s.llm_model or ANTHROPIC_DEFAULT_MODEL
    return s.llm_model


def enabled() -> bool:
    s = get_settings()
    if not s.llm_api_key:
        return False
    if s.llm_provider == "anthropic":
        return True
    if s.llm_provider == "openai_compatible":
        return bool(s.llm_base_url and s.llm_model)
    return False


def complete(system: str, user: str, max_tokens: int = 2500) -> str:
    """Send one prompt, return the model's text. Raises on any HTTP or format problem."""
    s = get_settings()
    if s.llm_provider == "anthropic":
        r = httpx.post(
            ANTHROPIC_URL,
            headers={"x-api-key": s.llm_api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={
                "model": _model(), "max_tokens": max_tokens, "temperature": 0,
                "system": system, "messages": [{"role": "user", "content": user}],
            },
            timeout=s.llm_timeout_seconds,
        )
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json()["content"] if b.get("type") == "text")

    r = httpx.post(
        s.llm_base_url.rstrip("/") + "/chat/completions",
        headers={"Authorization": f"Bearer {s.llm_api_key}", "content-type": "application/json"},
        json={
            "model": _model(), "max_tokens": max_tokens, "temperature": 0,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        },
        timeout=s.llm_timeout_seconds,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]
