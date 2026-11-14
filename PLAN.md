# Kokoryze: Hackathon Execution Plan

**Track:** Beyond the Clinic (Aalto University)
**Working pitch:** *We turn brain and body signals into simple, useful insights at home. They help people stay well after depression treatment, catch early changes, and keep their clinician informed.*

---

## 0. Assumptions (adjust these first)

| Assumption | If different |
|---|---|
| Hackathon lasts about **48 hours** | Squeeze the timeline in §17. The P0 list in §2 still fits in about 24 h. |
| Team of **3–4 people** | Solo or pair: merge roles as shown in §16. |
| No special hardware | If you get a Muse/OpenBCI headband, see §10.6. |
| Laptops with Node.js 20+ and Python 3.11+ | Install them before H0. |
| Demo uses **synthetic data only**, never real patient data | Keep it this way. It's also a privacy point in the pitch. |

If the hackathon has already started, count "H0" as **now** and follow the same order.

---

## 1. What we are building, in one picture

```
            ┌──────────────── PATIENT (phone-sized web app) ────────────────┐
            │  Daily check-in (AI chat or form) · Mini cognitive game       │
            │  "Your week vs. your normal" · Suggested activity · Did it help? │
            │  Brain session (EEG replay) · Privacy & sharing settings      │
            └──────────────┬───────────────────────────────▲─────────────────┘
                           │ check-ins, game scores,        │ suggestions,
                           │ intervention feedback          │ explanations
                           ▼                                │
   Wearable/phone data ─► ┌──────────────── BACKEND (FastAPI) ────────────────┐
   (simulated sleep,      │ 1. Store daily records                              │
    HRV, steps)           │ 2. Personal baseline per signal (median + MAD)      │
                          │ 3. Change detection (sustained deviations)          │
   EEG file ────────────► │ 4. Status rules: Stable / Review / Missing / Urgent │
   (PhysioNet dataset)    │ 5. Intervention learner (Thompson sampling)         │
                          │ 6. EEG pipeline (filter → band power → index)       │
                          └──────────────┬──────────────────────────────────────┘
                                         ▼
            ┌──────────────── CLINICIAN DASHBOARD (desktop web) ─────────────┐
            │  Patient list sorted by attention · Reasons in plain language  │
            │  Trend charts with baseline band · Mark reviewed / schedule call│
            └────────────────────────────────────────────────────────────────┘
```

**The loop the judges must see:** *sense* (signals + check-in) → *respond* (suggest an activity) → *learn* (did it help? → better suggestions next time) → *escalate* (clinician sees who might need a call).

---

## 2. Scope and priorities

Build in priority order. **Never start a P1 item until every P0 item works end to end.**

### P0: Must have (the demo fails without these)
1. Synthetic data for 6 patients × 45 days (§5)
2. Baseline + change detection + status rules (§6)
3. Clinician dashboard: sorted list with reasons, plus a patient detail page with charts (§12)
4. Patient app: home ("your week vs. your normal"), check-in form, suggestion with "did this help?" (§11)
5. Intervention learner showing "why this suggestion" (§7)
6. Safety: crisis wording in the check-in triggers a resources screen and an urgent flag (§13)
7. Pitch deck + rehearsed 3-minute demo (§18, §19)

### P1: Should have (these make it stand out)
8. EEG "brain session": replay a real recording and show a relaxation index going up (§10)
9. AI conversational check-in that falls back to the form (§9)
10. Reaction-time mini-game feeding the "cognitive" signal (§8)
11. Privacy screen with sharing toggles that actually hide data from the clinician view (§13)

### P2: Nice to have (only if ahead of schedule)
12. Live Muse headband instead of the replay
13. Adaptive calming audio/visual (breathing circle synced to a tone, colour shifts)
14. "Trusted friend" nudge (social direction from the brief)
15. Deployed public URL (Vercel + Render/Fly)

### Explicitly OUT of scope (put these on a "future" slide)
- Dementia, anxiety and ADHD modules
- Real wearable integrations (Oura, Apple Health, Fitbit APIs)
- Clinical validation, regulatory approval, real patients
- Native mobile apps

---

## 3. Tech stack

Kept deliberately light. Everything runs on one laptop.

