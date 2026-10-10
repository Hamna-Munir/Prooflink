USER = {"full_name": "Test User", "email": "Test@Example.com", "password": "Correct-Horse-1"}


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_signup_sets_cookie_and_me_works(client):
    r = client.post("/auth/signup", json=USER)
    assert r.status_code == 201
    assert r.json()["email"] == "test@example.com"
    assert "password" not in r.text
    assert "httponly" in r.headers["set-cookie"].lower()
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["full_name"] == "Test User"


def test_duplicate_email_rejected(client):
    client.post("/auth/signup", json=USER)
    r = client.post("/auth/signup", json={**USER, "email": "test@example.com"})
    assert r.status_code == 409


def test_login_wrong_password(client):
    client.post("/auth/signup", json=USER)
    client.post("/auth/logout")
    r = client.post("/auth/login", json={"email": USER["email"], "password": "wrong-password"})
    assert r.status_code == 401


def test_login_and_logout_flow(client):
    client.post("/auth/signup", json=USER)
    client.post("/auth/logout")
    assert client.get("/auth/me").status_code == 401
    r = client.post("/auth/login", json={"email": USER["email"], "password": USER["password"]})
    assert r.status_code == 200
    assert client.get("/auth/me").status_code == 200


def test_me_requires_auth(client):
    assert client.get("/auth/me").status_code == 401


def test_short_password_rejected(client):
    r = client.post("/auth/signup", json={**USER, "password": "short"})
    assert r.status_code == 422


def test_analyze_requires_login(client):
    assert client.post("/analyze", json={"content": "hello"}).status_code == 401


def test_analyze_endpoint_returns_structured_result(client):
    client.post("/auth/signup", json=USER)
    r = client.post("/analyze", json={"content": "Verify your account now: https://paypa1-login.top"})
    assert r.status_code == 200
    body = r.json()
    for key in ("risk_level", "risk_score", "confidence", "signals", "entities", "recommended_actions", "explanation", "limitations"):
        assert key in body
    assert body["risk_level"] in ("SUSPICIOUS", "HIGH_RISK")


def test_analyze_rejects_blank_and_oversized(client):
    client.post("/auth/signup", json=USER)
    assert client.post("/analyze", json={"content": "   "}).status_code == 422
    assert client.post("/analyze", json={"content": "x" * 10001}).status_code == 422


def test_demo_examples_public_and_cover_all_levels(client):
    r = client.get("/demo/examples")
    assert r.status_code == 200
    levels = [ex["analysis"]["risk_level"] for ex in r.json()]
    assert levels == ["HIGH_RISK", "SUSPICIOUS", "SAFE"]


import pytest


@pytest.mark.parametrize("pw,fragment", [
    ("short1!", "at least 8 characters"),
    ("alllowercase1!", "an uppercase letter"),
    ("ALLUPPERCASE1!", "a lowercase letter"),
    ("NoNumbersHere!", "a number"),
    ("NoSymbols1234", "a symbol"),
    ("Password@123", "too common"),
    ("P@ssw0rd!", "too common"),
    ("Hamna-Munir-9!", "name or email"),
])
def test_weak_passwords_rejected_with_clear_message(client, pw, fragment):
    r = client.post("/auth/signup", json={**USER, "full_name": "Hamna Munir", "password": pw})
    assert r.status_code == 422
    assert fragment in r.json()["detail"][0]["msg"]


def test_strong_password_accepted(client):
    r = client.post("/auth/signup", json={**USER, "password": "tr4in-Shelf*Lamp"})
    assert r.status_code == 201


def test_login_still_accepts_old_weak_passwords(client, monkeypatch):
    # Accounts made before the policy existed must still be able to log in.
    from app.database import SessionLocal
    from app.models import User
    from app.security import hash_password

    with SessionLocal() as db:
        db.add(User(email="old@example.com", full_name="Old User", password_hash=hash_password("weakpass")))
        db.commit()
    r = client.post("/auth/login", json={"email": "old@example.com", "password": "weakpass"})
    assert r.status_code == 200
