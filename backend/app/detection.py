"""Personal baselines, sustained-change detection and status rules.

Everything here is transparent on purpose: each status comes with the plain
reasons that produced it. Nothing here is a diagnosis.
"""

from __future__ import annotations

import statistics

from .signals import BASELINE_DAYS, SELF_SIGNALS, SENSOR_SIGNALS, SIGNALS

Z_HIGH = 1.5          # a day counts as "unusual" at this robust z-score
DAYS_NEEDED = 4       # ...on at least this many of the last 7 days
Z7_NEEDED = 1.0       # ...and the 7-day average z must be at least this
MOOD_ALONE_Z7 = 1.5   # mood alone triggers review at this 7-day average
WINDOW = 7

STATUS_ORDER = ["urgent", "review", "missing", "watch", "stable"]
STATUS_LABELS = {
    "urgent": "Urgent: contact today",
    "review": "Review suggested",
    "missing": "Missing data: check in",
    "watch": "Keep an eye",
    "stable": "Stable",
}


def _values(recs: list[dict], key: str) -> list[float]:
    return [r[key] for r in recs if r.get(key) is not None]


def baseline(recs: list[dict], key: str) -> dict:
    vals = _values(recs[:BASELINE_DAYS], key)
    if len(vals) < 5:
        return {"median": None, "spread": None}
    med = statistics.median(vals)
    mad = statistics.median([abs(v - med) for v in vals]) * 1.4826
    return {"median": med, "spread": max(mad, SIGNALS[key]["mad_floor"])}


def z_series(recs: list[dict], key: str, bl: dict) -> list[float | None]:
    """Robust z-scores, flipped so that positive always means 'more concerning'."""
    if bl["median"] is None:
        return [None] * len(recs)
    d = SIGNALS[key]["direction"]
    return [None if r.get(key) is None else d * (r[key] - bl["median"]) / bl["spread"] for r in recs]


def analyse_signal(recs: list[dict], key: str) -> dict:
    bl = baseline(recs, key)
    zs = z_series(recs, key, bl)
    last = [z for z in zs[-WINDOW:] if z is not None]
    last_vals = [r[key] for r in recs[-WINDOW:] if r.get(key) is not None]
    high_days = sum(1 for z in last if z >= Z_HIGH)
    z7 = sum(last) / len(last) if len(last) >= DAYS_NEEDED else None
    changed = z7 is not None and high_days >= DAYS_NEEDED and z7 >= Z7_NEEDED
    return {
        "key": key,
        "label": SIGNALS[key]["label"],
        "unit": SIGNALS[key]["unit"],
        "baseline": bl,
        "week_mean": sum(last_vals) / len(last_vals) if last_vals else None,
        "z7": z7,
        "high_days": high_days,
        "days_with_data": len(last),
        "changed": changed,
        "z": zs,
    }


def _reason(a: dict) -> str:
    key, med, wk = a["key"], a["baseline"]["median"], a["week_mean"]
    n, m = a["high_days"], a["days_with_data"]
    span = f"on {n} of the last {m} days"
    diff = wk - med
    if key == "sleep_hours":
        return f"Sleep is {abs(diff):.1f} h {'below' if diff < 0 else 'above'} usual {span}."
    if key in ("steps", "hrv_rmssd"):
        pct = abs(diff) / med * 100
        return f"{a['label']} {pct:.0f}% {'lower' if diff < 0 else 'higher'} than usual {span}."
    if key == "resting_hr":
        return f"Resting heart rate {abs(diff):.0f} bpm {'higher' if diff > 0 else 'lower'} than usual {span}."
    if key == "reaction_ms":
        return f"Reaction time {abs(diff):.0f} ms {'slower' if diff > 0 else 'faster'} than usual {span}."
    return f"Self-reported {a['label'].lower()} averaged {wk:.1f} this week (usual: {med:.0f})."


def _days_with_any_data(recs: list[dict]) -> int:
    keys = SENSOR_SIGNALS + SELF_SIGNALS
    return sum(1 for r in recs[-WINDOW:] if any(r.get(k) is not None for k in keys))


def _last_data_date(recs: list[dict]) -> str | None:
    keys = SENSOR_SIGNALS + SELF_SIGNALS
    for r in reversed(recs):
        if any(r.get(k) is not None for k in keys):
            return r["date"]
    return None


