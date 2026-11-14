"""Each demo persona must get its expected status. Run these after any threshold change."""

import pytest

from app import store
from app.detection import assess


@pytest.fixture(autouse=True)
def fresh():
    store.reset()


EXPECTED = {
    "anna": "stable",     # normal variation only -> no false alarm
    "ben": "review",      # gradual multi-signal decline
    "chloe": "missing",   # no data for 6 days
    "david": "stable",    # short stress blip that recovered
    "eva": "review",      # mood alone drops sharply
    "farid": "urgent",    # crisis wording in today's check-in
}


@pytest.mark.parametrize("pid,expected", EXPECTED.items())
def test_persona_status(pid, expected):
    p = store.patients()[pid]
    assert assess(store.records(pid), p["sharing"])["status"] == expected


def test_ben_reasons_mention_sleep_and_steps():
    reasons = " ".join(assess(store.records("ben"))["reasons"])
    assert "Sleep" in reasons and "steps" in reasons


def test_david_blip_would_have_been_caught_while_it_lasted():
    # While David's stressful week was happening, his sensors did look different;
    # it just isn't sustained any more, which is why he is stable today.
    recs = store.records("david")[:37]
    assert len(assess(recs)["changed_signals"]) >= 2


def test_sharing_off_hides_mood_from_status():
    p = store.patients()["eva"]
    p["sharing"]["mood"] = False
    assert assess(store.records("eva"), p["sharing"])["status"] == "stable"


def test_safety_toggle_respected():
    p = store.patients()["farid"]
    p["sharing"]["safety"] = False
    assert assess(store.records("farid"), p["sharing"])["status"] != "urgent"
