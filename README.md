# Kokoryze

**Staying well at home, after the clinic.**
Kokoryze turns brain and body signals into simple, useful insights. It helps people stay well after TMS
treatment for depression, catches early changes, and keeps their clinician informed.

Built for the *Beyond the Clinic* track (Aalto University). See [PLAN.md](PLAN.md) for the full execution plan.

> Demo with **synthetic data only**. Not a medical device. Not a diagnosis.

## The loop

1. **Sense:** sleep, HRV, resting heart rate, steps, a reaction-time game, a daily check-in, and EEG.
2. **Respond:** suggest a supportive activity that fits how the person feels and the time of day.
3. **Learn:** "Did this help?" updates a per-person Thompson-sampling model of what works for them.
4. **Escalate:** a clinician dashboard sorts patients by who might need a call, with plain-language reasons.

## Run it

You need Python 3.11+ and Node 20+.

**1. Backend** (port 8000)
```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000 --reload
```

**2. Frontend** (port 5173, in a second terminal)
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

**Before you demo offline:** open the Brain session once while online. The EEG recording (~2.4 MB) is
downloaded from PhysioNet into `backend/data/eeg` and cached from then on.

**Optional: AI chat check-in.** Set an Anthropic API key before starting the backend and the check-in
screen gets a *Chat* tab. Without a key, the app uses the quick form and everything else works the same.
```bash
export ANTHROPIC_API_KEY=sk-ant-...        # PowerShell: $env:ANTHROPIC_API_KEY = "sk-ant-..."
```
Optional: `KOKORYZE_AI_MODEL` (default `claude-opus-5-5`), `KOKORYZE_AI=off` to disable.

**Tests**
```bash
cd backend
.venv/Scripts/python -m pytest -q
```
The AI tests use a simulated Claude client, so they run offline and cost nothing.

**Click-through tests** (with both servers running): `pip install playwright`, then
`python e2e/clickthrough.py`. It drives the real app in Microsoft Edge through 9 demo flows.

## Demo personas

| Persona | Story | Dashboard status | What it shows |
|---|---|---|---|
| Anna, 34 | Stable after TMS | 🟢 Stable | No false alarms on normal ups and downs |
| Ben, 52 | Sleep, steps, HRV, reaction time and mood slowly declining for 2 weeks | 🟠 Review suggested | Catches gradual, multi-signal change |
| Chloe, 27 | No data for 6 days | ⚪ Missing data | Silence is also a signal |
| David, 41 | Stressful work week, then recovered | 🟢 Stable (recovery noted) | Short blips don't trigger alerts |
| Eva, 63 | Mood alone dropping fast, sensors normal | 🟠 Review suggested | Self-report matters |
| Farid, 45 | Crisis wording in today's check-in | 🔴 Urgent | Safety protocol |

Demo controls in the patient app's side panel (a compact bar on phones): switch persona, and pin the
**time of day** so suggestions are predictable on stage. **Reset demo** is on the landing page (or
`POST /demo/reset`). The clinician list refreshes every 5 seconds, so with the patient app and dashboard
side by side, a crisis check-in appears on the dashboard live.

## How it works

**Personal baseline** (`backend/app/detection.py`). For each signal: median and robust spread (MAD × 1.4826)
over the first 14 days at home. Each day gets a robust z-score, flipped so that positive always means
"more concerning".

**Sustained change.** A signal counts as changed when z ≥ 1.5 on at least 4 of the last 7 days and the 7-day
average z ≥ 1.0. One bad night is never enough. The dashboard also estimates when a change began (the
earliest day from which the rolling 7-day average stayed elevated) and notes short changes that recovered.

**Status rules** (first match wins):
1. Crisis wording in a check-in in the last 48 h → Urgent
2. Fewer than 3 days with any data in the last 7 → Missing data
3. ≥ 2 sensor signals changed and mood or energy changed → Review suggested
4. Mood changed with 7-day average z ≥ 1.5 → Review suggested
5. ≥ 3 sensor signals changed → Keep an eye
6. Otherwise → Stable

**Learning what helps** (`backend/app/learner.py`). Beta(α, β) per person × activity × state (low energy,
anxious, short on sleep, low, steady). The main suggestion is the activity believed to help most (exploit).
One alternative is the best Thompson sample among the rest (explore). Every suggestion says why, for example
"helped you 3 of the last 3 times you felt low on energy."

**Closing the loop with EEG.** A brain session is paired with a calm activity (box breathing, body scan or
forest sounds). The relaxation change during the activity becomes learner evidence for that activity:
+15 points or more counts as "helped", +5 as "helped a bit". It counts at **half the weight** of the
person's own answer, because a brain signal is a hint about what helps, not the person's verdict.

**EEG** (`backend/app/eeg.py`). PhysioNet EEG Motor Movement/Imagery Dataset, resting runs (eyes open, then
eyes closed). Occipital/parietal channels → 1–40 Hz band-pass → 2 s windows with 1 s steps → adaptive
artifact rejection → Welch PSD → relative theta/alpha/beta → relaxation index = alpha / (alpha + beta),
smoothed and scaled 0–100. Replayed over a WebSocket as if live. Eyes-closed rest shows strongly increased
alpha, which we present as a "more relaxed" state. With a consumer headband (Muse, OpenBCI) the same
pipeline would run on live data.

**AI chat check-in** (`backend/app/checkin_ai.py`). One Claude call per chat turn, using structured output
(a JSON schema) that returns the friendly reply plus best-guess mood, energy, anxiety and sleep, and a crisis
flag. The AI only *proposes* values: the patient sees "here's what I understood", adjusts if needed and
confirms before anything is saved. Status rules never use the AI. Any problem (no key, network, refusal,
malformed reply) falls back to the quick form.

**Safety** (`backend/app/safety.py`). Conservative English and Finnish phrase matching, independent of any
AI model. It runs on every chat message *before* the AI sees it. On a match the patient immediately sees
help resources, and the clinic is flagged if the patient
allowed safety alerts. ⚠️ Double-check the crisis phone numbers before any public demo.

**Privacy.** Per-signal sharing toggles are enforced server-side in the clinician endpoints. Daily
summaries only: no audio, location or messages. "Delete my data" really deletes the data.

## Structure

```
backend/app/
  main.py            FastAPI app
  api_patient.py     patient endpoints
  api_clinic.py      clinician endpoints (respect sharing)
  api_eeg.py         EEG session + WebSocket replay
  detection.py       baselines, change detection, status + reasons
  learner.py         Thompson-sampling activity recommender (self-report + EEG evidence)
  checkin_ai.py      Claude-powered chat check-in with form fallback
  safety.py          crisis wording check + resources
  synthetic.py       6 deterministic demo personas
  signals.py         signal definitions
  interventions.py   activity library
  eeg.py             EEG pipeline
  store.py           in-memory demo store (resettable)
backend/tests/       persona status, learner, API, brain-session and chat check-in tests
frontend/src/
  patient/           Home, CheckIn, Activity, Trends, BrainSession, ReactionGame, Privacy, Crisis
  clinic/            PatientList, PatientDetail
  components/        BaselineChart, Sparkline, icons, shared UI
```

## Not built yet (see PLAN.md)

- Live headband input (the EEG is a replayed research recording), real wearable integrations, deployment.
- Dementia, anxiety and other modules (roadmap).
