"""EEG endpoints: full session (for charts) and a WebSocket that replays it as if live."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool

from .eeg import session

router = APIRouter(prefix="/eeg", tags=["eeg"])


@router.get("/session")
async def get_session(subject: int | None = None, include_frames: bool = True):
    s = await run_in_threadpool(session, subject)
    if include_frames:
        return s
    return {k: v for k, v in s.items() if k != "frames"}


@router.websocket("/stream")
async def stream(ws: WebSocket, subject: int | None = None, speed: float = 2.0):
    """Sends one frame per analysed 1-second step. speed=2 means twice real time."""
    await ws.accept()
    try:
        s = await run_in_threadpool(session, subject)
        await ws.send_json({"type": "meta", "source": s["source"], "channels": s["channels"],
                            "trace_hz": s["trace_hz"], "total": len(s["frames"])})
        delay = 1.0 / max(0.25, min(speed, 10.0))
        for fr in s["frames"]:
            await ws.send_json({"type": "frame", **fr})
            await asyncio.sleep(delay)
        await ws.send_json({"type": "summary", **s["summary"]})
        await ws.close()
    except WebSocketDisconnect:
        pass
