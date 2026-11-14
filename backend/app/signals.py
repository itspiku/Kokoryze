"""Definitions of every signal we track per day.

direction: +1 means "higher is concerning", -1 means "lower is concerning".
share_group: which privacy toggle controls whether a clinician can see it.
kind: "sensor" (wearable/phone/game) or "self" (self-reported check-in).
mad_floor: minimum spread used for z-scores so tiny baselines don't explode.
"""

SIGNALS: dict[str, dict] = {
    "sleep_hours": {
        "label": "Sleep", "unit": "h", "direction": -1, "share_group": "sleep",
        "kind": "sensor", "mad_floor": 0.25, "decimals": 1,
    },
    "hrv_rmssd": {
        "label": "Heart rate variability", "unit": "ms", "direction": -1, "share_group": "heart",
        "kind": "sensor", "mad_floor": 3.0, "decimals": 0,
    },
    "resting_hr": {
        "label": "Resting heart rate", "unit": "bpm", "direction": 1, "share_group": "heart",
        "kind": "sensor", "mad_floor": 2.0, "decimals": 0,
    },
    "steps": {
        "label": "Daily steps", "unit": "steps", "direction": -1, "share_group": "activity",
        "kind": "sensor", "mad_floor": 500.0, "decimals": 0,
    },
    "reaction_ms": {
        "label": "Reaction time", "unit": "ms", "direction": 1, "share_group": "cognitive",
        "kind": "sensor", "mad_floor": 15.0, "decimals": 0,
    },
    "mood": {
        "label": "Mood", "unit": "/10", "direction": -1, "share_group": "mood",
        "kind": "self", "mad_floor": 0.75, "decimals": 1,
    },
    "energy": {
        "label": "Energy", "unit": "/10", "direction": -1, "share_group": "mood",
        "kind": "self", "mad_floor": 0.75, "decimals": 1,
    },
    "anxiety": {
        "label": "Anxiety", "unit": "/10", "direction": 1, "share_group": "mood",
        "kind": "self", "mad_floor": 0.75, "decimals": 1,
    },
}

SENSOR_SIGNALS = [k for k, v in SIGNALS.items() if v["kind"] == "sensor"]
SELF_SIGNALS = [k for k, v in SIGNALS.items() if v["kind"] == "self"]

SHARE_GROUPS = {
    "sleep": "Sleep",
    "activity": "Activity (steps)",
    "heart": "Heart (HRV, resting heart rate)",
    "cognitive": "Reaction-time game",
    "mood": "Check-in answers (mood, energy, anxiety)",
    "notes": "Check-in notes (free text)",
    "safety": "Safety alerts (if I may be in crisis)",
}

BASELINE_DAYS = 14
