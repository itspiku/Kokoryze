"""Crisis wording check. Deliberately simple and conservative: a false positive
shows someone help resources, a false negative could miss someone in danger.
This runs independently of any AI model."""

import re

CRISIS_PHRASES = [
    # English
    "kill myself", "killing myself", "suicide", "suicidal", "end my life", "end it all",
    "take my own life", "better off without me", "better off dead", "want to die",
    "don't want to live", "dont want to live", "don't want to be here anymore",
    "no reason to live", "hurt myself", "harm myself", "self-harm", "self harm",
    "can't go on", "cant go on",
    # Finnish (basic)
    "itsemurha", "tappaa itseni", "tapan itseni", "en halua elää", "haluan kuolla",
    "satuttaa itseäni", "vahingoittaa itseäni",
]

CRISIS_RESOURCES = {
    "message": "You're not alone, and you deserve support right now.",
    "contacts": [
        {"label": "Emergency (Finland & EU)", "number": "112", "note": "If you are in immediate danger"},
        {"label": "MIELI Crisis Helpline (Finland)", "number": "09 2525 0111", "note": "Talk to someone, 24/7"},
    ],
    "disclaimer": "Kokoryze is a support tool, not an emergency service.",
}


def _normalise(text: str) -> str:
    text = text.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text)


def check_crisis(text: str | None) -> bool:
    if not text:
        return False
    t = _normalise(text)
    return any(p in t for p in CRISIS_PHRASES)