| Part | Choice | Why |
|---|---|---|
| Frontend | **Vite + React + TypeScript** | Fast setup; one codebase for patient and clinician views |
| Styling | **Tailwind CSS** | Quick, consistent, looks good on a phone |
| Charts | **Recharts** | Simple line/area charts with a baseline band |
| Routing | React Router | `/patient/*` and `/clinic/*` in one app |
| Backend | **Python + FastAPI** | One language for data, algorithms and EEG |
| Storage | **SQLite** (via `sqlmodel`) or plain JSON files | Zero setup. TimescaleDB is overkill here. |
| Data/algorithms | NumPy, pandas, SciPy | Baselines, rolling stats, Welch PSD |
| EEG | **MNE-Python** | Loads EDF files and filters them; downloads the PhysioNet dataset |
| Live updates | FastAPI WebSocket | Streams the EEG index to the UI |
| AI check-in | Claude API (e.g. `claude-haiku-5-5` for fast chat) | Conversation + structured extraction. Optional, since the form works without it. |

**Rule:** the LLM never decides risk status. It only talks to the user and turns their answers into structured fields. Status comes from transparent rules (§6).

---

## 4. Repository structure

```
Kokoryze/
├── PLAN.md                  ← this file
├── README.md                ← how to run, screenshots, team
├── backend/
│   ├── pyproject.toml / requirements.txt
│   ├── app/
│   │   ├── main.py          ← FastAPI app, CORS, routers
│   │   ├── models.py        ← Patient, DailyRecord, Intervention, InterventionLog, Review
│   │   ├── db.py            ← SQLite session, seed loader
│   │   ├── baseline.py      ← personal baseline + robust z-scores
│   │   ├── detection.py     ← sustained-change detection + status rules + reasons
│   │   ├── learner.py       ← Thompson-sampling intervention recommender
│   │   ├── safety.py        ← crisis keyword check + urgent flag
│   │   ├── checkin_ai.py    ← LLM chat + JSON extraction (optional)
│   │   ├── eeg/
│   │   │   ├── load.py      ← download/load PhysioNet EEG
│   │   │   ├── pipeline.py  ← filter, epoch, artifact reject, band power
│   │   │   └── stream.py    ← WebSocket replay
│   │   └── routers/
│   │       ├── patients.py
│   │       ├── checkins.py
│   │       ├── interventions.py
│   │       ├── clinic.py
│   │       └── eeg.py
│   ├── scripts/
│   │   └── generate_synthetic.py   ← creates seed data (§5)
│   └── tests/
│       ├── test_baseline.py
│       ├── test_detection.py       ← each persona gets the expected status
│       └── test_learner.py
└── frontend/
    ├── package.json
    └── src/
        ├── main.tsx, App.tsx, api.ts
        ├── patient/  Home.tsx, CheckIn.tsx, Suggestion.tsx, Trends.tsx,
        │             BrainSession.tsx, ReactionGame.tsx, Privacy.tsx, Crisis.tsx
        ├── clinic/   PatientList.tsx, PatientDetail.tsx
        └── components/  BaselineChart.tsx, StatusBadge.tsx, ReasonList.tsx, PhoneFrame.tsx
```

---

## 5. Synthetic data

### 5.1 Signals per day (one `DailyRecord` per patient per day)

| Field | Unit / scale | Typical healthy range | Concerning direction |
|---|---|---|---|
| `sleep_hours` | hours | 6.5–8.5 | down (or very up) |
| `sleep_midpoint_var` | minutes of deviation from usual midpoint | 0–45 | up (irregular) |
| `hrv_rmssd` | ms | 25–70 (person-specific) | down |
| `resting_hr` | bpm | 55–75 | up |
| `steps` | count | 4,000–10,000 | down |
| `mood` | self-report 1–10 | 5–8 | down |
| `energy` | self-report 1–10 | 5–8 | down |
| `anxiety` | self-report 1–10 | 2–5 | up |
| `reaction_ms` | median reaction time | 250–350 | up (slower) |
| `checkin_done` | bool | – | missing = signal |

Any field can be `null` (missing).

### 5.2 Generator rules (`scripts/generate_synthetic.py`)
- 45 days per patient, ending "today". Days 1–14 are the post-TMS **baseline period**.
- Each patient gets a personal mean for each signal (people differ: HRV 30 for one person, 60 for another).
- Add realistic noise: Gaussian noise + a **weekly pattern** (more steps and later sleep on weekends) + occasional one-off bad days.
- Fix the random seed so the demo is identical every run.

### 5.3 Personas (each one demonstrates something)

