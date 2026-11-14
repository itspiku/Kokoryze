"""Endpoints used by the patient app."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import checkin_ai, store
from .detection import analyse_signal, current_state, week_vs_normal
from .interventions import BRAIN_ACTIVITIES, BY_ID, STATE_LABELS
from .learner import record_brain_session, record_feedback, suggest
from .safety import CRISIS_RESOURCES, check_crisis
from .signals import SHARE_GROUPS, SIGNALS

router = APIRouter(prefix="/patients", tags=["patient"])


def _get(pid: str) -> dict:
    p = store.patients().get(pid)
    if not p:
        raise HTTPException(404, "Unknown patient")
    return p


def _streak(recs: list[dict]) -> int:
    n = 0
    for r in reversed(recs):
        if r.get("mood") is None:
            break
        n += 1
    return n


@router.get("")
def list_patients():
    return [{"id": p["id"], "name": p["name"], "age": p["age"]} for p in store.patients().values()]


@router.get("/{pid}/today")
def today(pid: str, tod: str | None = None):
    p = _get(pid)
    recs = store.records(pid)
    t = recs[-1]
    state = current_state(recs)
    return {
        "patient": {"id": p["id"], "name": p["name"], "first_name": p["name"].split()[0]},
        "date": t["date"],
        "checked_in_today": t.get("mood") is not None,
        "today": {k: t.get(k) for k in ("mood", "energy", "anxiety", "reaction_ms", "notes")},
        "streak": _streak(recs),
        "week_vs_normal": week_vs_normal(recs),
        "days_since_tms": len(recs),
        **suggest(pid, store.logs(pid), state, t["date"], tod),
    }


@router.get("/{pid}/trends")
def trends(pid: str, days: int = 30):
    _get(pid)
    recs = store.records(pid)
    out = []
    for key in SIGNALS:
        a = analyse_signal(recs, key)
        bl = a["baseline"]
        out.append({
            "key": key, "label": SIGNALS[key]["label"], "unit": SIGNALS[key]["unit"],
            "changed": a["changed"],
            "baseline": None if bl["median"] is None else {
                "median": bl["median"], "low": bl["median"] - bl["spread"], "high": bl["median"] + bl["spread"]},
            "points": [{"date": r["date"], "value": r.get(key)} for r in recs[-days:]],
        })
    return {"signals": out}


class CheckIn(BaseModel):
    mood: int = Field(ge=1, le=10)
    energy: int = Field(ge=1, le=10)
    anxiety: int = Field(ge=1, le=10)
    sleep_quality: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/{pid}/checkins")
def post_checkin(pid: str, body: CheckIn):
    p = _get(pid)
    t = store.records(pid)[-1]
    t.update(mood=body.mood, energy=body.energy, anxiety=body.anxiety,
             sleep_quality=body.sleep_quality, notes=body.notes or None)
    crisis = check_crisis(body.notes)
    t["crisis"] = crisis
    return {
        "ok": True,
        "crisis": crisis,
        "clinic_notified": crisis and p["sharing"].get("safety", True),
        "resources": CRISIS_RESOURCES if crisis else None,
    }


CRISIS_REPLY = ("Thank you for telling me. You deserve support right now, and you don't have "
                "to handle this alone. I'll show you who you can reach straight away.")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    wrap_up: bool = False


@router.get("/{pid}/checkin-chat")
def checkin_chat_info(pid: str):
    p = _get(pid)
    return {"available": checkin_ai.available(), "opening": checkin_ai.opening(p["name"].split()[0])}


@router.post("/{pid}/checkin-chat")
def checkin_chat(pid: str, body: ChatRequest):
    """One chat turn. Proposes check-in values; the app asks the patient to confirm
    them and saves through the normal /checkins endpoint."""
    p = _get(pid)
    if body.messages[0].role != "user" or body.messages[-1].role != "user":
        raise HTTPException(400, "Conversation must start and end with a patient message")
    t = store.records(pid)[-1]

    def crisis_response():
        t["crisis"] = True
        t["notes"] = t.get("notes") or "Crisis wording in chat check-in."
        return {"reply": CRISIS_REPLY, "done": True, "crisis": True,
                "clinic_notified": p["sharing"].get("safety", True),
                "resources": CRISIS_RESOURCES, "proposal": None}

    # Safety first and independent of the AI: check every patient message ourselves.
    if any(check_crisis(m.content) for m in body.messages if m.role == "user"):
        return crisis_response()

    try:
        turn = checkin_ai.chat_turn([m.model_dump() for m in body.messages],
                                    p["name"].split()[0], wrap_up=body.wrap_up)
    except checkin_ai.AIUnavailable as e:
        raise HTTPException(503, {"fallback": "form", "reason": str(e)})

    if turn.crisis_concern:
        return crisis_response()
    proposal = None
    if turn.done:
        proposal = {k: getattr(turn, k) for k in ("mood", "energy", "anxiety", "sleep_quality", "notes")}
    return {"reply": turn.reply, "done": turn.done, "crisis": False, "proposal": proposal,
            "estimates": {k: getattr(turn, k) for k in ("mood", "energy", "anxiety", "sleep_quality")}}


class Reaction(BaseModel):
    median_ms: int = Field(ge=100, le=2000)
    trials: list[int] = []


@router.post("/{pid}/reaction")
def post_reaction(pid: str, body: Reaction):
    _get(pid)
    recs = store.records(pid)
    recs[-1]["reaction_ms"] = body.median_ms
    a = analyse_signal(recs, "reaction_ms")
    return {"ok": True, "usual": a["baseline"]["median"], "today": body.median_ms}


@router.get("/{pid}/suggestion")
def get_suggestion(pid: str, exclude: str = "", tod: str | None = None):
    _get(pid)
    recs = store.records(pid)
    ex = [e for e in exclude.split(",") if e]
    return suggest(pid, store.logs(pid), current_state(recs), recs[-1]["date"], tod, ex)


class Feedback(BaseModel):
    intervention_id: str
    answer: Literal["yes", "a_bit", "no"]
    state: str | None = None
    mood_before: int | None = Field(default=None, ge=1, le=10)
    mood_after: int | None = Field(default=None, ge=1, le=10)


@router.post("/{pid}/feedback")
def post_feedback(pid: str, body: Feedback, tod: str | None = None):
    _get(pid)
    recs = store.records(pid)
    state = body.state or current_state(recs)
    try:
        entry = record_feedback(store.logs(pid), body.intervention_id, state, body.answer,
                                body.mood_before, body.mood_after, recs[-1]["date"])
    except KeyError:
        raise HTTPException(400, "Unknown activity")
    if body.mood_after is not None:
        recs[-1]["mood"] = body.mood_after
    return {"logged": entry, **suggest(pid, store.logs(pid), state, recs[-1]["date"], tod)}


@router.get("/brain-activities")
def brain_activities():
    return [{k: BY_ID[i][k] for k in ("id", "title", "category", "duration_min", "instructions")}
            for i in BRAIN_ACTIVITIES]


class BrainSession(BaseModel):
    intervention_id: str
    relax_before: float = Field(ge=0, le=100)
    relax_during: float = Field(ge=0, le=100)
    alpha_change_pct: float | None = None
    quality_pct: float | None = Field(default=None, ge=0, le=100)


@router.post("/{pid}/brain-session")
def post_brain_session(pid: str, body: BrainSession, tod: str | None = None):
    """Close the loop: a brain session's relaxation change becomes learner evidence."""
    _get(pid)
    if body.intervention_id not in BRAIN_ACTIVITIES:
        raise HTTPException(400, "This activity can't be paired with a brain session")
    recs = store.records(pid)
    state = current_state(recs)
    entry = record_brain_session(store.logs(pid), body.intervention_id, state,
                                 body.relax_before, body.relax_during, recs[-1]["date"])
    entry.update(alpha_change_pct=body.alpha_change_pct, quality_pct=body.quality_pct)
    iv = BY_ID[body.intervention_id]
    verdict = {1.0: "relaxed clearly", 0.5: "relaxed a little", 0.0: "didn't relax much"}[entry["helped"]]
    sessions = [l for l in store.logs(pid) if l["intervention_id"] == iv["id"] and l.get("source") == "eeg"]
    when = [STATE_LABELS[s] for s in iv["good_for"] if s != "steady"]
    when_text = ", ".join(when[:-1]) + (" or " if len(when) > 1 else "") + when[-1] if when else "steady"
    return {
        "logged": entry,
        "message": f"Your brain {verdict} during {iv['title'].lower()}.",
        "evidence": {
            "activity": iv["title"],
            "brain_sessions": len(sessions),
            "brain_relaxed": sum(1 for l in sessions if l["helped"] >= 1),
            "used_when": f"Next time you feel {when_text}, Kokoryze will weigh this in.",
        },
        **suggest(pid, store.logs(pid), state, recs[-1]["date"], tod),
    }


@router.get("/{pid}/sharing")
def get_sharing(pid: str):
    p = _get(pid)
    return {"sharing": p["sharing"], "labels": SHARE_GROUPS}


@router.put("/{pid}/sharing")
def put_sharing(pid: str, body: dict[str, bool]):
    p = _get(pid)
    for k, v in body.items():
        if k in SHARE_GROUPS:
            p["sharing"][k] = bool(v)
    return {"sharing": p["sharing"], "labels": SHARE_GROUPS}


@router.delete("/{pid}/data")
def delete_data(pid: str):
    _get(pid)
    for r in store.records(pid):
        for k in list(r):
            if k not in ("date", "day"):
                r[k] = False if k == "crisis" else None
    store.logs(pid).clear()
    return {"ok": True, "deleted_at": dt.datetime.now().isoformat(timespec="seconds")}
