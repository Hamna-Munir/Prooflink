import os

# Must be set before the app is imported
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["JWT_SECRET"] = "test-secret"
# Tests must never call a real AI service, even if a developer has a key in .env
os.environ["LLM_PROVIDER"] = "none"
os.environ["LLM_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app import ratelimit
from app.main import app


@pytest.fixture()
def client():
    ratelimit.reset()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def client2(client):
    """A second, separate browser session (own cookie jar) for privacy tests."""
    with TestClient(app) as c:
        yield c
