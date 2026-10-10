"""Database models.

Four tables:
- users: accounts
- investigations: one row per thing a user checked (message / url / screenshot)
- entities: URLs, domains, phones, emails, organizations extracted from an investigation
- analysis_results: structured output of the analysis pipeline (1:1 with investigation)
"""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    investigations: Mapped[list["Investigation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    input_type: Mapped[str] = mapped_column(String(20))  # message | url | screenshot
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    screenshot_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Denormalised for fast dashboard/history queries
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    user: Mapped["User"] = relationship(back_populates="investigations")
    entities: Mapped[list["Entity"]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )
    result: Mapped["AnalysisResult | None"] = relationship(
        back_populates="investigation", uselist=False, cascade="all, delete-orphan"
    )


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    investigation_id: Mapped[int] = mapped_column(
        ForeignKey("investigations.id", ondelete="CASCADE"), index=True
    )
    # url | domain | phone | email | organization | sender
    kind: Mapped[str] = mapped_column(String(30), index=True)
    value: Mapped[str] = mapped_column(String(1024), index=True)
    flagged: Mapped[bool] = mapped_column(default=False)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    investigation: Mapped["Investigation"] = relationship(back_populates="entities")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    investigation_id: Mapped[int] = mapped_column(
        ForeignKey("investigations.id", ondelete="CASCADE"), unique=True
    )
    risk_level: Mapped[str] = mapped_column(String(20))
    risk_score: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column()
    # [{id, label, kind: "evidence"|"inference", detail}]
    signals: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text, default="")
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    # Full structured pipeline output, kept for the 3D graph and future re-rendering
    raw_analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    investigation: Mapped["Investigation"] = relationship(back_populates="result")
