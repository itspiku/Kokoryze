"""EEG pipeline: real recordings -> clean band powers -> a simple relaxation index.

Data: PhysioNet EEG Motor Movement/Imagery Dataset (Schalk et al., 2004).
Run 1 = 1 minute resting with eyes open, run 2 = 1 minute resting with eyes closed.
Eyes-closed rest reliably shows more alpha (8-12 Hz) activity over the back of
the head, which we use to demonstrate a "more relaxed" brain state.

We replay "eyes open" as *before* and "eyes closed" as *during the exercise*.
This is a public research recording replayed as if live, not a live measurement.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.signal import welch

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "eeg"
CHANNELS = ["O1", "Oz", "O2", "Pz", "POz"]
TRACE_CHANNEL = "Oz"
WIN_S, STEP_S = 2.0, 1.0
PTP_REJECT_UV = 150.0
BANDS = {"theta": (4, 8), "alpha": (8, 12), "beta": (13, 30)}
TRACE_HZ = 50


def _load(subject: int):
    import mne
    from mne.datasets import eegbci

    files = eegbci.load_data(subject, [1, 2], path=str(DATA_DIR), update_path=False, verbose=False)
    raws = []
    for f in files:
        raw = mne.io.read_raw_edf(f, preload=True, verbose=False)
        eegbci.standardize(raw)
        raw.pick([c for c in CHANNELS if c in raw.ch_names])
        # 1-40 Hz band-pass removes slow drift and mains noise (50/60 Hz) in one step
        raw.filter(1.0, 40.0, verbose=False)
        raws.append(raw)
    return raws


def _band_powers(seg: np.ndarray, fs: float) -> dict:
    f, pxx = welch(seg, fs=fs, nperseg=int(fs * WIN_S), axis=-1)
    pxx = pxx.mean(axis=0)  # average over channels
    total = pxx[(f >= 1) & (f <= 40)].sum()
    return {name: float(pxx[(f >= lo) & (f < hi)].sum() / total) for name, (lo, hi) in BANDS.items()}


@lru_cache(maxsize=4)
def session(subject: int | None = None) -> dict:
    subject = subject or int(os.environ.get("EEG_SUBJECT", "4"))
    raws = _load(subject)
    fs = raws[0].info["sfreq"]
    win, step = int(WIN_S * fs), int(STEP_S * fs)
    trace_idx = raws[0].ch_names.index(TRACE_CHANNEL) if TRACE_CHANNEL in raws[0].ch_names else 0
    ds = max(1, int(fs // TRACE_HZ))

    datas = [raw.get_data() * 1e6 for raw in raws]  # volts -> microvolts
    # Artifact rejection: drop windows far noisier than this recording's typical
    # window (blinks, movement, loose electrodes). Floor at 150 uV peak-to-peak.
    ptps = [np.ptp(d[:, s:s + win], axis=1).max()
            for d in datas for s in range(0, d.shape[1] - win + 1, step)]
    reject_uv = max(PTP_REJECT_UV, 2.0 * float(np.median(ptps)))

    frames, t = [], 0
    for phase, data in zip(("before", "during"), datas):
        for start in range(0, data.shape[1] - win + 1, step):
            seg = data[:, start:start + win]
            ok = bool(np.ptp(seg, axis=1).max() < reject_uv)
            bp = _band_powers(seg, fs)
            frames.append({
                "t": t, "phase": phase, "ok": ok, **bp,
                "ratio": bp["alpha"] / (bp["alpha"] + bp["beta"]),
                "raw": np.round(seg[trace_idx, -step::ds], 1).tolist(),
            })
            t += 1

    # smooth (exponential moving average over clean windows) and scale to 0-100
    ema, smoothed = None, []
    for fr in frames:
        if fr["ok"]:
            ema = fr["ratio"] if ema is None else 0.25 * fr["ratio"] + 0.75 * ema
        smoothed.append(ema if ema is not None else fr["ratio"])
    lo, hi = np.percentile(smoothed, 5), np.percentile(smoothed, 95)
    for fr, s in zip(frames, smoothed):
        fr["relax"] = round(float(np.clip((s - lo) / (hi - lo + 1e-9) * 100, 0, 100)), 1)

    def mean(phase, key):
        vals = [f[key] for f in frames if f["phase"] == phase and f["ok"]]
        return float(np.mean(vals)) if vals else 0.0

    before, during = mean("before", "relax"), mean("during", "relax")
    alpha_b, alpha_d = mean("before", "alpha"), mean("during", "alpha")
    return {
        "source": "PhysioNet EEG Motor Movement/Imagery Dataset, subject %d, runs 1-2 (resting)" % subject,
        "channels": raws[0].ch_names,
        "sample_rate": fs,
        "trace_hz": fs / ds,
        "frames": frames,
        "summary": {
            "relax_before": round(before, 1),
            "relax_during": round(during, 1),
            "alpha_before": round(alpha_b, 3),
            "alpha_during": round(alpha_d, 3),
            "alpha_change_pct": round((alpha_d - alpha_b) / alpha_b * 100, 1) if alpha_b else None,
            "quality_pct": round(100 * sum(f["ok"] for f in frames) / len(frames), 1),
        },
    }
