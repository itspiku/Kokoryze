"""AI chat check-in tests. Claude is replaced by a fake client, so these run offline
and cost nothing; they check our handling of what the API returns."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import checkin_ai, store
from app.main import app

client = TestClient(app)


class FakeClaude:
    def __init__(self, payload=None, stop_reason="end_turn"):
        self.payload, self.stop_reason, self.calls = payload, stop_reason, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        text = json.dumps(self.payload) if self.payload is not None else ""
        return SimpleNamespace(stop_reason=self.stop_reason,
                               content=[SimpleNamespace(type="text", text=text)])


def turn(**over):
    base = {"reply": "That sounds like a lot. How has your energy been?", "done": False,
            "crisis_concern": False, "mood": 5, "energy": None, "anxiety": None,
            "sleep_quality": None, "notes": None}
    return {**base, **over}


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    store.reset()
    monkeypatch.setattr(checkin_ai, "available", lambda: True)


def use(monkeypatch, fake):
    monkeypatch.setattr(checkin_ai, "_get_client", lambda: fake)
    return fake


def chat(*user_msgs, wrap_up=False):
    msgs = []
    for i, m in enumerate(user_msgs):
        if i:
            msgs.append({"role": "assistant", "content": "ok"})
        msgs.append({"role": "user", "content": m})
    return client.post("/patients/ben/checkin-chat", json={"messages": msgs, "wrap_up": wrap_up})


def test_unavailable_falls_back_to_form(monkeypatch):
    monkeypatch.setattr(checkin_ai, "available", lambda: False)
    assert client.get("/patients/ben/checkin-chat").json()["available"] is False
    r = chat("Pretty tired today")
    assert r.status_code == 503 and r.json()["detail"]["fallback"] == "form"


def test_normal_turn_returns_reply_and_estimates(monkeypatch):
    fake = use(monkeypatch, FakeClaude(turn()))
    r = chat("Pretty tired today").json()
    assert r["reply"].startswith("That sounds") and r["done"] is False and r["proposal"] is None
    sent = fake.calls[0]
    assert sent["model"] == checkin_ai.MODEL
    assert sent["output_config"]["format"]["type"] == "json_schema"
    assert "Ben" in sent["system"]


def test_done_turn_proposes_values_and_clamps_them(monkeypatch):
    use(monkeypatch, FakeClaude(turn(done=True, mood=14, energy=0, anxiety=4, sleep_quality=9,
                                     notes="Tired, slept badly.")))
    p = chat("Tired", "Slept badly").json()["proposal"]
    assert p == {"mood": 10, "energy": 1, "anxiety": 4, "sleep_quality": 5, "notes": "Tired, slept badly."}


def test_crisis_wording_never_reaches_the_ai(monkeypatch):
    fake = use(monkeypatch, FakeClaude(turn()))
    r = chat("I just want to die").json()
    assert r["crisis"] and r["resources"] and not fake.calls
    assert client.get("/clinic/patients/ben").json()["status"] == "urgent"


def test_model_crisis_flag_is_respected(monkeypatch):
    use(monkeypatch, FakeClaude(turn(crisis_concern=True)))
    r = chat("Everything feels pointless and heavy").json()
    assert r["crisis"] and r["done"]


def test_wrap_up_adds_operator_instruction(monkeypatch):
    fake = use(monkeypatch, FakeClaude(turn(done=True)))
    chat("Fine I guess", wrap_up=True)
    last = fake.calls[0]["messages"][-1]
    assert last["role"] == "system" and "Wrap up" in last["content"]


@pytest.mark.parametrize("fake", [FakeClaude(turn(), stop_reason="refusal"),
                                  FakeClaude(turn(), stop_reason="max_tokens"),
                                  FakeClaude(None)])
def test_bad_replies_fall_back_to_form(monkeypatch, fake):
    use(monkeypatch, fake)
    assert chat("Okay day").status_code == 503


def test_conversation_must_end_with_patient_message(monkeypatch):
    use(monkeypatch, FakeClaude(turn()))
    r = client.post("/patients/ben/checkin-chat", json={"messages": [
        {"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]})
    assert r.status_code == 400
