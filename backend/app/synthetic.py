"""Deterministic synthetic data for 6 demo personas. No real patient data is used.

Day 0 is the first day at home after the TMS course ended; days 0-13 form each
person's baseline. The last day (index DAYS-1) is "today".
"""

from __future__ import annotations

import datetime as dt
import random

from .interventions import INTERVENTIONS
from .safety import check_crisis

DAYS = 45
SEED = 20261114

PERSONAS: list[dict] = [
    {
        "id": "anna", "name": "Anna K.", "age": 34,
        "base": {"sleep_hours": 7.4, "hrv_rmssd": 52, "resting_hr": 62, "steps": 8200,
                 "reaction_ms": 285, "mood": 7, "energy": 7, "anxiety": 3},
        "affinity": {"box_breathing": 0.8, "forest_sounds": 0.7, "walk_outside": 0.6},
        "states": ["steady", "steady", "anxious", "poor_sleep"],
    },
    {
        "id": "ben", "name": "Ben M.", "age": 52,
        "base": {"sleep_hours": 7.3, "hrv_rmssd": 44, "resting_hr": 64, "steps": 8000,
                 "reaction_ms": 310, "mood": 7, "energy": 7, "anxiety": 3},
        "affinity": {"walk_outside": 0.9, "small_task": 0.6, "call_friend": 0.55,
                     "box_breathing": 0.2, "body_scan": 0.25, "stretch": 0.4},
        "states": ["low_energy", "low_energy", "low_energy", "steady", "low_mood"],
    },
    {
        "id": "chloe", "name": "Chloe R.", "age": 27,
        "base": {"sleep_hours": 7.0, "hrv_rmssd": 61, "resting_hr": 58, "steps": 9500,
                 "reaction_ms": 270, "mood": 6, "energy": 6, "anxiety": 4},
        "affinity": {"message_friend": 0.8, "stretch": 0.6},
        "states": ["anxious", "steady", "low_mood"],
    },
    {
        "id": "david", "name": "David L.", "age": 41,
        "base": {"sleep_hours": 7.1, "hrv_rmssd": 48, "resting_hr": 63, "steps": 7400,
                 "reaction_ms": 295, "mood": 7, "energy": 6, "anxiety": 3},
        "affinity": {"box_breathing": 0.75, "body_scan": 0.7, "walk_outside": 0.5},
        "states": ["anxious", "poor_sleep", "steady"],
    },
    {
        "id": "eva", "name": "Eva S.", "age": 63,
        "base": {"sleep_hours": 7.6, "hrv_rmssd": 33, "resting_hr": 66, "steps": 6100,
                 "reaction_ms": 340, "mood": 7, "energy": 6, "anxiety": 3},
        "affinity": {"call_friend": 0.85, "morning_light": 0.6, "forest_sounds": 0.5},
        "states": ["low_mood", "steady", "low_energy"],
    },
    {
        "id": "farid", "name": "Farid H.", "age": 45,
        "base": {"sleep_hours": 6.9, "hrv_rmssd": 40, "resting_hr": 67, "steps": 6800,
                 "reaction_ms": 305, "mood": 6, "energy": 6, "anxiety": 4},
        "affinity": {"message_friend": 0.6, "walk_outside": 0.55},
        "states": ["low_mood", "anxious", "steady"],
    },
]

NOISE = {"sleep_hours": 0.35, "hrv_rmssd": 0.07, "resting_hr": 1.8, "steps": 0.12,
         "reaction_ms": 14, "mood": 0.6, "energy": 0.7, "anxiety": 0.6}
# hrv and steps noise are relative (fraction of the person's mean)

BENIGN_NOTES = ["Nice walk with the dog.", "Busy day at work.", "Slept okay.",
                "Saw a friend for coffee.", "A bit tired but fine.", "Rainy day, stayed in."]


def _ramp(day: int, start: int, length: int = 5) -> float:
    return 0.0 if day < start else min(1.0, (day - start + 1) / length)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _story(pid: str, day: int, rec: dict) -> dict:
    """Apply each persona's storyline on top of normal daily variation."""
    if pid == "ben":
        r = _ramp(day, 28)
        rec["sleep_hours"] -= 1.3 * r
        rec["steps"] *= 1 - 0.42 * r
        rec["hrv_rmssd"] *= 1 - 0.2 * r
        rec["resting_hr"] += 4 * r
        rec["reaction_ms"] += 30 * r
        rec["mood"] -= 3 * r
        rec["energy"] -= 3.5 * r
        rec["anxiety"] += 1.5 * r
        if day >= 33 and day % 3 == 0:
            rec["notes"] = "Hard to get going in the mornings."
    elif pid == "david" and 33 <= day <= 36:
        rec["sleep_hours"] -= 1.6
        rec["hrv_rmssd"] *= 0.72
        rec["resting_hr"] += 6
        rec["anxiety"] += 2.5
        rec["energy"] -= 1
        rec["notes"] = "Big deadline at work this week."
    elif pid == "eva" and day >= DAYS - 5:
        rec["mood"] = [5, 4, 4, 3, 3][day - (DAYS - 5)]
        rec["energy"] -= 1
        if day == DAYS - 1:
            rec["notes"] = "Feeling flat. Not sure why."
    elif pid == "farid" and day == DAYS - 1:
        rec["mood"] = 2
        rec["energy"] = 3
        rec["notes"] = "Really hard week. Sometimes I feel everyone would be better off without me."
    return rec


