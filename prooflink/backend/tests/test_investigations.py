A = {"full_name": "Alice Test", "email": "alice@example.com", "password": "Correct-Horse-1"}
B = {"full_name": "Bobby Other", "email": "bobby@example.com", "password": "tr4in-Shelf*Lamp"}

HIGH = "Your Netflix payment failed. Update your billing now: netflix-billing-help.top/update"
SAFE = "Hey are we still on for dinner at 8? I booked the usual place."
MID = "You have won a free iPhone! Claim your prize now: bit.ly/win-iphone-now"


def signup(c, user):
    assert c.post("/auth/signup", json=user).status_code == 201


def test_requires_login(client):
    assert client.post("/investigations", json={"content": "hi"}).status_code == 401
    assert client.get("/investigations").status_code == 401
    assert client.get("/investigations/stats").status_code == 401
    assert client.get("/investigations/1").status_code == 401


def test_create_saves_and_returns_full_analysis(client):
    signup(client, A)
    r = client.post("/investigations", json={"content": HIGH})
    assert r.status_code == 201
    body = r.json()
    assert body["content"] == HIGH
    assert body["analysis"]["risk_level"] == "HIGH_RISK"
    assert body["analysis"]["signals"] and body["analysis"]["entities"]
    assert body["created_at"].endswith(("Z", "+00:00"))  # timezone is explicit
    again = client.get(f"/investigations/{body['id']}").json()
    assert again["analysis"] == body["analysis"]  # reopening shows exactly what was saved


def test_list_newest_first_with_filter_and_paging(client):
    signup(client, A)
    for text in (SAFE, MID, HIGH):
        client.post("/investigations", json={"content": text})
    items = client.get("/investigations").json()
    assert items["total"] == 3
    assert [i["risk_level"] for i in items["items"]] == ["HIGH_RISK", "SUSPICIOUS", "SAFE"]
    assert items["items"][0]["top_signals"]
    only = client.get("/investigations", params={"risk": "SAFE"}).json()
    assert only["total"] == 1 and only["items"][0]["risk_level"] == "SAFE"
    page = client.get("/investigations", params={"limit": 2, "offset": 2}).json()
    assert page["total"] == 3 and len(page["items"]) == 1
    assert client.get("/investigations", params={"risk": "NOPE"}).status_code == 422


def test_stats(client):
    signup(client, A)
    empty = client.get("/investigations/stats").json()
    assert empty == {"total": 0, "high_risk": 0, "suspicious": 0, "safe": 0, "recent": []}
    for text in (SAFE, SAFE, MID, HIGH):
        client.post("/investigations", json={"content": text})
    s = client.get("/investigations/stats").json()
    assert (s["total"], s["high_risk"], s["suspicious"], s["safe"]) == (4, 1, 1, 2)
    assert len(s["recent"]) == 4 and s["recent"][0]["risk_level"] == "HIGH_RISK"


def test_users_cannot_see_or_delete_each_others_data(client, client2):
    signup(client, A)
    signup(client2, B)
    mine = client.post("/investigations", json={"content": HIGH}).json()["id"]
    assert client2.get(f"/investigations/{mine}").status_code == 404
    assert client2.delete(f"/investigations/{mine}").status_code == 404
    assert client2.get("/investigations").json() == {"items": [], "total": 0}
    assert client2.get("/investigations/stats").json()["total"] == 0
    assert client.get(f"/investigations/{mine}").status_code == 200  # still there


def test_delete(client):
    signup(client, A)
    iid = client.post("/investigations", json={"content": SAFE}).json()["id"]
    assert client.delete(f"/investigations/{iid}").status_code == 204
    assert client.get(f"/investigations/{iid}").status_code == 404
    assert client.get("/investigations/stats").json()["total"] == 0


def test_blank_content_rejected(client):
    signup(client, A)
    assert client.post("/investigations", json={"content": "   "}).status_code == 422
