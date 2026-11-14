"""Endpoints used by the clinician dashboard. Respects each patient's sharing settings."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import store
from .detection import STATUS_ORDER, assess
from .interventions import BY_ID
from .signals import SIGNALS

router = APIRouter(prefix="/clinic", tags=["clinic"])


def _today() -> str:
    return dt.date.today().isoformat()


def _summary(p: dict) -> dict:
    recs = store.records(p["id"])
    a = assess(recs, p["sharing"])
    last_review = p["reviews"][-1] if p["reviews"] else None
    return {
        "id": p["id"], "name": p["name"], "age": p["age"],
        "weeks_since_tms": len(recs) // 7,
        "status": a["status"], "status_label": a["status_label"],
        "reasons": a["reasons"],
        "changed_count": len(a["changed_signals"]),
        "signals_tracked": a["signals_tracked"],
        "changing_since": a["changing_since"],
        # 21-day mood trend for a small sparkline (only if the patient shares check-ins)
        "mood_trend": ([r.get("mood") for r in recs[-21:]] if p["sharing"].get("mood", True) else None),
        "mood_usual": (a["analyses"]["mood"]["baseline"]["median"] if "mood" in a["analyses"] else None),
        "last_data_date": a["last_data_date"],
        "last_review": last_review,
        "reviewed_today": bool(last_review and last_review["date"] == _today()),
    }


@router.get("/overview")
def overview():
    rows = [_summary(p) for p in store.patients().values()]
    rows.sort(key=lambda r: (STATUS_ORDER.index(r["status"]), -r["changed_count"], r["name"]))
    counts = {s: sum(1 for r in rows if r["status"] == s) for s in STATUS_ORDER}
    return {"date": _today(), "counts": counts, "patients": rows}


@router.get("/patients/{pid}")
def detail(pid: str, days: int = 45):
    p = store.patients().get(pid)
    if not p:
        raise HTTPException(404, "Unknown patient")
    recs = store.records(pid)
    sh = p["sharing"]
    a = assess(recs, sh)

    series = []
    for key, meta in SIGNALS.items():
        if not sh.get(meta["share_group"], True):
            continue
        an = a["analyses"][key]
        bl = an["baseline"]
        series.append({
            "key": key, "label": meta["label"], "unit": meta["unit"], "changed": an["changed"],
            "onset": an["onset"],
            "baseline": None if bl["median"] is None else {
                "median": bl["median"], "low": bl["median"] - bl["spread"], "high": bl["median"] + bl["spread"]},
            "points": [{"date": r["date"], "value": r.get(key),
                        "unusual": (an["z"][i] or 0) >= 1.5}
                       for i, r in list(enumerate(recs))[-days:]],
        })

    notes = []
    if sh.get("notes", True):
        notes = [{"date": r["date"], "text": r["notes"], "crisis": r.get("crisis", False)}
                 for r in reversed(recs) if r.get("notes")][:10]

    brain = [{"date": l["date"], "title": BY_ID[l["intervention_id"]]["title"],
              "relax_before": l["relax_before"], "relax_during": l["relax_during"],
              "helped": l["helped"]}
             for l in reversed(store.logs(pid)) if l.get("source") == "eeg"]

    history: dict[str, dict] = {}
    for l in store.logs(pid):
        if l.get("source", "self") != "self":
            continue
        h = history.setdefault(l["intervention_id"], {"id": l["intervention_id"],
                                                      "title": BY_ID[l["intervention_id"]]["title"],
                                                      "tried": 0, "helped": 0})
        h["tried"] += 1
        h["helped"] += 1 if l["helped"] >= 1 else 0
    hist = sorted(history.values(), key=lambda h: (-h["helped"] / max(h["tried"], 1), -h["tried"]))

    hidden = [g for g, v in sh.items() if not v]
    return {
        **_summary(p),
        "series": series,
        "notes": notes,
        "interventions": hist,
        "brain_sessions": brain,
        "reviews": list(reversed(p["reviews"])),
        "hidden_by_patient": hidden,
    }


class Review(BaseModel):
    action: Literal["reviewed", "call_scheduled", "message_sent"]
    note: str | None = Field(default=None, max_length=2000)


@router.post("/patients/{pid}/review")
def review(pid: str, body: Review):
    p = store.patients().get(pid)
    if not p:
        raise HTTPException(404, "Unknown patient")
    entry = {"date": _today(), "time": dt.datetime.now().strftime("%H:%M"),
             "action": body.action, "note": body.note}
    p["reviews"].append(entry)
    return {"ok": True, "review": entry}