def generate(today: dt.date | None = None) -> dict:
    """Return {"patients": {...}, "records": {...}, "logs": {...}}."""
    rng = random.Random(SEED)
    today = today or dt.date.today()
    start = today - dt.timedelta(days=DAYS - 1)

    patients, records, logs = {}, {}, {}
    for p in PERSONAS:
        pid, base = p["id"], p["base"]
        recs = []
        for day in range(DAYS):
            date = start + dt.timedelta(days=day)
            weekend = date.weekday() >= 5
            rec: dict = {
                "date": date.isoformat(), "day": day,
                "sleep_hours": base["sleep_hours"] + (0.5 if weekend else 0) + rng.gauss(0, NOISE["sleep_hours"]),
                "hrv_rmssd": base["hrv_rmssd"] * (1 + rng.gauss(0, NOISE["hrv_rmssd"])),
                "resting_hr": base["resting_hr"] + rng.gauss(0, NOISE["resting_hr"]),
                "steps": base["steps"] * (1.15 if weekend else 1) * (1 + rng.gauss(0, NOISE["steps"])),
                "reaction_ms": base["reaction_ms"] + rng.gauss(0, NOISE["reaction_ms"]),
                "mood": base["mood"] + rng.gauss(0, NOISE["mood"]),
                "energy": base["energy"] + rng.gauss(0, NOISE["energy"]),
                "anxiety": base["anxiety"] + rng.gauss(0, NOISE["anxiety"]),
                "notes": rng.choice(BENIGN_NOTES) if rng.random() < 0.15 else None,
                "crisis": False,
            }
            rec = _story(pid, day, rec)

            # rounding / realistic ranges
            rec["sleep_hours"] = round(_clamp(rec["sleep_hours"], 3, 11), 2)
            rec["hrv_rmssd"] = round(_clamp(rec["hrv_rmssd"], 10, 120), 1)
            rec["resting_hr"] = round(_clamp(rec["resting_hr"], 40, 110))
            rec["steps"] = int(_clamp(rec["steps"], 300, 30000))
            rec["reaction_ms"] = round(_clamp(rec["reaction_ms"], 180, 700))
            for k in ("mood", "energy", "anxiety"):
                rec[k] = int(round(_clamp(rec[k], 1, 10)))

            # realistic gaps: game played ~75% of days, check-in ~92%, sensors ~96%
            if rng.random() > 0.75:
                rec["reaction_ms"] = None
            if rng.random() > 0.92 and day < DAYS - 1:
                rec["mood"] = rec["energy"] = rec["anxiety"] = None
                rec["notes"] = None
            if rng.random() > 0.96:
                for k in ("sleep_hours", "hrv_rmssd", "resting_hr", "steps"):
                    rec[k] = None
            if pid == "chloe" and day >= DAYS - 6:
                for k in ("sleep_hours", "hrv_rmssd", "resting_hr", "steps",
                          "reaction_ms", "mood", "energy", "anxiety", "notes"):
                    rec[k] = None

            rec["crisis"] = check_crisis(rec["notes"])
            recs.append(rec)

        records[pid] = recs
        patients[pid] = {
            "id": pid, "name": p["name"], "age": p["age"],
            "tms_end_date": start.isoformat(),
            "sharing": {g: True for g in
                        ("sleep", "activity", "heart", "cognitive", "mood", "notes", "safety")},
            "reviews": [],
        }

        # past "did this help?" answers so the learner has history
        plogs = []
        for day in range(14, DAYS - 1):
            if rng.random() > 0.65:
                continue
            state = rng.choice(p["states"])
            options = [i for i in INTERVENTIONS if state in i["good_for"]]
            iv = rng.choice(options)
            prob = p["affinity"].get(iv["id"], 0.5)
            u = rng.random()
            helped = 1.0 if u < prob else (0.5 if u < prob + 0.12 else 0.0)
            plogs.append({"date": (start + dt.timedelta(days=day)).isoformat(),
                          "intervention_id": iv["id"], "state": state, "helped": helped})
        logs[pid] = plogs

    return {"patients": patients, "records": records, "logs": logs}
