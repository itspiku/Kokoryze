import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { ClinicRow, Status } from '../api'
import Sparkline from '../components/Sparkline'
import { Disclaimer, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { useApi } from '../useApi'
import { daysAgo, fmtDay } from '../dates'
import ClinicShell from './ClinicShell'

const SUMMARY: { key: Status; label: string; cls: string }[] = [
  { key: 'urgent', label: 'urgent', cls: 'text-urgent' },
  { key: 'review', label: 'to review', cls: 'text-review' },
  { key: 'missing', label: 'missing data', cls: 'text-missing' },
  { key: 'watch', label: 'keep an eye', cls: 'text-watch' },
  { key: 'stable', label: 'stable', cls: 'text-stable' },
]

const REFRESH_MS = 5000 // live updates, so a crisis check-in shows up during the demo

function ago(d: string | null) {
  const n = daysAgo(d)
  if (n == null) return 'never'
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`
}

function since(d: string) {
  return `${fmtDay(d)} (${daysAgo(d)} days)`
}

function Row({ p }: { p: ClinicRow }) {
  const nav = useNavigate()
  return (
    <tr onClick={() => nav(`/clinic/${p.id}`)}
      className={`flex cursor-pointer flex-col gap-1.5 px-4 py-3 hover:bg-slate-50 md:table-row md:p-0 ${p.status === 'urgent' ? 'bg-red-50/50' : ''}`}>
      <td className="md:w-48 md:px-4 md:py-3.5 md:align-top">
        <StatusBadge status={p.status} label={p.status_label} />
        {p.reviewed_today && (
          <div className="mt-1 text-xs text-slate-500">✓ {p.last_review?.action === 'call_scheduled' ? 'Call scheduled' : p.last_review?.action === 'message_sent' ? 'Messaged' : 'Reviewed'} today</div>
        )}
      </td>
      <td className="md:px-4 md:py-3.5 md:align-top">
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-slate-500">{p.age} y · {p.weeks_since_tms} weeks after TMS</div>
      </td>
      <td className="max-w-md text-slate-700 md:px-4 md:py-3.5 md:align-top">
        <ul className="space-y-0.5">
          {p.reasons.slice(0, 2).map((r) => <li key={r}>{r}</li>)}
        </ul>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
          {p.changing_since && <span className="text-orange-700">Changing since {since(p.changing_since)}</span>}
          {p.reasons.length > 2 && <span>+{p.reasons.length - 2} more</span>}
        </div>
      </td>
      <td className="md:px-4 md:py-3.5 md:align-top">
        {p.mood_trend
          ? <Sparkline values={p.mood_trend} usual={p.mood_usual} label={`${p.name} mood over 3 weeks`} />
          : <span className="text-xs text-slate-400">not shared</span>}
      </td>
      <td className="text-xs text-slate-600 md:px-4 md:py-3.5 md:align-top">
        <div>{p.changed_count} of {p.signals_tracked} signals changed</div>
        <div className="text-slate-400">Last data: {ago(p.last_data_date)}</div>
      </td>
      <td className="md:px-4 md:py-3.5 md:text-right md:align-top">
        <Link to={`/clinic/${p.id}`} className="font-medium whitespace-nowrap text-sage-700" onClick={(e) => e.stopPropagation()}>Review →</Link>
      </td>
    </tr>
  )
}

export default function PatientList() {
  const { data, error, loading, reload } = useApi(() => api.overview(), [])
  const [updated, setUpdated] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => { reload().then(() => setUpdated(new Date())) }, REFRESH_MS)
    return () => clearInterval(id)
  }, [reload])

  return (
    <ClinicShell>
      {error && <ErrorBox error={error} />}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Who might need a call today</h1>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                {data.patients.length} patients after TMS · sorted by attention needed
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live · {updated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {SUMMARY.filter((s) => data.counts[s.key] > 0).map((s) => (
                <span key={s.key}><b className={`text-lg ${s.cls}`}>{data.counts[s.key]}</b> {s.label}</span>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <table className="w-full text-left text-sm">
              <thead className="hidden bg-slate-50 text-xs uppercase tracking-wide text-slate-500 md:table-header-group">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Why</th>
                  <th className="px-4 py-3 font-medium">Mood, 3 weeks</th>
                  <th className="px-4 py-3 font-medium">Signals</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.patients.map((p) => <Row key={p.id} p={p} />)}
              </tbody>
            </table>
          </div>
          <Disclaimer className="mt-4" />
        </>
      )}
    </ClinicShell>
  )
}
