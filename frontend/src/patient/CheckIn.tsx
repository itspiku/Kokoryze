import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Card } from '../components/ui'

function Slider({ label, value, onChange, low, high }: {
  label: string; value: number; onChange: (v: number) => void; low: string; high: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="font-medium">{label}</label>
        <span className="text-lg font-semibold text-sage-700">{value}</span>
      </div>
      <input type="range" min={1} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-sage-600" aria-label={label} />
      <div className="flex justify-between text-xs text-muted"><span>{low}</span><span>{high}</span></div>
    </div>
  )
}

const SLEEP = ['😫', '😕', '😐', '🙂', '😴']

export default function CheckIn() {
  const { pid = 'ben' } = useParams()
  const nav = useNavigate()
  const [mood, setMood] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [anxiety, setAnxiety] = useState(3)
  const [sleep, setSleep] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const r = await api.checkIn(pid, { mood, energy, anxiety, sleep_quality: sleep ?? undefined, notes: notes.trim() || undefined })
      if (r.crisis) {
        nav(`/patient/${pid}/crisis`, { state: { resources: r.resources, notified: r.clinic_notified } })
        return
      }
      setDone(true)
      setTimeout(() => nav(`/patient/${pid}`), 1200)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl">🌱</div>
        <h2 className="mt-3 text-xl font-semibold">Thanks for checking in</h2>
        <p className="mt-1 text-sm text-muted">Every check-in helps us understand your normal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Daily check-in</h1>
        <p className="text-sm text-muted">About 30 seconds. There are no right answers.</p>
      </header>

      <Card className="space-y-5">
        <Slider label="Mood" value={mood} onChange={setMood} low="Very low" high="Great" />
        <Slider label="Energy" value={energy} onChange={setEnergy} low="Exhausted" high="Full of energy" />
        <Slider label="Anxiety" value={anxiety} onChange={setAnxiety} low="Calm" high="Very anxious" />
        <div>
          <div className="font-medium">How did you sleep?</div>
          <div className="mt-2 flex justify-between">
            {SLEEP.map((e, i) => (
              <button key={e} onClick={() => setSleep(i + 1)} aria-label={`Sleep quality ${i + 1} of 5`}
                className={`h-11 w-11 rounded-full text-2xl transition ${sleep === i + 1 ? 'bg-sage-100 ring-2 ring-sage-500' : 'bg-sand'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="font-medium" htmlFor="notes">Anything on your mind? <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="A sentence is plenty."
            className="mt-2 w-full rounded-xl border-0 bg-sand p-3 text-sm ring-1 ring-black/5 focus:ring-2 focus:ring-sage-500 focus:outline-none" />
        </div>
      </Card>

      <Button className="w-full py-3" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save check-in'}</Button>
      <p className="text-center text-xs text-muted">You choose what your clinic sees in Privacy.</p>
    </div>
  )
}
