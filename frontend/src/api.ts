// All calls to the backend live here. The Vite dev server proxies /api to :8000.
import { todQuery } from './demoTime'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, body: string) {
    super(`${status} ${body}`)
    this.status = status
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json() as Promise<T>
}
const post = <T>(path: string, body: unknown) => req<T>(path, { method: 'POST', body: JSON.stringify(body) })

// ---------- types ----------
export type Status = 'urgent' | 'review' | 'missing' | 'watch' | 'stable'
export type StateKey = 'low_energy' | 'anxious' | 'poor_sleep' | 'low_mood' | 'steady'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export interface PatientRef { id: string; name: string; age: number }

export interface Activity {
  id: string
  title: string
  category: 'relaxation' | 'activation' | 'social' | 'sensory'
  duration_min: number
  screen: 'breathing' | 'timer' | 'nature' | 'message'
  instructions: string
  expected_help: number
  times_tried: number
  why: string
  explore?: boolean
}

export interface SuggestionResponse {
  state: StateKey
  state_label: string
  time_of_day: TimeOfDay
  suggestion: Activity | null
  alternatives: Activity[]
}

export interface WeekCompare {
  key: string; label: string; unit: string
  week: number; usual: number; ratio: number
  tone: 'usual' | 'lower' | 'higher'
}

export interface Today extends SuggestionResponse {
  patient: { id: string; name: string; first_name: string }
  date: string
  checked_in_today: boolean
  today: { mood: number | null; energy: number | null; anxiety: number | null; reaction_ms: number | null; notes: string | null }
  streak: number
  week_vs_normal: WeekCompare[]
  days_since_tms: number
}

export interface Point { date: string; value: number | null; unusual?: boolean }
export interface Series {
  key: string; label: string; unit: string; changed: boolean
  onset?: string | null
  baseline: { median: number; low: number; high: number } | null
  points: Point[]
}

export interface CheckInValues { mood: number; energy: number; anxiety: number; sleep_quality?: number; notes?: string }

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatProposal {
  mood: number | null; energy: number | null; anxiety: number | null
  sleep_quality: number | null; notes: string | null
}
export interface ChatReply {
  reply: string; done: boolean; crisis: boolean
  proposal: ChatProposal | null
  resources?: CrisisResources; clinic_notified?: boolean
}

export interface BrainActivity { id: string; title: string; category: Activity['category']; duration_min: number; instructions: string }
export interface BrainSessionResult extends SuggestionResponse {
  message: string
  evidence: { activity: string; brain_sessions: number; brain_relaxed: number; used_when: string }
}

export interface CrisisResources {
  message: string
  contacts: { label: string; number: string; note: string }[]
  disclaimer: string
}

export interface CheckInResult { ok: boolean; crisis: boolean; clinic_notified: boolean; resources: CrisisResources | null }

export interface Review { date: string; time: string; action: 'reviewed' | 'call_scheduled' | 'message_sent'; note: string | null }

export interface ClinicRow {
  id: string; name: string; age: number; weeks_since_tms: number
  status: Status; status_label: string; reasons: string[]
  changed_count: number; signals_tracked: number
  changing_since: string | null
  mood_trend: (number | null)[] | null; mood_usual: number | null
  last_data_date: string | null; last_review: Review | null; reviewed_today: boolean
}

export interface ClinicOverview { date: string; counts: Record<Status, number>; patients: ClinicRow[] }

export interface ClinicDetail extends ClinicRow {
  series: Series[]
  notes: { date: string; text: string; crisis: boolean }[]
  interventions: { id: string; title: string; tried: number; helped: number }[]
  brain_sessions: { date: string; title: string; relax_before: number; relax_during: number; helped: number }[]
  reviews: Review[]
  hidden_by_patient: string[]
}

export interface EegFrame {
  t: number; phase: 'before' | 'during'; ok: boolean
  theta: number; alpha: number; beta: number; ratio: number; relax: number
  raw: number[]
}
export interface EegSummary {
  relax_before: number; relax_during: number
  alpha_before: number; alpha_during: number; alpha_change_pct: number | null
  quality_pct: number
}

// ---------- calls ----------
export const api = {
  patients: () => req<PatientRef[]>('/patients'),
  today: (pid: string) => req<Today>(`/patients/${pid}/today${todQuery()}`),
  trends: (pid: string, days = 30) => req<{ signals: Series[] }>(`/patients/${pid}/trends?days=${days}`),
  checkIn: (pid: string, body: CheckInValues) => post<CheckInResult>(`/patients/${pid}/checkins`, body),
  chatInfo: (pid: string) => req<{ available: boolean; opening: string }>(`/patients/${pid}/checkin-chat`),
  chat: (pid: string, messages: ChatMessage[], wrap_up = false) =>
    post<ChatReply>(`/patients/${pid}/checkin-chat`, { messages, wrap_up }),
  brainActivities: () => req<BrainActivity[]>('/patients/brain-activities'),
  brainSession: (pid: string, body: { intervention_id: string; relax_before: number; relax_during: number; alpha_change_pct?: number | null; quality_pct?: number }) =>
    post<BrainSessionResult>(`/patients/${pid}/brain-session${todQuery()}`, body),
  reaction: (pid: string, median_ms: number, trials: number[]) =>
    post<{ ok: boolean; usual: number | null; today: number }>(`/patients/${pid}/reaction`, { median_ms, trials }),
  suggestion: (pid: string, exclude: string[] = []) =>
    req<SuggestionResponse>(`/patients/${pid}/suggestion?exclude=${exclude.join(',')}${todQuery('&')}`),
  feedback: (pid: string, body: { intervention_id: string; answer: 'yes' | 'a_bit' | 'no'; mood_before?: number; mood_after?: number }) =>
    post<SuggestionResponse & { logged: unknown }>(`/patients/${pid}/feedback${todQuery()}`, body),
  sharing: (pid: string) => req<{ sharing: Record<string, boolean>; labels: Record<string, string> }>(`/patients/${pid}/sharing`),
  setSharing: (pid: string, body: Record<string, boolean>) =>
    req<{ sharing: Record<string, boolean>; labels: Record<string, string> }>(`/patients/${pid}/sharing`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteData: (pid: string) => req<{ ok: boolean }>(`/patients/${pid}/data`, { method: 'DELETE' }),

  overview: () => req<ClinicOverview>('/clinic/overview'),
  clinicPatient: (pid: string) => req<ClinicDetail>(`/clinic/patients/${pid}`),
  review: (pid: string, action: Review['action'], note?: string) =>
    post<{ ok: boolean }>(`/clinic/patients/${pid}/review`, { action, note }),

  eegSession: () => req<{ source: string; frames: EegFrame[]; summary: EegSummary; trace_hz: number }>('/eeg/session'),
  eegSocketUrl: (speed = 2) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}${BASE}/eeg/stream?speed=${speed}`
  },

  reset: () => post<{ ok: boolean }>('/demo/reset', {}),
}
