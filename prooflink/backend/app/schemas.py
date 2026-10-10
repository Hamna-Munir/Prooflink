from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.analysis import Analysis

from app.password_policy import password_error


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def password_is_strong(self):
        problem = password_error(self.password, str(self.email), self.full_name)
        if problem:
            raise ValueError(problem)
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)

    @field_validator("full_name")
    @classmethod
    def trimmed(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Enter your name")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    created_at: datetime


def _as_utc(v: datetime) -> datetime:
    # SQLite returns naive datetimes; everything we store is UTC, so say so explicitly.
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v


class InvestigationSummary(BaseModel):
    id: int
    created_at: datetime
    input_type: str
    risk_level: str
    risk_score: int
    preview: str
    top_signals: list[str]

    _utc = field_validator("created_at")(_as_utc)


class InvestigationDetail(BaseModel):
    id: int
    created_at: datetime
    input_type: str
    content: str
    analysis: Analysis

    _utc = field_validator("created_at")(_as_utc)


class InvestigationList(BaseModel):
    items: list[InvestigationSummary]
    total: int


class DashboardStats(BaseModel):
    total: int
    high_risk: int
    suspicious: int
    safe: int
    recent: list[InvestigationSummary]
