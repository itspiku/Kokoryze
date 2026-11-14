"""Learns which activities help each person, using Thompson sampling.

For every (person, activity, state) we keep a Beta(alpha, beta) belief about
"how likely is this to help". Answers to "Did this help?" update it.
Answers from other states count a little (30%) so new states start sensibly.
"""

from __future__ import annotations

import datetime as dt
import random

from .interventions import BY_ID, INTERVENTIONS, STATE_LABELS

OTHER_STATE_WEIGHT = 0.3


def time_of_day(now: dt.datetime | None = None) -> str:
    h = (now or dt.datetime.now()).hour
    return "morning" if h < 12 else ("afternoon" if h < 18 else "evening")


def _counts(logs: list[dict], iid: str, state: str) -> tuple[float, int, float, int]:
    same = [l["helped"] for l in logs if l["intervention_id"] == iid and l["state"] == state]
    other = [l["helped"] for l in logs if l["intervention_id"] == iid and l["state"] != state]
    return sum(same), len(same), sum(other), len(other)


def _explain(iid: str, state: str, logs: list[dict]) -> str:
    s, n, so, no = _counts(logs, iid, state)
    feeling = STATE_LABELS[state]
    if n >= 2:
        helped = sum(1 for l in logs if l["intervention_id"] == iid and l["state"] == state and l["helped"] >= 1)
        if state == "steady":
            return f"This helped you {helped} of {n} times before."
        return f"Suggested because this helped you {helped} of the last {n} times you felt {feeling}."
    if no >= 2:
        helped = sum(1 for l in logs if l["intervention_id"] == iid and l["helped"] >= 1)
        return f"This helped you {helped} of {no} times in other situations. Let's see if it helps now."
    return "New for you. Your answer afterwards helps us learn what works for you."


def rank(logs: list[dict], state: str, tod: str, seed: str, exclude: list[str] | None = None) -> list[dict]:
    """Return candidate activities sorted by a Thompson sample (best first).

    The random seed is fixed per (person, day, number of answers) so suggestions
    stay stable until new feedback arrives, which keeps the demo predictable.
    """
    rng = random.Random(seed)
    exclude = exclude or []
    pool = [iv for iv in INTERVENTIONS if iv["id"] not in exclude and state in iv["good_for"]]
    # Only suggest things that make sense at this time of day (no "morning daylight" at 9 pm),
    # unless that would leave nothing to suggest.
    timely = [iv for iv in pool if tod in iv["times"]]
    pool = timely or pool
    out = []
    for iv in pool:
        s, n, so, no = _counts(logs, iv["id"], state)
        alpha = 1 + s + OTHER_STATE_WEIGHT * so
        beta = 1 + (n - s) + OTHER_STATE_WEIGHT * (no - so)
        sample = rng.betavariate(alpha, beta)
        if tod not in iv["times"]:
            sample *= 0.8
        out.append({
            **iv,
            "score": round(sample, 3),
            "expected_help": round(alpha / (alpha + beta), 2),
            "times_tried": n + no,
            "why": _explain(iv["id"], state, logs),
        })
    return sorted(out, key=lambda x: -x["score"])


def suggest(pid: str, logs: list[dict], state: str, today: str, tod: str | None = None,
            exclude: list[str] | None = None) -> dict:
    """Main pick = what we believe helps most (exploit).
    One alternative = the best Thompson sample among the rest (explore), so the
    person keeps discovering new things and the system keeps learning."""
    tod = tod or time_of_day()
    ranked = rank(logs, state, tod, seed=f"{pid}:{today}:{len(logs)}", exclude=exclude)
    if not ranked:
        return {"state": state, "state_label": STATE_LABELS[state], "time_of_day": tod,
                "suggestion": None, "alternatives": []}

    def believed(x):
        return x["expected_help"] * (1 if tod in x["times"] else 0.8)

    by_belief = sorted(ranked, key=lambda x: (-believed(x), -x["score"]))
    best = by_belief[0]
    rest = [x for x in ranked if x["id"] != best["id"]]
    alternatives = []
    if rest:
        explore = rest[0]  # ranked is already sorted by Thompson sample
        alternatives.append({**explore, "explore": explore["times_tried"] <= 2})
        nxt = next((x for x in by_belief[1:] if x["id"] != explore["id"]), None)
        if nxt:
            alternatives.append(nxt)
    return {
        "state": state,
        "state_label": STATE_LABELS[state],
        "time_of_day": tod,
        "suggestion": best,
        "alternatives": alternatives,
    }


def record_feedback(logs: list[dict], iid: str, state: str, answer: str,
                    mood_before: int | None, mood_after: int | None, date: str) -> dict:
    if iid not in BY_ID:
        raise KeyError(iid)
    helped = {"yes": 1.0, "a_bit": 0.5, "no": 0.0}[answer]
    if mood_before is not None and mood_after is not None and mood_after - mood_before >= 1:
        helped = max(helped, 1.0)
    entry = {"date": date, "intervention_id": iid, "state": state, "helped": helped,
             "mood_before": mood_before, "mood_after": mood_after}
    logs.append(entry)
    return entry
