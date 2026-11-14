"""In-memory demo store. Re-seeded from synthetic data on start and on /demo/reset.

Good enough for a hackathon demo: deterministic, zero setup, resettable.
"""

from __future__ import annotations

from .synthetic import generate

STATE: dict = {}


def reset() -> None:
    STATE.clear()
    STATE.update(generate())


def patients() -> dict:
    return STATE["patients"]


def records(pid: str) -> list[dict]:
    return STATE["records"][pid]


def logs(pid: str) -> list[dict]:
    return STATE["logs"][pid]


reset()
