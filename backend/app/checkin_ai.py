"""Conversational daily check-in powered by Claude.

Design rules (see PLAN.md §9):
- The AI only talks and *proposes* check-in values. The patient confirms them in the
  app before anything is saved, and status rules never depend on the AI.
- The crisis keyword check runs on every patient message *before* the model sees it,
  so safety never depends on the model.
- No credentials, no network or any API error -> the app falls back to the form.

Enable it by setting ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN, or `ant auth login`).
Optional: KOKORYZE_AI_MODEL (default claude-opus-5-5), KOKORYZE_AI=off to disable.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from pydantic import BaseModel, ValidationError

log = logging.getLogger("kokoryze.checkin_ai")

MODEL = os.environ.get("KOKORYZE_AI_MODEL", "claude-opus-5-5")
MAX_USER_TURNS = 4  # after this many patient messages we ask the model to wrap up

SYSTEM_PROMPT = """\
You are Kokoryze, a warm companion app that helps people stay well at home after \
TMS treatment for depression. You are doing a short daily check-in in a chat.

Your job: in a relaxed, kind way, find out roughly how the person's mood, energy, \
anxiety and sleep have been today, then wrap up.

How to talk:
- Keep every message short: one or two sentences, then at most one question.
- Ask about one thing at a time, in everyday words. No lists, no clinical scales.
- Reflect back what you heard before asking the next thing.
- Never diagnose, never give medical or medication advice, never interpret their \
treatment. If they ask for that, gently suggest raising it with their care team.
- If anything they say suggests they might harm themselves or are in danger, set \
crisis_concern to true and respond with care: tell them they deserve support right \
now and that the app will show them who they can contact immediately.
- Aim to finish within three of your questions. When you have a reasonable picture, \
set done to true, thank them briefly, and give your best estimates.

Estimates (always fill them with your current best guess, or null if you truly have \
no idea yet):
- mood, energy: 1 (very low) to 10 (great)
- anxiety: 1 (calm) to 10 (very anxious)
- sleep_quality: 1 (very poor) to 5 (great)
- notes: one short neutral sentence summarising anything they shared, in their own \
words where possible, or null.

Reply ONLY with the JSON object described by the schema."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string", "description": "Your next chat message to the person."},
        "done": {"type": "boolean", "description": "True when the check-in is complete."},
        "crisis_concern": {"type": "boolean"},
        "mood": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "energy": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "anxiety": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "sleep_quality": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "notes": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "required": ["reply", "done", "crisis_concern", "mood", "energy", "anxiety", "sleep_quality", "notes"],
    "additionalProperties": False,
}


def opening(first_name: str) -> str:
    return f"Hi {first_name} 👋 How has today been for you so far?"


class ChatTurn(BaseModel):
    reply: str
    done: bool
    crisis_concern: bool
    mood: int | None = None
    energy: int | None = None
    anxiety: int | None = None
    sleep_quality: int | None = None
    notes: str | None = None

    def clamped(self) -> "ChatTurn":
        def c(v, lo, hi):
            return None if v is None else max(lo, min(hi, v))
        return self.model_copy(update={
            "mood": c(self.mood, 1, 10), "energy": c(self.energy, 1, 10),
            "anxiety": c(self.anxiety, 1, 10), "sleep_quality": c(self.sleep_quality, 1, 5),
        })


class AIUnavailable(Exception):
    """The AI check-in can't run right now; the app should show the form instead."""


_client = None


def _has_credentials() -> bool:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    # `ant auth login` profiles live here; the SDK picks them up automatically.
    return (Path.home() / ".config" / "anthropic").exists()


def available() -> bool:
    if os.environ.get("KOKORYZE_AI", "").lower() == "off":
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return _has_credentials()


def _get_client():
    global _client
    if _client is None:
        import anthropic
        # Chat needs to feel responsive: short timeout, one retry, then fall back to the form.
        _client = anthropic.Anthropic(timeout=30.0, max_retries=1)
    return _client


def chat_turn(messages: list[dict], first_name: str, wrap_up: bool = False) -> ChatTurn:
    """Run one turn. `messages` alternates user/assistant, starting with the user.
    Assistant entries hold the plain reply text we showed earlier."""
    if not available():
        raise AIUnavailable("No Anthropic credentials configured")
    import anthropic

    msgs = [{"role": m["role"], "content": m["content"]} for m in messages]
    user_turns = sum(1 for m in msgs if m["role"] == "user")
    if wrap_up or user_turns >= MAX_USER_TURNS:
        # Operator instruction mid-conversation (supported on Claude Opus 5.5).
        msgs.append({"role": "system", "content": "Wrap up now: set done to true, thank them "
                                                  "briefly and give your best estimates."})

    try:
        response = _get_client().beta.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT + f"\n\nThe person's first name is {first_name}. "
                                   f'The app opened the chat with: "{opening(first_name)}"',
            messages=msgs,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
            # If the model declines, let the API retry on a fallback model in the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except TypeError as e:  # raised by the SDK when no credentials resolve
        raise AIUnavailable(f"Credentials not resolved: {e}") from e
    except anthropic.AuthenticationError as e:
        raise AIUnavailable("Invalid Anthropic credentials") from e
    except anthropic.RateLimitError as e:
        raise AIUnavailable("Rate limited") from e
    except anthropic.APIStatusError as e:
        log.warning("Claude API error %s (request %s)", e.status_code, getattr(e, "request_id", None))
        raise AIUnavailable(f"API error {e.status_code}") from e
    except anthropic.APIConnectionError as e:
        raise AIUnavailable("Can't reach the Claude API") from e

    if response.stop_reason == "refusal":
        raise AIUnavailable("The model declined this conversation")
    if response.stop_reason == "max_tokens":
        raise AIUnavailable("Reply was cut off")

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise AIUnavailable("Empty reply")
    try:
        return ChatTurn.model_validate(json.loads(text)).clamped()
    except (json.JSONDecodeError, ValidationError) as e:
        raise AIUnavailable("Reply didn't match the expected format") from e
