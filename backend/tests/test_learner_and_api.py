from fastapi.testclient import TestClient

from app import store
from app.learner import suggest
from app.main import app
from app.safety import check_crisis

client = TestClient(app)


def setup_function():
    store.reset()


def test_negative_feedback_lowers_belief():
    logs = store.logs("ben")
    before = suggest("ben", logs, "low_energy", "2026-01-01", "afternoon")["suggestion"]
    beliefs = [before["expected_help"]]
    for _ in range(8):
        logs.append({"date": "2026-01-01", "intervention_id": before["id"],
                     "state": "low_energy", "helped": 0.0})
        s = suggest("ben", logs, "low_energy", "2026-01-01", "afternoon")
        same = [x for x in [s["suggestion"], *s["alternatives"]] if x["id"] == before["id"]]
        if same:
            beliefs.append(same[0]["expected_help"])
    assert all(b2 < b1 for b1, b2 in zip(beliefs, beliefs[1:]))  # belief drops every time
    assert s["suggestion"]["id"] != before["id"]                  # and eventually it switches


def test_crisis_phrases():
    assert check_crisis("Everyone would be better off without me")
    assert check_crisis("en halua elää enää")
    assert not check_crisis("Had a nice walk today")


def test_overview_sorted_urgent_first():
    r = client.get("/clinic/overview").json()
    assert [p["status"] for p in r["patients"]][:1] == ["urgent"]
    assert r["counts"]["review"] == 2


def test_checkin_with_crisis_wording_flags_urgent():
    r = client.post("/patients/anna/checkins",
                    json={"mood": 3, "energy": 3, "anxiety": 7, "notes": "I want to die"}).json()
    assert r["crisis"] and r["resources"]
    anna = next(p for p in client.get("/clinic/overview").json()["patients"] if p["id"] == "anna")
    assert anna["status"] == "urgent"


def test_feedback_updates_learner():
    s = client.get("/patients/ben/suggestion?tod=afternoon").json()
    iid = s["suggestion"]["id"]
    r = client.post("/patients/ben/feedback?tod=afternoon",
                    json={"intervention_id": iid, "answer": "yes"}).json()
    assert r["logged"]["helped"] == 1.0


def test_sharing_hides_series_from_clinic():
    client.put("/patients/ben/sharing", json={"sleep": False})
    keys = [s["key"] for s in client.get("/clinic/patients/ben").json()["series"]]
    assert "sleep_hours" not in keys and "steps" in keys


def test_delete_my_data():
    client.delete("/patients/ben/data")
    assert client.get("/clinic/patients/ben").json()["status"] == "missing"
