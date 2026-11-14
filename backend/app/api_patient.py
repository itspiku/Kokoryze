"""Endpoints used by the patient app."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import store
from .detection import analyse_signal, current_state, week_vs_normal
from .learner import record_feedback, suggest
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
