import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { TimeOfDay } from '../api'
import { Logo } from '../components/ui'
import { getDemoTod, setDemoTod } from '../demoTime'
import { useApi } from '../useApi'

const NAV = [
  { to: '', label: 'Today', icon: '🏠' },
  { to: 'checkin', label: 'Check-in', icon: '📝' },
  { to: 'trends', label: 'Trends', icon: '📈' },
  { to: 'brain', label: 'Brain', icon: '🧠' },
  { to: 'privacy', label: 'Privacy', icon: '🔒' },
]

const PERSONA_HINT: Record<string, string> = {
  anna: 'Stable, normal ups and downs',
  ben: 'Slowly declining for 2 weeks',
  chloe: 'Stopped sending data',
  david: 'Stressful week, recovered',
  eva: 'Mood dropping, sensors normal',
  farid: 'Crisis wording today',
}

export default function PatientLayout() {
  const { pid = 'ben' } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const { data: people } = useApi(() => api.patients(), [])
  const sub = loc.pathname.split('/').slice(3).join('/')

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-cream to-sand">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-6 lg:flex-row lg:items-start lg:justify-center lg:py-10">
        {/* demo controls (outside the phone) */}
        <aside className="w-full max-w-sm lg:sticky lg:top-10 lg:w-64">
          <Link to="/"><Logo /></Link>
          <p className="mt-2 text-sm text-muted">Patient app demo. Pick a persona:</p>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {people?.map((p) => (
              <button key={p.id}
                onClick={() => nav(`/patient/${p.id}${sub && !sub.startsWith('activity') && sub !== 'crisis' ? '/' + sub : ''}`)}
                className={`rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${p.id === pid
                  ? 'bg-sage-600 text-white ring-sage-600' : 'bg-white ring-black/5 hover:bg-sage-50'}`}>
                <div className="font-medium">{p.name}, {p.age}</div>
                <div className={`text-xs ${p.id === pid ? 'text-white/80' : 'text-muted'}`}>{PERSONA_HINT[p.id]}</div>
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs text-muted">
            Demo time of day
            <select defaultValue={getDemoTod()}
              onChange={(e) => { setDemoTod(e.target.value as TimeOfDay | ''); location.reload() }}
              className="mt-1 block w-full rounded-lg bg-white px-2 py-1.5 text-sm text-ink ring-1 ring-black/10">
              <option value="">Use real clock</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </label>
          <Link to="/clinic" className="mt-4 inline-block text-sm font-medium text-sage-700 hover:underline">
            → Open clinician dashboard
          </Link>
        </aside>

        {/* the phone */}
        <div className="relative w-full max-w-[400px] overflow-hidden rounded-[2.5rem] border-[10px] border-ink bg-cream shadow-2xl">
          <div className="flex h-[min(820px,calc(100vh-3rem))] min-h-[640px] flex-col">
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
            {sub !== 'crisis' && (
              <nav className="grid grid-cols-5 border-t border-black/5 bg-white/90 backdrop-blur">
                {NAV.map((n) => (
                  <NavLink key={n.label} to={n.to ? `/patient/${pid}/${n.to}` : `/patient/${pid}`} end={!n.to}
                    className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive
                      ? 'font-semibold text-sage-700' : 'text-muted'}`}>
                    <span className="text-lg leading-none">{n.icon}</span>{n.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
