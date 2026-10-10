"""Shared data structures for the analysis pipeline.

Every field here is part of the contract with the frontend and the database,
so keep it predictable.
"""
from typing import Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["SAFE", "SUSPICIOUS", "HIGH_RISK"]
# evidence  = something literally present in the input (a phrase, a domain trait)
# inference = a judgement we drew from the evidence (impersonation, claimed identity)
SignalKind = Literal["evidence", "inference"]
SignalCategory = Literal["pressure", "request", "scam_type", "link", "impersonation", "contact"]
EntityKind = Literal["url", "domain", "phone", "email", "organization"]


class Signal(BaseModel):
    id: str
    label: str  # short, plain-language title
    kind: SignalKind
    category: SignalCategory
    severity: int  # contribution to risk, 1-50
    detail: str  # why this matters, in plain language
    matched: list[str] = Field(default_factory=list)  # snippets from the input
    related: list[str] = Field(default_factory=list)  # entity values this signal is about
    source: Literal["rules", "ai"] = "rules"  # who found it


class Entity(BaseModel):
    kind: EntityKind
    value: str
    flagged: bool = False
    flag_reason: str | None = None


class Analysis(BaseModel):
    input_type: Literal["message", "url", "screenshot"]
    risk_level: RiskLevel
    risk_score: int  # 3-97. We never report 0 or 100: no check is that certain.
    confidence: float  # 0-1, how sure we are about the level (not the same as the score)
    headline: str
    explanation: str
    signals: list[Signal]
    entities: list[Entity]
    recommended_actions: list[str]
    reassurances: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    ai_used: bool = False  # True only when an AI review was actually merged in
    ai_note: str | None = None  # set when AI was expected but unavailable
    claimed_sender: str | None = None  # who the message says it is from (AI-extracted, quoted from the text)
