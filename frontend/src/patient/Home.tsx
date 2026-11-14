import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Activity, WeekCompare } from '../api'
import { BoltIcon, BrainIcon, CategoryIcon } from '../components/icons'
import { Button, Card, ErrorBox, Loading } from '../components/ui'
import { useApi } from '../useApi'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function fmt(c: WeekCompare, v: number) {
  if (c.key === 'steps') return Math.round(v).toLocaleString()
  if (c.key === 'sleep_hours') return `${v.toFixed(1)} h`
  return `${v.toFixed(1)}/10`
}

function CompareBar({ c }: { c: WeekCompare }) {
  const max = 1.5
  const w = Math.min(c.ratio, max) / max * 100
  const tone = c.tone === 'usual' ? 'bg-sage-500' : 'bg-peach'
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{c.label}</span>
        <span className="text-muted">{fmt(c, c.week)} <span className="text-xs">(usual {fmt(c, c.usual)})</span></span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full bg-sand">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${w}%` }} />
        <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink/50" style={{ left: `${100 / max}%` }} title="Your usual" />
      </div>
    </div>
  )
}

export function ActivityCard({ a, pid, label }: { a: Activity; pid: string; label?: string }) {
  const nav = useNavigate()
  return (
    <div className="rounded-2xl bg-sage-50 p-4 ring-1 ring-sage-100">
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-sage-700">{label}</div>}
      <div className="flex items-start gap-3">
        <CategoryIcon category={a.category} />
        <div className="flex-1">
          <div className="font-semibold">{a.title}</div>
          <div className="text-xs text-muted">{a.duration_min} min · {a.category}</div>
          <p className="mt-2 text-sm text-ink/80">{a.why}</p>
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={() => nav(`/patient/${pid}/activity/${a.id}`, { state: { activity: a } })}>
        Start
      </Button>
    </div>
  )
}

export default function Home() {
  const { pid = 'ben' } = useParams()
  const { data, error, loading } = useApi(() => api.today(pid), [pid])
  const [showAlt, setShowAlt] = useState(false)

  if (error) return <ErrorBox error={error} />
  if (loading || !data) return <Loading />

  const lower = data.week_vs_normal.filter((c) => c.tone !== 'usual').map((c) => c.label.toLowerCase())
  const list = lower.length > 1 ? `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}` : lower[0]
  const gentle = lower.length
    ? `Your ${list} ${lower.length > 1 ? 'have' : 'has'} been different from your usual this week. That's okay. Want to try something that often helps you?`
    : "You're within your usual range this week. Nice work keeping your routine."

  return (
    <div className="space-y-4 p-5">
      <header className="pt-2">
        <div className="text-sm text-muted">Day {data.days_since_tms} at home</div>
        <h1 className="text-2xl font-semibold">{greeting()}, {data.patient.first_name}</h1>
      </header>

      {data.checked_in_today ? (
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Checked in today ✓</div>
            <div className="text-xs text-muted">Mood {data.today.mood}/10 · Energy {data.today.energy}/10 · {data.streak}-day streak 🔥</div>
          </div>
          <Link to={`/patient/${pid}/checkin`} className="text-xs font-medium text-sage-700">Update</Link>
        </Card>
      ) : (
        <Link to={`/patient/${pid}/checkin`} className="block rounded-2xl bg-sage-600 p-4 text-white shadow-sm">
          <div className="font-semibold">How are you today?</div>
          <div className="text-sm text-white/80">30-second check-in →</div>
        </Link>
      )}

      <Card>
        <h2 className="font-semibold">Your week vs. your normal</h2>
        <div className="mt-3 space-y-3">
          {data.week_vs_normal.map((c) => <CompareBar key={c.key} c={c} />)}
          {data.week_vs_normal.length === 0 && <p className="text-sm text-muted">Not enough recent data yet.</p>}
        </div>
        <p className="mt-3 text-sm text-ink/80">{gentle}</p>
      </Card>

      {data.suggestion && (
        <div>
          <ActivityCard a={data.suggestion} pid={pid} label={`For when you feel ${data.state_label}`} />
          {data.alternatives.length > 0 && (
            <button onClick={() => setShowAlt((s) => !s)} className="mt-2 w-full text-center text-sm text-sage-700">
              {showAlt ? 'Hide other ideas' : 'Try something else'}
            </button>
          )}
          {showAlt && (
            <div className="mt-2 space-y-2">
              {data.alternatives.map((a) => (
                <ActivityCard key={a.id} a={a} pid={pid} label={a.explore ? 'Something new to try' : 'Another option'} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to={`/patient/${pid}/game`} className="rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-sage-300">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach/40 text-[#9a5a26]"><BoltIcon /></span>
          <div className="mt-2 text-sm font-semibold">Reaction game</div>
          <div className="text-xs text-muted">
            {data.today.reaction_ms ? `Played today ✓ ${data.today.reaction_ms} ms` : '30 seconds · not played today'}
          </div>
        </Link>
        <Link to={`/patient/${pid}/brain`} className="rounded-2xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-sage-300">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lilac/30 text-[#5b54a8]"><BrainIcon /></span>
          <div className="mt-2 text-sm font-semibold">Brain session</div>
          <div className="text-xs text-muted">See what relaxes you</div>
        </Link>
      </div>
    </div>
  )
}