| Persona | Story | Expected status | What it proves |
|---|---|---|---|
| **Anna**, 34 | Stable after TMS. Normal noise only. | 🟢 Stable | No false alarms on normal variation |
| **Ben**, 52 | From day 28: sleep −1.2 h, steps −40%, HRV −20%, mood drifts 7 → 4 | 🟠 Review suggested | Catches a gradual, multi-signal change |
| **Chloe**, 27 | No data for the last 6 days | ⚪ Missing data | Silence is also a signal |
| **David**, 41 | Days 33–36: exam/work stress (poor sleep, low HRV), then fully recovers; mood stays OK | 🟢 Stable (recovered blip) | Short blips do **not** trigger alerts |
| **Eva**, 63 | Mood alone drops sharply over 5 days; sensors normal | 🟠 Review suggested | Self-report matters even when sensors look fine |
| **Farid**, 45 | Today's check-in contains crisis wording | 🔴 Urgent: contact today | Safety protocol |

Also generate ~20 past `InterventionLog` entries per patient so the learner already has history (for example, Ben benefits from walks but not from breathing exercises).

---

## 6. Baseline and change detection (the core)

Keep it **transparent and explainable**. Every alert must say *why* in plain language.

### 6.1 Personal baseline
For each patient and each signal:
- Baseline window = **days 1–14** (post-treatment period), or a rolling 28 days ending 7 days ago if you prefer adaptive.
- `baseline_median` = median of the window
- `baseline_mad` = median absolute deviation × 1.4826 (robust standard deviation)
- Floor the MAD to avoid division by tiny numbers (e.g. mood ≥ 0.5, steps ≥ 500, HRV ≥ 3 ms).

### 6.2 Daily deviation
- Robust z-score: `z = (value − baseline_median) / baseline_mad`
- Flip the sign so that **positive = concerning** (for example, lower sleep gives positive z).
- Smooth: `z7` = 7-day rolling mean of z (ignore missing days, need ≥ 4 values).

### 6.3 Sustained change (per signal)
A signal is **"changed"** if `z ≥ 1.5` on **at least 4 of the last 7 days** *and* `z7 ≥ 1.0`.
→ This makes David's 3–4-day blip that recovered **not** count once it's over, while Ben's 2+ weeks of decline does.

### 6.4 Status rules (evaluated top to bottom; first match wins)

| # | Rule | Status |
|---|---|---|
| 1 | Crisis flag in any check-in in the last 48 h | 🔴 **Urgent: contact today** |
| 2 | Fewer than 3 days with any data in the last 7 | ⚪ **Missing data: check in** |
| 3 | ≥ 2 sensor signals changed **and** mood or energy changed | 🟠 **Review suggested** |
| 4 | Mood changed with mood z7 ≥ 1.5 (even if sensors normal) | 🟠 **Review suggested** |
| 5 | ≥ 3 sensor signals changed (mood normal) | 🟡 **Keep an eye** |
| 6 | otherwise | 🟢 **Stable** |

Sort the clinician list by: Urgent → Review → Missing → Keep an eye → Stable, then by how many signals changed.

### 6.5 Plain-language reasons (generated from the rules)
Examples:
- "Sleep is **1.3 h below** usual for 9 of the last 10 days."
- "Daily steps are **38% lower** than usual this week."
- "Self-reported mood averaged **4.1** this week (usual: **7.0**)."
- "No check-ins or sensor data for **6 days**."

Template: `"{signal} is {amount} {higher/lower} than usual for {n} of the last {m} days."`

### 6.6 Patient-facing wording (gentler)
- Never "risk", "relapse" or "depression score".
- Say: "Your sleep has been shorter than your usual for about a week. Want to try something that often helps you?"

### 6.7 Tests (`tests/test_detection.py`)
One test per persona asserting the expected status. **This is the most important test file.** If you tune thresholds, these tests tell you whether you broke a persona.

---

## 7. Intervention library and learning

### 7.1 Library (10–12 items, 4 categories)

| Category | Examples | Duration |
|---|---|---|
| Relaxation | Box breathing (4-4-4-4) with animated circle; body-scan audio | 3–5 min |
| Behavioural activation | 10-minute walk outside; "one small task" (make tea, open a window, tidy one surface) | 5–15 min |
| Social connection | Message one trusted person; call a friend (with optional template text) | 2–10 min |
| Sensory / nature | Forest or sea soundscape with slow colour fade; morning bright-light reminder | 5–10 min |

Each item: `id, title, category, duration_min, instructions, good_for` (e.g. `["low_energy", "anxious", "poor_sleep", "evening"]`).

### 7.2 Context (what situation the person is in)
Derived from today's check-in and signals:
- `low_energy` (energy ≤ 4), `anxious` (anxiety ≥ 6), `poor_sleep` (sleep z ≥ 1.5), `low_mood` (mood ≤ 4)
- time of day: `morning / afternoon / evening`
Keep the context small: 1 main state + time of day.

