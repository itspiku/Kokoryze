"""Learns which activities help each person, using Thompson sampling.

For every (person, activity, state) we keep a Beta(alpha, beta) belief about
"how likely is this to help". Two kinds of evidence update it:

- the person's own answer to "Did this help?" (source "self", full weight), and
- a brain session's relaxation change during the activity (source "eeg", half
  weight: a brain signal is a hint about what helps, not the person's verdict).

Evidence from other states counts a little (30%) so new states start sensibly.
"""

from __future__ import annotations

import datetime as dt
import random

from .interventions import BY_ID, INTERVENTIONS, STATE_LABELS

OTHER_STATE_WEIGHT = 0.3
EEG_WEIGHT = 0.5
EEG_HELPED_DELTA = 15   # relaxation index points gained -> counts as "helped"
EEG_A_BIT_DELTA = 5     # -> counts as "helped a bit"


def time_of_day(now: dt.datetime | None = None) -> str:
    h = (now or dt.datetime.now()).hour
    return "morning" if h < 12 else ("afternoon" if h < 18 else "evening")


def _w(log: dict) -> float:
    return log.get("weight", 1.0)


def _counts(logs: list[dict], iid: str, state: str) -> tuple[float, float, float, float]:
    """Weighted (successes, trials) for this state, and for all other states."""
    same = [l for l in logs if l["intervention_id"] == iid and l["state"] == state]
    other = [l for l in logs if l["intervention_id"] == iid and l["state"] != state]
    return (sum(_w(l) * l["helped"] for l in same), sum(_w(l) for l in same),
            sum(_w(l) * l["helped"] for l in other), sum(_w(l) for l in other))


def _explain(iid: str, state: str, logs: list[dict]) -> str:
    mine = [l for l in logs if l["intervention_id"] == iid and l.get("source", "self") == "self"]
    same = [l for l in mine if l["state"] == state]
    brain = [l for l in logs if l["intervention_id"] == iid and l.get("source") == "eeg"]
    feeling = STATE_LABELS[state]

    if len(same) >= 2:
        helped = sum(1 for l in same if l["helped"] >= 1)
        text = (f"This helped you {helped} of {len(same)} times before." if state == "steady" else
                f"Suggested because this helped you {helped} of the last {len(same)} times you felt {feeling}.")
    elif len(mine) >= 2:
        helped = sum(1 for l in mine if l["helped"] >= 1)
        text = f"This helped you {helped} of {len(mine)} times in other situations. Let's see if it helps now."
    elif not brain:
        return "New for you. Your answer afterwards helps us learn what works for you."
    else:
        text = ""

    if brain:
        relaxed = sum(1 for l in brain if l["helped"] >= 1)
        sessions = "session" if len(brain) == 1 else "sessions"
        brain_text = (f"Your brain {sessions} showed you relaxing during it ({relaxed} of {len(brain)})."
                      if relaxed else f"Your brain {sessions} didn't show much relaxation during it yet.")
        text = f"{text} {brain_text}".strip()
    return text


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
        out.append({
            **iv,
            "score": round(sample, 3),
            "expected_help": round(alpha / (alpha + beta), 2),
            "times_tried": sum(1 for l in logs if l["intervention_id"] == iv["id"]),
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

    by_belief = sorted(ranked, key=lambda x: (-x["expected_help"], -x["score"]))
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
             "mood_before": mood_before, "mood_after": mood_after, "source": "self", "weight": 1.0}
    logs.append(entry)
    return entry


def eeg_helped(relax_before: float, relax_during: float) -> float:
    delta = relax_during - relax_before
    return 1.0 if delta >= EEG_HELPED_DELTA else (0.5 if delta >= EEG_A_BIT_DELTA else 0.0)


def record_brain_session(logs: list[dict], iid: str, state: str, relax_before: float,
                         relax_during: float, date: str) -> dict:
    """Turn a brain session into learner evidence for the paired activity."""
    if iid not in BY_ID:
        raise KeyError(iid)
    entry = {"date": date, "intervention_id": iid, "state": state,
             "helped": eeg_helped(relax_before, relax_during),
             "relax_before": relax_before, "relax_during": relax_during,
             "source": "eeg", "weight": EEG_WEIGHT}
    logs.append(entry)
    return entry
