"""Phase 7 (screenshot input), Phase 9 (account settings) and Phase 10 (deployment safety)."""
import pytest

from app.config import Settings

A = {"full_name": "Alice Test", "email": "alice@example.com", "password": "Correct-Horse-1"}
B = {"full_name": "Bobby Other", "email": "bobby@example.com", "password": "tr4in-Shelf*Lamp"}
HIGH = "Your Netflix payment failed. Update your billing now: netflix-billing-help.top/update"
SAFE = "Hey are we still on for dinner at 8? I booked the usual place."


def signup(c, user):
    assert c.post("/auth/signup", json=user).status_code == 201


# ---------------------------------------------------------------- Phase 7: screenshots
def test_screenshot_input_type_is_saved_and_labelled(client):
    signup(client, A)
    r = client.post("/investigations", json={"content": HIGH, "input_type": "screenshot"})
    assert r.status_code == 201
    body = r.json()
    assert body["input_type"] == "screenshot"
    assert body["analysis"]["input_type"] == "screenshot"
    # Same engine as a pasted message: the verdict must not depend on how the text arrived
    plain = client.post("/investigations", json={"content": HIGH, "input_type": "message"}).json()
    assert body["analysis"]["risk_level"] == plain["analysis"]["risk_level"] == "HIGH_RISK"
    assert body["analysis"]["risk_score"] == plain["analysis"]["risk_score"]
    # ...but the reader is told the text came from OCR
    assert any("screenshot" in s for s in body["analysis"]["limitations"])
    assert not any("screenshot" in s for s in plain["analysis"]["limitations"])


def test_screenshot_shows_in_history_and_graph(client):
    signup(client, A)
    iid = client.post("/investigations", json={"content": HIGH, "input_type": "screenshot"}).json()["id"]
    assert client.get("/investigations").json()["items"][0]["input_type"] == "screenshot"
    graph = client.get(f"/investigations/{iid}/graph").json()
    assert next(n for n in graph["nodes"] if n["id"] == "message")["label"] == "This screenshot"


def test_unknown_input_type_rejected(client):
    signup(client, A)
    assert client.post("/investigations", json={"content": HIGH, "input_type": "video"}).status_code == 422


# ---------------------------------------------------------------- Phase 9: settings
def test_update_profile_name(client):
    signup(client, A)
    r = client.patch("/auth/me", json={"full_name": "  Alice   Renamed "})
    assert r.status_code == 200 and r.json()["full_name"] == "Alice Renamed"
    assert client.get("/auth/me").json()["full_name"] == "Alice Renamed"
    assert client.patch("/auth/me", json={"full_name": "A"}).status_code == 422
    assert client.patch("/auth/me", json={"full_name": "   "}).status_code == 422


def test_profile_and_account_routes_need_login(client):
    assert client.patch("/auth/me", json={"full_name": "Someone"}).status_code == 401
    assert client.post("/auth/change-password", json={"current_password": "x", "new_password": "y"}).status_code == 401
    assert client.request("DELETE", "/auth/me", json={"password": "x"}).status_code == 401
    assert client.delete("/investigations").status_code == 401


def test_change_password_flow(client):
    signup(client, A)
    new = "Blue-Kettle-7-Moon"
    wrong = client.post("/auth/change-password", json={"current_password": "nope", "new_password": new})
    assert wrong.status_code == 400 and "current password" in wrong.json()["detail"]
    weak = client.post("/auth/change-password", json={"current_password": A["password"], "new_password": "short"})
    assert weak.status_code == 400 and "too weak" in weak.json()["detail"].lower()
    same = client.post("/auth/change-password", json={"current_password": A["password"], "new_password": A["password"]})
    assert same.status_code == 400
    ok = client.post("/auth/change-password", json={"current_password": A["password"], "new_password": new})
    assert ok.status_code == 204
    client.post("/auth/logout")
    assert client.post("/auth/login", json={"email": A["email"], "password": A["password"]}).status_code == 401
    assert client.post("/auth/login", json={"email": A["email"], "password": new}).status_code == 200


def test_delete_all_history_only_touches_my_data(client, client2):
    signup(client, A)
    signup(client2, B)
    client.post("/investigations", json={"content": HIGH})
    client.post("/investigations", json={"content": SAFE})
    client2.post("/investigations", json={"content": HIGH})
    assert client.delete("/investigations").status_code == 204
    assert client.get("/investigations").json()["total"] == 0
    assert client.get("/investigations/stats").json()["total"] == 0
    assert client2.get("/investigations").json()["total"] == 1  # Bobby's history untouched
    assert client.get("/auth/me").status_code == 200  # still signed in


def test_delete_account_removes_everything(client, client2):
    from sqlalchemy import func, select

    from app.database import SessionLocal
    from app.models import AnalysisResult, Entity, Investigation, User

    signup(client, A)
    signup(client2, B)
    client.post("/investigations", json={"content": HIGH})
    client2.post("/investigations", json={"content": HIGH})

    assert client.request("DELETE", "/auth/me", json={"password": "wrong"}).status_code == 400
    assert client.get("/auth/me").status_code == 200  # a wrong password deletes nothing

    r = client.request("DELETE", "/auth/me", json={"password": A["password"]})
    assert r.status_code == 204
    assert client.get("/auth/me").status_code == 401
    assert client.post("/auth/login", json={"email": A["email"], "password": A["password"]}).status_code == 401

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1  # only Bobby is left
        assert db.scalar(select(func.count()).select_from(Investigation)) == 1
        assert db.scalar(select(func.count()).select_from(AnalysisResult)) == 1
        assert db.scalar(select(func.count()).select_from(Entity)) >= 1
        assert {i.user_id for i in db.scalars(select(Investigation)).all()} == {db.scalar(select(User.id).where(User.email == B["email"]))}


# ---------------------------------------------------------------- Phase 10: deployment safety
@pytest.mark.parametrize("given", [
    "postgres://u:p@host:5432/db",
    "postgresql://u:p@host:5432/db",
    "postgresql+psycopg://u:p@host:5432/db",
])
def test_database_url_is_normalised_for_psycopg(given):
    assert Settings(database_url=given, _env_file=None).database_url == "postgresql+psycopg://u:p@host:5432/db"


def test_sqlite_url_left_alone():
    assert Settings(database_url="sqlite:///./x.db", _env_file=None).database_url == "sqlite:///./x.db"


@pytest.mark.parametrize("secret", ["change-me-in-production", "short", ""])
def test_live_deployment_refuses_weak_jwt_secret(secret):
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(cookie_secure=True, jwt_secret=secret, _env_file=None)


def test_live_deployment_accepts_strong_secret_and_local_dev_can_use_default():
    assert Settings(cookie_secure=True, jwt_secret="x" * 48, _env_file=None).cookie_secure is True
    assert Settings(cookie_secure=False, jwt_secret="dev", _env_file=None).jwt_secret == "dev"  # local dev is not blocked


def test_seed_demo_creates_account_once(client):
    from app.seed_demo import seed

    msg, created = seed("demo@prooflink.app", "Demo-Pass-9!x")
    assert created and "Added" in msg
    msg2, created2 = seed("demo@prooflink.app", "ignored")
    assert not created2 and "already has" in msg2
    assert client.post("/auth/login", json={"email": "demo@prooflink.app", "password": "Demo-Pass-9!x"}).status_code == 200
    items = client.get("/investigations").json()
    assert items["total"] == 5 and {i["risk_level"] for i in items["items"]} >= {"HIGH_RISK", "SAFE"}