### 7.3 Learner: Thompson sampling (about 40 lines of code)
- For each `(patient, intervention, main_state)` keep `alpha, beta` (start at 1, 1).
- After an activity, the patient answers **"Did this help?"** (Yes / A bit / No) and optionally re-rates mood.
- `helped = 1` if Yes, or if mood went up by ≥ 1; `0.5` for "a bit"; `0` otherwise.
  Update: `alpha += helped; beta += 1 − helped`.
- To suggest: filter the library by `good_for` and time of day, sample `θ ~ Beta(alpha, beta)` for each, and pick the top 1 (show 2 alternatives).
- **Explanation shown to the user:** "Suggested because walks helped you **4 of the last 5 times** you felt low on energy."

### 7.4 Demo moment
On stage: open Ben's app → "Low energy today" → suggestion: walk (helped 4/5). Tap "Try something else" → breathing → "Did this help?" → No → show the next suggestion ranking update live.

---

## 8. Reaction-time mini-game (cognitive signal)

- 5 trials: a circle appears after a random 1–3 s delay; tap as fast as possible.
- Ignore taps that come too early (< 120 ms) and show "too early!".
- Store the **median** reaction time → `reaction_ms` for today.
- Takes about 30 seconds. Make it feel like a game: a score, a streak, friendly copy.
- In the pitch, be honest: *practice and tiredness affect scores, so we only look at long, sustained trends.*

(P2 idea: a 1-minute digit-span memory game, which becomes the basis of a future dementia module.)

---

## 9. AI check-in (P1, with form fallback)

### 9.1 Form version (P0, build first)
Sliders 1–10: mood, energy, anxiety; sleep quality (1–5); free text "Anything on your mind?" (optional).

### 9.2 Chat version
- Asks at most 3–4 short, warm questions, then summarises.
- The backend sends the conversation to the LLM with instructions to:
  1. Respond briefly and kindly; reflect back what it heard; **no diagnosis, no medical advice**.
  2. At the end, output **JSON only**: `{"mood": 1-10, "energy": 1-10, "anxiety": 1-10, "sleep_quality": 1-5, "notes": "…", "crisis_concern": true/false}`.
- Validate the JSON with Pydantic; if it fails, show the form pre-filled with whatever was parsed.
- **Safety runs before and independently of the LLM** (§13.2). Keyword rules catch crisis wording even if the LLM misses it.
- No API key or no internet → show the form. The demo must never depend on Wi-Fi.

---

## 10. EEG "brain session" module (P1)

### 10.1 Goal
Show the judges **real brain data** turning into something a person understands: *"Your relaxation level rose during the breathing exercise."*

### 10.2 Dataset
**PhysioNet EEG Motor Movement/Imagery Dataset (EEGMMIDB)**, which MNE downloads automatically:
```python
from mne.datasets import eegbci
files = eegbci.load_data(subject=1, runs=[1, 2])  # run 1 = eyes open, run 2 = eyes closed (1 min each)
```
Why this one: it's free, needs no registration, loads in one line, and has clean **eyes-open vs. eyes-closed** resting recordings. Eyes-closed rest reliably shows **higher alpha power (8–12 Hz)**, a well-known pattern that's honest to present as a "relaxed state" signal.

Download it **before** the hackathon or at H0 and commit a small cached copy (or document the cache path) so the demo works offline.

