import os, uuid, requests, time
from datetime import datetime, timezone
BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://smart-volume-rider.preview.emergentagent.com").rstrip("/") + "/api"

def uid(): return f"TEST_{uuid.uuid4()}"

def test_root():
    r = requests.get(f"{BASE}/")
    assert r.status_code == 200 and r.json().get("version") == "1.0"

def test_settings_default():
    u = uid()
    r = requests.get(f"{BASE}/settings/{u}")
    assert r.status_code == 200
    d = r.json()
    assert "_id" not in d
    assert d["mode"] == "Cycling" and d["max_volume"] == 100.0
    assert len(d["speed_volume_map"]) == 4

def test_settings_put_patch():
    u = uid()
    requests.get(f"{BASE}/settings/{u}")
    time.sleep(1)
    r = requests.put(f"{BASE}/settings/{u}", json={"mode": "Driving", "window_level": 75})
    assert r.status_code == 200
    d = r.json()
    assert d["mode"] == "Driving" and d["window_level"] == 75
    g = requests.get(f"{BASE}/settings/{u}").json()
    assert g["mode"] == "Driving" and g["window_level"] == 75

def test_settings_custom_map():
    u = uid()
    m = [{"speed": 5, "volume": 10}, {"speed": 50, "volume": 80}]
    r = requests.put(f"{BASE}/settings/{u}", json={"speed_volume_map": m})
    assert r.status_code == 200
    assert r.json()["speed_volume_map"] == m

def test_subscription_default():
    u = uid()
    r = requests.get(f"{BASE}/subscription/{u}")
    assert r.status_code == 200
    d = r.json()
    assert "_id" not in d and d["tier"] == "free"

def test_activate_plans():
    for plan, days in [("trial", 3), ("monthly", 30), ("quarterly", 90)]:
        u = uid()
        r = requests.post(f"{BASE}/subscription/activate", json={"user_id": u, "plan": plan})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tier"] == "pro" and d["plan"] == plan
        exp = datetime.fromisoformat(d["expires_at"])
        st = datetime.fromisoformat(d["started_at"])
        delta_days = (exp - st).total_seconds() / 86400
        assert abs(delta_days - days) < 0.5

def test_activate_invalid():
    r = requests.post(f"{BASE}/subscription/activate", json={"user_id": uid(), "plan": "yearly"})
    assert r.status_code == 400

def test_cancel():
    # New schema: cancel requires only user_id (no plan field)
    u = uid()
    requests.post(f"{BASE}/subscription/activate", json={"user_id": u, "plan": "monthly"})
    r = requests.post(f"{BASE}/subscription/cancel", json={"user_id": u})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["tier"] == "free" and d["plan"] is None and d["expires_at"] is None
    # verify GET reflects state
    g = requests.get(f"{BASE}/subscription/{u}").json()
    assert g["tier"] == "free" and g["plan"] is None

def test_cancel_extra_field_rejected_or_ignored():
    # Old payload with 'plan' should still 200 (Pydantic ignores extra) OR 422.
    # Either is acceptable; we just want to assert behavior is deterministic.
    u = uid()
    requests.post(f"{BASE}/subscription/activate", json={"user_id": u, "plan": "monthly"})
    r = requests.post(f"{BASE}/subscription/cancel", json={"user_id": u, "plan": "monthly"})
    assert r.status_code in (200, 422), r.text

def test_sessions_listing_fields():
    # Ensure session list rows have all fields needed by /history UI
    u = uid()
    payload = {"user_id": u, "mode": "Driving", "duration_seconds": 120, "avg_speed": 40, "max_speed": 70, "avg_volume": 65, "started_at": datetime.now(timezone.utc).isoformat()}
    cr = requests.post(f"{BASE}/sessions", json=payload)
    assert cr.status_code == 200
    g = requests.get(f"{BASE}/sessions/{u}")
    assert g.status_code == 200
    rows = g.json()
    assert len(rows) == 1
    row = rows[0]
    for k in ["id", "user_id", "mode", "duration_seconds", "avg_speed", "max_speed", "avg_volume", "started_at", "ended_at"]:
        assert k in row, f"missing {k}"
    assert "_id" not in row

def test_sessions():
    u = uid()
    payload = {"user_id": u, "mode": "Cycling", "duration_seconds": 60, "avg_speed": 20, "max_speed": 35, "avg_volume": 50, "started_at": datetime.now(timezone.utc).isoformat()}
    r = requests.post(f"{BASE}/sessions", json=payload)
    assert r.status_code == 200 and "_id" not in r.json()
    g = requests.get(f"{BASE}/sessions/{u}")
    assert g.status_code == 200 and len(g.json()) == 1
