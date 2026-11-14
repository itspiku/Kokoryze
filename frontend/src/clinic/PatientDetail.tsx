import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Review } from '../api'
import BaselineChart from '../components/BaselineChart'
import { Disclaimer, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { useApi } from '../useApi'
import { daysAgo, fmtDay } from '../dates'
import ClinicShell from './ClinicShell'

const ACTION_LABEL: Record<Review['action'], string> = {
  reviewed: 'Marked as reviewed',
  call_scheduled: 'Call scheduled',
  message_sent: 'Message sent',
}

const HIDDEN_LABEL: Record<string, string> = {
  sleep: 'sleep', activity: 'activity', heart: 'heart data', cognitive: 'reaction game',
  mood: 'check-in answers', notes: 'check-in notes', safety: 'safety alerts',
}

export default function PatientDetail() {
  const { pid = '' } = useParams()
  const { data, error, loading, reload } = useApi(() => api.clinicPatient(pid), [pid])
  const [note, setNote] = useState('')

  async function act(action: Review['action']) {
    await api.review(pid, action, note.trim() || undefined)
    setNote('')
    reload()
  }

  return (
    <ClinicShell>
      <Link to="/clinic" className="text-sm text-slate-500 hover:underline">← All patients</Link>
      {error && <ErrorBox error={error} />}
      {loading && !data && <Loading />}
      {data && (
        <div className="mt-3 grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">{data.name}</h1>
                  <div className="text-sm text-slate-500">{data.age} y · {data.weeks_since_tms} weeks after TMS course</div>
                </div>
                <StatusBadge status={data.status} label={data.status_label} />
              </div>
              {data.changing_since && (
                <p className="mt-3 inline-block rounded-lg bg-orange-50 px-2.5 py-1 text-xs text-orange-800">
                  Changes began around {fmtDay(data.changing_since)}, {daysAgo(data.changing_since)} days ago
                </p>
              )}
              <h2 className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Why</h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-800">
                {data.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {data.hidden_by_patient.length > 0 && (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                  🔒 The patient chose not to share: {data.hidden_by_patient.map((h) => HIDDEN_LABEL[h] ?? h).join(', ')}.
                </p>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              {data.series.map((s) => (
                <div key={s.key} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${s.changed ? 'ring-orange-200' : 'ring-black/5'}`}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-medium">{s.label}</h3>
                    {s.changed
                      ? <span className="text-xs font-medium text-review">Sustained change</span>
                      : <span className="text-xs text-slate-400">usual range</span>}
                  </div>
                  <BaselineChart s={s} height={130} />
                </div>
              ))}
            </section>
            <p className="text-xs text-slate-500">
              Shaded band = this person's usual range (first 14 days at home). Orange dots = unusual days.
              Dashed orange line = roughly when a sustained change began.
            </p>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="font-semibold">Follow-up</h2>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)"
                className="mt-3 w-full rounded-lg bg-slate-50 p-2 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-sage-500 focus:outline-none" />
              <div className="mt-2 grid gap-2">
                <button onClick={() => act('call_scheduled')} className="rounded-lg bg-sage-600 py-2 text-sm font-medium text-white hover:bg-sage-700">📞 Schedule call</button>
                <button onClick={() => act('message_sent')} className="rounded-lg bg-sage-50 py-2 text-sm font-medium text-sage-700 hover:bg-sage-100">💬 Send check-in message</button>
                <button onClick={() => act('reviewed')} className="rounded-lg py-2 text-sm font-medium text-slate-600 ring-1 ring-black/10 hover:bg-slate-50">✓ Mark as reviewed</button>
              </div>
              {data.reviews.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-black/5 pt-3 text-xs text-slate-600">
                  {data.reviews.map((r, i) => (
                    <li key={i}><b>{ACTION_LABEL[r.action]}</b> · {fmtDay(r.date)} {r.time}{r.note ? `: ${r.note}` : ''}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="font-semibold">What helps this person</h2>
              <p className="text-xs text-slate-500">From their own "did this help?" answers</p>
              <ul className="mt-3 space-y-2 text-sm">
                {data.interventions.slice(0, 6).map((h) => (
                  <li key={h.id}>
                    <div className="flex justify-between"><span>{h.title}</span><span className="text-slate-500">{h.helped}/{h.tried}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sage-500" style={{ width: `${(h.helped / h.tried) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {data.interventions.length === 0 && <li className="text-slate-500">No activity feedback yet.</li>}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="font-semibold">Brain sessions</h2>
              <p className="text-xs text-slate-500">EEG relaxation index before → during a calming activity</p>
              <ul className="mt-3 space-y-2 text-sm">
                {data.brain_sessions.map((b, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <div>
                      <div>{b.title}</div>
                      <div className="text-xs text-slate-500">{fmtDay(b.date)}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${b.helped >= 1
                      ? 'bg-emerald-50 text-emerald-800' : b.helped > 0 ? 'bg-yellow-50 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                      {Math.round(b.relax_before)} → {Math.round(b.relax_during)}
                    </span>
                  </li>
                ))}
                {data.brain_sessions.length === 0 && <li className="text-slate-500">No brain sessions yet.</li>}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="font-semibold">Check-in notes</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.notes.map((n, i) => (
                  <li key={i} className={n.crisis ? 'rounded-lg bg-red-50 p-2 text-red-900' : ''}>
                    <span className="text-xs text-slate-500">{fmtDay(n.date, true)}</span>
                    <div>{n.crisis && '⚠️ '}{n.text}</div>
                  </li>
                ))}
                {data.notes.length === 0 && <li className="text-slate-500">No notes shared.</li>}
              </ul>
            </section>
            <Disclaimer />
          </aside>
        </div>
      )}
    </ClinicShell>
  )
}
