import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Status } from '../api'
import { Disclaimer, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { useApi } from '../useApi'
import ClinicShell from './ClinicShell'

const SUMMARY: { key: Status; label: string; cls: string }[] = [
  { key: 'urgent', label: 'urgent', cls: 'text-urgent' },
  { key: 'review', label: 'to review', cls: 'text-review' },
  { key: 'missing', label: 'missing data', cls: 'text-missing' },
  { key: 'watch', label: 'keep an eye', cls: 'text-watch' },
  { key: 'stable', label: 'stable', cls: 'text-stable' },
]

function ago(d: string | null) {
  if (!d) return 'never'
  const days = Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
}

export default function PatientList() {
  const nav = useNavigate()
  const { data, error, loading } = useApi(() => api.overview(), [])

  return (
    <ClinicShell>
      {error && <ErrorBox error={error} />}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Who might need a call today</h1>
              <p className="text-sm text-slate-500">
                {data.patients.length} patients after TMS · sorted by attention needed
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
                  <th className="px-4 py-3 font-medium">Changed</th>
                  <th className="px-4 py-3 font-medium">Last data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.patients.map((p) => (
                  <tr key={p.id} onClick={() => nav(`/clinic/${p.id}`)}
                    className="flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-slate-50 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3.5 md:align-top">
                      <StatusBadge status={p.status} label={p.status_label} />
                      {p.reviewed_today && (
                        <div className="mt-1 text-xs text-slate-500">✓ {p.last_review?.action === 'call_scheduled' ? 'Call scheduled' : 'Reviewed'} today</div>
                      )}
                    </td>
                    <td className="md:px-4 md:py-3.5 md:align-top">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.age} y · {p.weeks_since_tms} weeks after TMS</div>
                    </td>
                    <td className="max-w-md text-slate-700 md:px-4 md:py-3.5 md:align-top">
                      <ul className="space-y-0.5">
                        {p.reasons.slice(0, 2).map((r) => <li key={r}>{r}</li>)}
                        {p.reasons.length > 2 && <li className="text-xs text-slate-400">+{p.reasons.length - 2} more</li>}
                      </ul>
                    </td>
                    <td className="text-slate-600 md:px-4 md:py-3.5 md:align-top">
                      <span className="md:hidden">Changed: </span>{p.changed_count} of {p.signals_tracked}
                    </td>
                    <td className="text-slate-600 md:px-4 md:py-3.5 md:align-top">
                      <span className="md:hidden">Last data: </span>{ago(p.last_data_date)}
                    </td>
                    <td className="md:px-4 md:py-3.5 md:text-right md:align-top">
                      <Link to={`/clinic/${p.id}`} className="font-medium text-sage-700" onClick={(e) => e.stopPropagation()}>Review →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Disclaimer className="mt-4" />
        </>
      )}
    </ClinicShell>
  )
}
