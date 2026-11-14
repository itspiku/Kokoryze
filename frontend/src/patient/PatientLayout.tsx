import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { TimeOfDay } from '../api'
import { BrainIcon, ChatIcon, HomeIcon, LockIcon, TrendIcon } from '../components/icons'
import { Logo } from '../components/ui'
import { getDemoTod, setDemoTod } from '../demoTime'
import { useApi } from '../useApi'

const NAV = [
  { to: '', label: 'Today', Icon: HomeIcon },
  { to: 'checkin', label: 'Check-in', Icon: ChatIcon },
  { to: 'trends', label: 'Trends', Icon: TrendIcon },
  { to: 'brain', label: 'Brain', Icon: BrainIcon },
  { to: 'privacy', label: 'Privacy', Icon: LockIcon },
]

const PERSONA_HINT: Record<string, string> = {
  anna: 'Stable, normal ups and downs',
  ben: 'Slowly declining for 2 weeks',
  chloe: 'Stopped sending data',
  david: 'Stressful week, recovered',
  eva: 'Mood dropping, sensors normal',
  farid: 'Crisis wording today',
}

function TimeSelect({ className = '' }: { className?: string }) {
  return (
    <select defaultValue={getDemoTod()} aria-label="Demo time of day"
      onChange={(e) => { setDemoTod(e.target.value as TimeOfDay | ''); location.reload() }}
      className={`rounded-lg bg-white px-2 py-1.5 text-sm text-ink ring-1 ring-black/10 ${className}`}>
      <option value="">Real clock</option>
      <option value="morning">Morning</option>
      <option value="afternoon">Afternoon</option>
      <option value="evening">Evening</option>
    </select>
  )
}

export default function PatientLayout() {
  const { pid = 'ben' } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const { data: people } = useApi(() => api.patients(), [])
  const sub = loc.pathname.split('/').slice(3).join('/')
  const switchTo = (id: string) =>
    nav(`/patient/${id}${sub && !sub.startsWith('activity') && sub !== 'crisis' ? '/' + sub : ''}`)

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-cream to-sand">
      {/* compact demo bar on phones and tablets */}
      <div className="flex items-center gap-2 border-b border-black/5 bg-white/80 px-3 py-2 backdrop-blur lg:hidden">
        <Link to="/" aria-label="Kokoryze home"><Logo /></Link>
        <select value={pid} onChange={(e) => switchTo(e.target.value)} aria-label="Demo persona"
          className="ml-auto min-w-0 flex-1 rounded-lg bg-white px-2 py-1.5 text-sm ring-1 ring-black/10 sm:flex-none">
          {people?.map((p) => <option key={p.id} value={p.id}>{p.name}: {PERSONA_HINT[p.id]}</option>)}
        </select>
        <TimeSelect className="hidden sm:block" />
        <Link to="/clinic" className="text-sm font-medium whitespace-nowrap text-sage-700">Clinic →</Link>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:px-4 sm:py-6 lg:flex-row lg:items-start lg:justify-center lg:py-10">
        {/* demo controls beside the phone on large screens */}
        <aside className="hidden w-64 lg:sticky lg:top-10 lg:block">
          <Link to="/"><Logo /></Link>
          <p className="mt-2 text-sm text-muted">Patient app demo. Pick a persona:</p>
          <div className="mt-3 grid gap-2">
            {people?.map((p) => (
              <button key={p.id} onClick={() => switchTo(p.id)}
                className={`rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${p.id === pid
                  ? 'bg-sage-600 text-white ring-sage-600' : 'bg-white ring-black/5 hover:bg-sage-50'}`}>
                <div className="font-medium">{p.name}, {p.age}</div>
                <div className={`text-xs ${p.id === pid ? 'text-white/80' : 'text-muted'}`}>{PERSONA_HINT[p.id]}</div>
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs text-muted">
            Demo time of day
            <TimeSelect className="mt-1 block w-full" />
          </label>
          <Link to="/clinic" className="mt-4 inline-block text-sm font-medium text-sage-700 hover:underline">
            → Open clinician dashboard
          </Link>
        </aside>

        {/* the app: full screen on phones, inside a phone frame on bigger screens */}
        <div className="relative w-full overflow-hidden bg-cream sm:max-w-[400px] sm:rounded-[2.5rem] sm:border-[10px] sm:border-ink sm:shadow-2xl">
          <div className="flex h-[calc(100dvh-53px)] flex-col sm:h-[min(820px,calc(100vh-7rem))] sm:min-h-[640px] lg:h-[min(820px,calc(100vh-3rem))]">
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
            {sub !== 'crisis' && (
              <nav className="grid grid-cols-5 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
                {NAV.map(({ to, label, Icon }) => (
                  <NavLink key={label} to={to ? `/patient/${pid}/${to}` : `/patient/${pid}`} end={!to}
                    className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] transition ${isActive
                      ? 'font-semibold text-sage-700' : 'text-muted hover:text-ink'}`}>
                    <Icon width={20} height={20} />{label}
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