def assess(recs: list[dict], sharing: dict | None = None) -> dict:
    """Status + reasons for one patient. `sharing` limits which signals are used."""
    sharing = sharing or {}
    allowed = [k for k in SIGNALS if sharing.get(SIGNALS[k]["share_group"], True)]
    analyses = {k: analyse_signal(recs, k) for k in allowed}
    changed = [k for k, a in analyses.items() if a["changed"]]
    sensor_changed = [k for k in changed if SIGNALS[k]["kind"] == "sensor"]
    self_changed = [k for k in changed if SIGNALS[k]["kind"] == "self"]
    # Order reasons: strongest sensor change, strongest self-report change, then the rest,
    # so the top two reasons show both what the body and what the person are saying.
    by_strength = sorted(changed, key=lambda k: -(analyses[k]["z7"] or 0))
    lead = [next((k for k in by_strength if SIGNALS[k]["kind"] == kind), None) for kind in ("sensor", "self")]
    lead = [k for k in lead if k]
    reasons_changed = [_reason(analyses[k]) for k in lead + [k for k in by_strength if k not in lead]]

    crisis = sharing.get("safety", True) and any(r.get("crisis") for r in recs[-2:])
    data_days = _days_with_any_data(recs)
    last_date = _last_data_date(recs)

    if crisis:
        status = "urgent"
        reasons = ["A recent check-in contained wording that may indicate a crisis. "
                   "Help resources were shown to the patient."] + reasons_changed
    elif data_days < 3:
        status = "missing"
        missing_for = sum(1 for _ in _trailing_empty(recs))
        reasons = [f"No check-ins or sensor data for {missing_for} days (last data: {last_date or 'never'})."]
    elif len(sensor_changed) >= 2 and ({"mood", "energy"} & set(self_changed)):
        status, reasons = "review", reasons_changed
    elif "mood" in analyses and analyses["mood"]["changed"] and (analyses["mood"]["z7"] or 0) >= MOOD_ALONE_Z7:
        status, reasons = "review", reasons_changed
    elif len(sensor_changed) >= 3:
        status, reasons = "watch", reasons_changed
    else:
        status = "stable"
        reasons = reasons_changed or ["All indicators are within this person's usual range."]
        recovered = _recent_recovery(recs, allowed)
        if recovered:
            reasons.append(recovered)

    return {
        "status": status,
        "status_label": STATUS_LABELS[status],
        "reasons": reasons,
        "changed_signals": changed,
        "signals_tracked": len(allowed),
        "days_with_data_last7": data_days,
        "last_data_date": last_date,
        "analyses": analyses,
    }


def _recent_recovery(recs: list[dict], allowed: list[str]) -> str | None:
    """If several signals were changed in the past week but are fine now, say so.
    This shows the clinician that short, recovered blips are seen but not escalated."""
    for offset in range(1, WINDOW + 1):
        past = recs[:-offset]
        labels = [SIGNALS[k]["label"].lower() for k in allowed if analyse_signal(past, k)["changed"]]
        if len(labels) >= 2:
            listed = ", ".join(labels[:-1]) + " and " + labels[-1]
            return (f"A short-term change in {listed} about {offset + WINDOW // 2} days ago "
                    "has returned to the usual range. No action needed.")
    return None


def _trailing_empty(recs: list[dict]):
    keys = SENSOR_SIGNALS + SELF_SIGNALS
    for r in reversed(recs):
        if any(r.get(k) is not None for k in keys):
            return
        yield r


def week_vs_normal(recs: list[dict]) -> list[dict]:
    """Gentle patient-facing comparison for the home screen."""
    out = []
    for key in ("sleep_hours", "steps", "mood"):
        a = analyse_signal(recs, key)
        med, wk = a["baseline"]["median"], a["week_mean"]
        if med is None or wk is None:
            continue
        ratio = wk / med if med else 1
        if a["changed"]:
            tone = "lower" if (wk < med) else "higher"
        else:
            tone = "usual"
        out.append({"key": key, "label": SIGNALS[key]["label"], "unit": SIGNALS[key]["unit"],
                    "week": round(wk, 1), "usual": round(med, 1), "ratio": round(ratio, 2),
                    "tone": tone})
    return out


def current_state(recs: list[dict]) -> str:
    """The person's main state today, used to pick a suitable activity."""
    today = recs[-1]
    if today.get("anxiety") is not None and today["anxiety"] >= 6:
        return "anxious"
    if today.get("energy") is not None and today["energy"] <= 4:
        return "low_energy"
    sleep = analyse_signal(recs, "sleep_hours")
    if sleep["z"][-1] is not None and sleep["z"][-1] >= Z_HIGH:
        return "poor_sleep"
    if today.get("mood") is not None and today["mood"] <= 4:
        return "low_mood"
    return "steady"
