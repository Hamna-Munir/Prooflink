from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # postgresql+psycopg://user:pass@host:5432/dbname
    database_url: str = "postgresql+psycopg://prooflink:prooflink@localhost:5432/prooflink"

    # Generate a real one: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 7  # 7 days

    # Cookie settings. In production the frontend proxies /api/* to this backend,
    # so cookies stay same-origin and "lax" works. Set COOKIE_SECURE=true on Railway.
    cookie_name: str = "prooflink_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # AI review (Phase 4). Leave LLM_PROVIDER=none to run on the built-in rules only.
    #   anthropic         -> Claude (needs LLM_API_KEY; LLM_MODEL optional)
    #   openai_compatible -> Grok / OpenAI / Groq ... (needs LLM_API_KEY, LLM_BASE_URL, LLM_MODEL)
    llm_provider: str = "none"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_base_url: str = ""
    llm_timeout_seconds: float = 20.0

    # Abuse / cost protection, per signed-in user
    rate_limit_per_minute: int = 10
    daily_check_limit: int = 100

    # Comma-separated list of origins allowed to call the API directly (local dev)
    cors_origins: str = "http://localhost:3000"

    @model_validator(mode="after")
    def _deployment_safety(self):
        # Railway and Heroku hand out "postgres://..." or "postgresql://...". SQLAlchemy needs the driver name.
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                self.database_url = "postgresql+psycopg://" + url[len(prefix):]
                break
        # COOKIE_SECURE=true means this is a real HTTPS deployment. Never run that with a guessable signing key.
        if self.cookie_secure and (self.jwt_secret.startswith("change-me") or len(self.jwt_secret) < 32):
            raise ValueError(
                "JWT_SECRET is missing or too weak for a live deployment. Set JWT_SECRET to a long random "
                "string (at least 32 characters): python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
