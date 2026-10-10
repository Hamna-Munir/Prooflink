from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.ai import analyze_with_ai
from app.analysis import Analysis, analyze
from app.analysis.pipeline import MAX_CHARS
from app.analysis.samples import DEMO_EXAMPLES
from app.models import User
from app.ratelimit import rate_limited_user

router = APIRouter(tags=["analysis"])


class AnalyzeRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_CHARS)
    input_type: Literal["message", "url", "screenshot"] | None = None

    @field_validator("content")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Paste a message or a link to check")
        return v


class DemoExample(BaseModel):
    id: str
    title: str
    channel: str
    text: str
    analysis: Analysis


@router.post("/analyze", response_model=Analysis)
def analyze_content(body: AnalyzeRequest, _user: User = Depends(rate_limited_user)):
    """Run the analysis pipeline. (Saving to the user's history is added in Phase 5.)"""
    return analyze_with_ai(body.content, body.input_type)


@lru_cache
def _demo() -> list[DemoExample]:
    return [DemoExample(**ex, analysis=analyze(ex["text"])) for ex in DEMO_EXAMPLES]


@router.get("/demo/examples", response_model=list[DemoExample])
def demo_examples():
    """Public. Takes no input: it returns the real engine's output for fixed sample messages,
    so the landing page can show live results without exposing the analyser to anonymous users."""
    return _demo()