(Depression-specific EEG datasets such as MODMA need an access request and won't arrive in time. Mention them as future work.)

### 10.3 Pipeline (`eeg/pipeline.py`)
1. Load EDF → `raw` (MNE). Standardise channel names (`eegbci.standardize(raw)`).
2. Pick channels: occipital/parietal `O1, Oz, O2, Pz` for alpha (and optionally frontal `Fp1, Fp2` for a frontal view).
3. Band-pass filter 1–40 Hz; notch at 50 Hz (Europe) and 60 Hz (US recording, since the dataset is US).
4. Cut into **2-second windows, 50% overlap**.
5. Artifact rejection: drop windows with peak-to-peak amplitude > 150 µV (blinks/movement). Count dropped windows and show "signal quality".
6. Welch PSD per window (`scipy.signal.welch`, nperseg = 2 s).
7. Band powers: theta 4–8, alpha 8–12, beta 13–30 Hz (relative power = band / total 1–40 Hz).
8. **Relaxation index** = alpha / (alpha + beta), smoothed with an exponential moving average.
9. Normalise to 0–100 for display, using the min/max across the session.

### 10.4 The demo storyline
Concatenate **eyes-open (≈ "before")** → **eyes-closed (≈ "during the breathing exercise")** and replay it over a WebSocket at real speed (or 2× speed).
UI shows:
- A live scrolling raw-EEG trace (one channel, downsampled), which looks impressive and proves it's real data
- A **relaxation gauge** rising from about 30 to about 70
- Band-power bars (theta / alpha / beta)
- A signal-quality indicator (% of windows kept)
- An end summary: "Relaxation index +X% compared with the start."

**Be honest on stage:** "This is a public research recording replayed as if live. With a consumer headband like Muse the same pipeline runs in real time."

### 10.5 Closed-loop idea (one slide, optional code)
The EEG relaxation change becomes an extra "did it help?" signal for the learner (§7), so the system learns which activities the person's *brain* responds to. That speaks directly to the brief's "closed-loop" wording.

### 10.6 If you get a real headband (P2)
- **Muse:** use `muselsl` (stream over LSL) or the Mind Monitor app (OSC) → feed the same pipeline (channels TP9, AF7, AF8, TP10; alpha still visible with eyes closed).
- **OpenBCI:** BrainFlow SDK.
- Keep the replay as a backup. Live hardware fails on stage often.

---

## 11. Patient app (phone-sized, P0)

Render inside a phone frame (`PhoneFrame.tsx`, about 390 × 844) when viewed on a laptop, and full-screen on a real phone.

| Screen | Content |
|---|---|
| **Home** | Greeting · today's check-in button · "Your week vs. your normal" card (3 mini bars: sleep, activity, mood, each with a "usual" marker) · suggested activity card · streak |
| **Check-in** | Form (P0) or chat (P1) · crisis check on submit |
| **Suggestion** | Activity title, duration, instructions · "Why this?" explanation · Start → timer/animation · "Did this help?" (Yes / A bit / No) · optional mood re-rate |
| **Breathing** | Animated circle expanding/contracting 4-4-4-4 with soft colour change (also the "sensory" direction) |
| **Trends** | 30-day charts with a shaded "your usual range" band (baseline median ± 1 MAD) |
| **Brain session** | EEG replay (§10) |
| **Reaction game** | §8 |
| **Privacy** | Toggles: share sleep / activity / heart / mood / notes with my clinic · "Download my data" · "Delete my data" |
| **Crisis** | Calm full screen: "You're not alone." Emergency number (112 in Finland/EU) and a mental-health crisis line, a "Call my clinic" button, and a note that the clinic has been notified (only if the patient consented) |

Use a calm, warm visual style: soft colours, large text, no red alarms on the patient side.

---

## 12. Clinician dashboard (desktop, P0)

### 12.1 Patient list (`/clinic`)
| Column | Example |
|---|---|
| Status badge | 🟠 Review suggested |
| Patient | Ben K., 52 · 6 weeks post-TMS |
| Top reasons (2 max) | "Sleep −1.3 h for 9/10 days" · "Mood 4.1 (usual 7.0)" |
| Signals changed | 4 of 6 |
| Last data | Today |
| Action | Review → |

Header summary: "**1 urgent · 2 to review · 1 missing data · 2 stable**", which is the *"who might need a call"* moment.

### 12.2 Patient detail (`/clinic/patient/:id`)
- Status + all reasons
- Small-multiple charts (sleep, HRV, steps, mood, energy, reaction time): 45 days, baseline band shaded, changed periods highlighted
- Check-in notes timeline (only if the patient shared them)
- Intervention history: what was tried and what helped
- EEG session summaries (if any)
- Actions: **Mark as reviewed** (with note) · **Schedule call** · **Send message** (mock). Status changes to "Reviewed today" so clinicians see that follow-up happened.
- Footer disclaimer: "Indicators show change from this person's usual pattern. They are not a diagnosis. Clinical judgement required."

### 12.3 Workload principle
Show the **minimum needed to decide whom to call**. The list should be readable in 10 seconds.

---

## 13. Safety, privacy and ethics (build in, don't bolt on)

### 13.1 Principles (also a pitch slide)
1. **Not a diagnosis.** We show change from the person's own baseline.
2. **Human in the loop.** Only clinicians decide; the system only prioritises.
3. **Patient controls sharing.** Per-signal toggles; the clinician view respects them.
4. **Data minimisation.** Daily summaries only, never raw audio, location or messages.
5. **Synthetic data in the demo.** No real health data was used.

### 13.2 Crisis protocol (`safety.py`)
- Keyword/phrase list (English + Finnish basics) for self-harm or suicidal wording, plus the LLM `crisis_concern` flag.
- On match: show the **Crisis screen** immediately → set the 🔴 Urgent flag (if sharing is on) → log it.
- Never let the AI chat continue as if nothing happened.
- Pitch line: *"Real deployment would follow the clinic's own emergency protocol. This is a support tool, not an emergency service."*

### 13.3 Privacy implementation (demo level)
- Sharing toggles stored per patient; `/clinic` endpoints filter fields accordingly.
- "Delete my data" really deletes the patient's records in the demo DB.
- Slide: encryption at rest and in transit, role-based access, audit log, GDPR (EU), and the fact that a real product needs a medical-device regulatory assessment (EU MDR).

---

## 14. API endpoints (FastAPI)

| Method | Path | Purpose |
|---|---|---|
| GET | `/patients` | List (for the persona switcher) |
| GET | `/patients/{id}/today` | Home card: week vs. normal, suggestion |
| GET | `/patients/{id}/trends?days=45` | Series + baseline bands |
| POST | `/patients/{id}/checkins` | Form check-in → safety check → stored |
| POST | `/patients/{id}/checkin-chat` | Chat turn (P1) |
| POST | `/patients/{id}/reaction` | Store reaction-time result |
| GET | `/patients/{id}/suggestion` | Learner pick + explanation + alternatives |
| POST | `/patients/{id}/interventions/{iid}/feedback` | Did it help → learner update |
| GET/PUT | `/patients/{id}/sharing` | Privacy toggles |
| DELETE | `/patients/{id}/data` | Delete my data |
| GET | `/clinic/overview` | Sorted list + counts |
| GET | `/clinic/patients/{id}` | Detail (respects sharing) |
| POST | `/clinic/patients/{id}/review` | Mark reviewed / schedule call |
| WS | `/eeg/stream` | EEG replay: `{t, raw[], alpha, beta, theta, relax_index, quality}` |
| POST | `/demo/reset` | Re-seed everything (press before every demo run) |

Add a **persona switcher** dropdown in the patient app (Anna/Ben/…) and a **"Reset demo"** button hidden in a corner.

---

## 15. Coding standards for speed
- Agree the API shapes (§14) in the first hour; the frontend uses **mock JSON** until the backend is ready.
- One `api.ts` file with typed functions. Nobody calls `fetch` elsewhere.
- Commit small and often to `main`; pull before you push. Use feature branches only if two people touch the same files.
- Algorithm code has tests (§6.7). UI code doesn't need them at a hackathon.
- Every evening checkpoint: **the demo runs end to end from a clean start.**

---

## 16. Team roles

### 4 people
| Role | Owns | Also helps with |
|---|---|---|
| **A. Patient app** | §8, §9.1, §11 | Breathing animation, crisis screen |
| **B. Clinician dashboard + design** | §12, shared components, visual style | Pitch deck visuals, screenshots |
| **C. Backend + algorithms** | §5, §6, §7, §13.2, §14 | Tests, demo reset |
| **D. EEG + AI + pitch lead** | §9.2, §10, §18, §19 | Q&A prep, README, video |

### 3 people
Merge B into A+D: A = all frontend; C = backend + algorithms; D = EEG + AI + pitch + dashboard styling.

### 2 people
Person 1 = frontend (patient + clinic). Person 2 = backend + algorithms + EEG. Both write the pitch on day 2. Drop the AI chat (P1) first.

### Solo
Do P0 only, plus the EEG replay if there is time. Use a minimal UI. The pitch matters more than polish.

---

## 17. Timeline (48 hours)

Times are "hours since start". **Bold = checkpoint: stop and verify together.**

### Phase 1: Setup and alignment (H0–H3)
- [ ] H0–H1: Everyone reads this plan. Agree on the name, roles and the 3-minute demo story (§19). Assign P0 items.
- [ ] H0–H1: Talk to the track mentors (5 min): confirm what they value most (closed loop? clinician view? EEG?). **Adjust priorities based on what they say.**
- [ ] H1–H2: C: scaffold FastAPI + SQLite + `/patients` stub. A/B: scaffold Vite + React + Tailwind + Router + PhoneFrame. D: install MNE, download the EEG dataset, confirm it loads.
- [ ] H2–H3: Write API shapes as TypeScript types + Pydantic models. Create mock JSON for the frontend.
- [ ] **H3 checkpoint:** both apps run; the frontend shows mock data; the EEG file loads in a notebook.

### Phase 2: Core build (H3–H14)
- [ ] C: synthetic generator with all 6 personas (H3–H6)
- [ ] C: baseline + detection + status rules + reasons + persona tests (H6–H10)
- [ ] C: learner + intervention library + feedback endpoint (H10–H12)
- [ ] C: safety check on check-in (H12–H13)
- [ ] A: Home, Check-in form, Suggestion + "did it help?" screens on mock data (H3–H10)
- [ ] A: breathing animation, crisis screen (H10–H14)
- [ ] B: clinician list + status badges + reasons (H3–H8)
- [ ] B: patient detail with BaselineChart (shaded band) (H8–H14)
- [ ] D: EEG pipeline in a notebook → band powers → relaxation index plot showing alpha rising eyes-closed (H3–H9)
- [ ] D: move the pipeline to `eeg/pipeline.py` + WebSocket replay (H9–H14)
- [ ] **H14 checkpoint (end of day 1 evening):** frontend switched from mock to real API. Clinician list shows the correct status for all 6 personas. Patient can check in → get a suggestion → give feedback.

### Phase 3: Rest (H14–H20)
- [ ] **Sleep at least 4–5 hours.** Tired teams demo badly. If you do work, only fix bugs; no new features.

### Phase 4: P1 features (H20–H32)
- [ ] D: Brain Session screen (raw trace, gauge, band bars, quality, summary) (H20–H25)
- [ ] D: AI chat check-in + JSON extraction + fallback (H25–H30)
- [ ] A: reaction-time game → stored → appears in trends and clinician charts (H20–H24)
- [ ] A: Trends screen + Privacy screen (H24–H28)
- [ ] B: review/schedule-call actions, header counts, polish (H20–H26)
- [ ] C: sharing toggles enforced in clinic endpoints; delete-my-data; `/demo/reset` (H20–H25)
- [ ] C: feed EEG relaxation change into the learner as extra feedback (optional, H25–H28)
- [ ] **H32 checkpoint: FEATURE FREEZE.** Anything not working now gets cut (see cut list below).

### Phase 5: Polish and pitch (H32–H44)
- [ ] B + A: visual polish, consistent spacing/colours, empty states, loading states (H32–H38)
- [ ] D: pitch deck (§18) (H32–H37)
- [ ] All: write demo script word by word (§19) (H36–H38)
- [ ] All: **3 full rehearsals with a timer**, then fix what breaks (H38–H42)
- [ ] Record a **backup demo video** (screen recording, 2–3 min) in case live fails (H42–H43)
- [ ] README with screenshots, how to run, architecture, team (H42–H44)

### Phase 6: Submit (H44–H48)
- [ ] Submit early (by H46); don't wait for the last minute
- [ ] Final rehearsal, charge laptops, open all tabs, press "Reset demo"

### Cut list (cut in this order if behind)
1. Live Muse (P2) → keep the replay
2. AI chat → keep the form
3. Reaction game → hide that signal
4. Privacy toggles → keep only as a slide
5. Trends screen (patient) → the clinician charts are enough
6. **Never cut:** clinician list with reasons, check-in → suggestion → feedback loop, crisis screen, rehearsed pitch.

---

## 18. Pitch deck (about 8 slides, 3–4 minutes with the demo)

1. **Hook:** "TMS can lift severe depression. But once the daily hospital visits stop, patients go home and clinicians lose sight of them until the next appointment." *(State it qualitatively; only quote relapse numbers if you've checked the source.)*
2. **Problem:** at home there are no scans, no blood tests, no daily contact. Clinicians can't follow everyone.
3. **Solution:** Kokoryze, a home loop: **sense → respond → learn → escalate**. One diagram.
4. **LIVE DEMO** (§19)
5. **How it works:** personal baselines, sustained-change rules, explainable reasons, learning which activities help *this* person, EEG pipeline.
6. **Trust by design:** not a diagnosis, human in the loop, patient-controlled sharing, crisis protocol, synthetic data only.
7. **Impact and business:** clinics and TMS providers pay (B2B2C); value = prioritised follow-ups without extra workload. Patients use it free through their clinic.
8. **Roadmap and ask:** pilot with a TMS clinic → validate against PHQ-9 and clinician judgement → live EEG headbands → new modules (dementia: cognitive trends; anxiety). Research question: *"Can combined wearable signals and self-reports catch changes earlier and more reliably than self-reports alone?"*

---

## 19. Demo script (about 2 minutes inside the pitch)

Practise until it fits. One person drives, one person talks.

1. **Clinician view (20 s):** "Monday morning, Dr. Laine has 6 patients after TMS. Instead of calling everyone, she sees this." → Header: *1 urgent, 2 to review, 1 missing data, 2 stable.*
2. **Ben (25 s):** click Ben → "Sleep down 1.3 hours, steps down 38%, mood 4 versus his usual 7, sustained for over a week." Show charts with the shaded usual range. "Compare David: he had a stressful week, but it recovered, so no alarm. We look for sustained change, not bad days."
3. **Patient side (35 s):** switch to Ben's phone → home: "Your sleep has been shorter than usual this week." → check-in (sliders or AI chat) → suggestion: "A 10-minute walk. Walks helped you 4 of 5 times when you felt low on energy." → tap "Did this help? Yes" → "Every answer teaches the system what works for Ben."
4. **Brain session (30 s):** "This is real EEG from a public research dataset, replayed live." Start the breathing exercise → relaxation gauge rises as alpha waves increase. "With a consumer headband, the loop can learn what the person's brain actually responds to."
5. **Safety (10 s):** Farid's urgent flag: "Crisis wording in a check-in shows help resources immediately and flags the clinic. A human always decides."
6. **Close (5 s):** "Kokoryze helps people stay well at home and helps clinicians see who needs a call."

**Before every run:** press Reset demo, check the Wi-Fi isn't needed, set screen zoom so people at the back can read it.

---

## 20. Judge Q&A prep

| Likely question | Answer |
|---|---|
| "Can you really detect depression from sleep and steps?" | "No, and we don't claim to. We detect sustained change from a person's own baseline, combined with their self-report, and flag it for a human." |
| "How accurate is it?" | "Not validated yet; the demo uses synthetic data. Our first pilot would compare our flags against PHQ-9 scores and clinician judgement, and measure false-alarm rates." |
| "Won't this create alarm fatigue for clinicians?" | "That's why we require sustained, multi-signal change and show reasons. The David persona shows a stress blip that doesn't trigger an alert." |
| "Why EEG if it's noisy?" | "It's optional. The core works with phone and wearable data. EEG adds a direct brain signal for checking whether an activity relaxed the person, which closes the loop." |
| "What about privacy?" | "Patients choose what's shared per signal, we store daily summaries only, and they can delete everything. A real deployment needs GDPR compliance and medical-device assessment." |
| "Why would a clinic pay?" | "It replaces blind check-in calls with prioritised ones, which saves clinician time and may catch problems earlier." |
| "Is the AI deciding who's at risk?" | "No. Status comes from transparent rules you can read. The AI only makes the check-in conversational." |
| "What's next for dementia?" | "The same baseline-and-change engine, with cognitive games as the main signal. That needs its own validation, so it's on our roadmap, not in today's claim." |

---

## 21. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Wi-Fi fails during the demo | Everything runs locally; EEG data cached; AI chat falls back to the form; backup video |
| Detection thresholds give wrong statuses | Persona tests (§6.7) run before every demo |
| Frontend and backend don't fit together | API types agreed at H2; mock data first; integration checkpoint at H14 |
| EEG pipeline takes too long | Notebook proof by H9; if alpha doesn't show clearly, try other subjects (1–10) or channels; cut to a static before/after chart |
| Scope creep | P0/P1/P2 list; feature freeze at H32 |
| Overclaiming in the pitch | Use the wording rules in §6.6 and §13.1; rehearse the Q&A |
| Exhaustion | Mandatory sleep block in Phase 3 |

---

## 22. Definition of done (check before submitting)

- [ ] `README.md` explains setup in fewer than 5 commands; a fresh clone runs
- [ ] All 6 personas show the expected status; persona tests pass
- [ ] Check-in → suggestion → feedback updates the learner (visible change in explanation/ranking)
- [ ] Crisis wording → crisis screen + urgent flag
- [ ] Clinician list sorted correctly with plain-language reasons
- [ ] Patient detail charts show the baseline band
- [ ] EEG brain session replays and the relaxation index visibly rises (P1)
- [ ] No real personal data anywhere in the repo
- [ ] Disclaimer visible in both apps
- [ ] Pitch rehearsed under time 3×; backup video recorded
- [ ] Submission form, repo link, video and screenshots uploaded

---

## 23. After the hackathon (roadmap slide + real next steps)

1. **Talk to 3–5 TMS clinicians:** what would they actually act on? How many alerts per week is acceptable?
2. **Pilot design:** small group of post-TMS patients for 8–12 weeks, with weekly PHQ-9 as the reference; measure false-alarm rate, lead time and engagement.
3. **Real integrations:** Oura / Apple Health / Google Health Connect; Muse for optional EEG sessions.
4. **Regulatory path:** clarify intended use (wellness vs. clinical monitoring), EU MDR classification, GDPR/DPIA.
5. **New modules:** cognitive-trend monitoring (dementia), anxiety, each validated separately on the same platform.
