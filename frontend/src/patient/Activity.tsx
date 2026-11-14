import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Activity as ActivityT, SuggestionResponse } from '../api'
import { CategoryIcon } from '../components/icons'
import { Button, Card, Loading } from '../components/ui'

type Phase = 'before' | 'doing' | 'after' | 'learned'

function MoodPick({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} onClick={() => onChange(n)}
          className={`aspect-square rounded-lg text-sm font-medium ${value === n ? 'bg-sage-600 text-white' : 'bg-sand'}`}>{n}</button>
      ))}
    </div>
  )
}

/** Seconds left while `running`; calls onDone once when it reaches zero. */
function useCountdown(seconds: number, running: boolean, onDone: () => void) {
  const [elapsed, setElapsed] = useState(0)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((e) => {
      if (e + 1 >= seconds) { clearInterval(id); done.current() }
      return e + 1
    }), 1000)
    return () => clearInterval(id)
  }, [running, seconds])
  return Math.max(0, seconds - elapsed)
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Breathing() {
  const [label, setLabel] = useState('Breathe in')
  useEffect(() => {
    const steps = ['Breathe in', 'Hold', 'Breathe out', 'Hold']
    let i = 0
    const id = setInterval(() => { i = (i + 1) % 4; setLabel(steps[i]) }, 4000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <div className="motion-safe-anim absolute inset-0 rounded-full bg-gradient-to-br from-sage-300 to-lilac opacity-80"
          style={{ animation: 'breathe 16s ease-in-out infinite' }} />
        <span className="relative text-lg font-medium text-ink">{label}</span>
      </div>
    </div>
  )
}

function Nature() {
  return (
    <div className="motion-safe-anim my-4 flex h-56 items-end rounded-3xl p-4 text-white"
      style={{
        background: 'linear-gradient(120deg,#24604f,#3f9581,#9cc9b9,#b8b2e6,#24604f)',
        backgroundSize: '400% 400%', animation: 'drift 30s ease infinite',
      }}>
      <span className="text-sm opacity-90">🌲 Forest sounds · colours shift slowly to pace your breathing</span>
    </div>
  )
}

function Message() {
  const [copied, setCopied] = useState(false)
  const text = "Hey! Was thinking of you. How's your week going?"
  return (
    <Card className="my-4">
      <div className="text-xs text-muted">A message you could send</div>
      <p className="mt-1 text-sm">"{text}"</p>
      <Button variant="soft" className="mt-3 w-full" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true) }}>
        {copied ? 'Copied ✓' : 'Copy message'}
      </Button>
    </Card>
  )
}

export default function Activity() {
  const { pid = 'ben', iid = '' } = useParams()
  const loc = useLocation()
  const nav = useNavigate()
  const [a, setA] = useState<ActivityT | null>((loc.state as { activity?: ActivityT } | null)?.activity ?? null)
  const [phase, setPhase] = useState<Phase>('before')
  const [moodBefore, setMoodBefore] = useState<number | null>(null)
  const [moodAfter, setMoodAfter] = useState<number | null>(null)
  const [answer, setAnswer] = useState<'yes' | 'a_bit' | 'no' | null>(null)
  const [next, setNext] = useState<SuggestionResponse | null>(null)
  const left = useCountdown((a?.duration_min ?? 3) * 60, phase === 'doing', () => setPhase('after'))

  useEffect(() => {
    if (a) return
    api.suggestion(pid).then((s) => {
      setA([s.suggestion, ...s.alternatives].find((x) => x?.id === iid) ?? null)
    })
  }, [a, pid, iid])

  if (!a) return <Loading />

  async function sendFeedback() {
    if (!answer || !a) return
    const r = await api.feedback(pid, {
      intervention_id: a.id, answer,
      mood_before: moodBefore ?? undefined, mood_after: moodAfter ?? undefined,
    })
    setNext(r)
    setPhase('learned')
  }

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-start gap-3 pt-2">
        <CategoryIcon category={a.category} />
        <div>
          <h1 className="text-xl font-semibold">{a.title}</h1>
          <div className="text-xs text-muted">{a.duration_min} min · {a.category}</div>
        </div>
      </header>

      {phase === 'before' && (
        <>
          <Card>
            <p className="text-sm">{a.instructions}</p>
          </Card>
          <Card>
            <div className="text-sm font-medium">Before you start: how's your mood right now?</div>
            <div className="mt-3"><MoodPick value={moodBefore} onChange={setMoodBefore} /></div>
          </Card>
          <Button className="w-full py-3" onClick={() => setPhase('doing')}>Begin</Button>
        </>
      )}

      {phase === 'doing' && (
        <>
          {a.screen === 'breathing' && <Breathing />}
          {a.screen === 'nature' && <Nature />}
          {a.screen === 'message' && <Message />}
          {a.screen === 'timer' && (
            <Card className="my-4 text-center">
              <p className="text-sm">{a.instructions}</p>
            </Card>
          )}
          <div className="text-center text-4xl font-light tabular-nums text-sage-700">{mmss(left)}</div>
          <Button variant="soft" className="w-full" onClick={() => setPhase('after')}>I'm done</Button>
        </>
      )}

      {phase === 'after' && (
        <>
          <Card>
            <div className="font-medium">Did this help?</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([['yes', 'Yes 😊'], ['a_bit', 'A bit 🙂'], ['no', 'Not really']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setAnswer(k)}
                  className={`rounded-xl py-3 text-sm font-medium ${answer === k ? 'bg-sage-600 text-white' : 'bg-sand'}`}>{l}</button>
              ))}
            </div>
          </Card>
          <Card>
            <div className="text-sm font-medium">And your mood now? <span className="font-normal text-muted">(optional)</span></div>
            <div className="mt-3"><MoodPick value={moodAfter} onChange={setMoodAfter} /></div>
          </Card>
          <Button className="w-full py-3" disabled={!answer} onClick={sendFeedback}>Save</Button>
        </>
      )}

      {phase === 'learned' && next && (
        <>
          <Card className="text-center">
            <div className="text-4xl">{answer === 'no' ? '🤝' : '✨'}</div>
            <h2 className="mt-2 font-semibold">
              {answer === 'no' ? "Thanks for telling us. We'll suggest it less." : "Great. We'll remember this works for you."}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Every answer teaches Kokoryze what helps <em>you</em>.
            </p>
          </Card>
          {next.suggestion && (
            <Card>
              <div className="text-xs font-medium uppercase tracking-wide text-sage-700">Next time you feel {next.state_label}</div>
              <ol className="mt-2 space-y-1 text-sm">
                {[next.suggestion, ...next.alternatives].map((x, i) => (
                  <li key={x.id} className="flex justify-between">
                    <span>{i + 1}. {x.title}</span>
                    <span className="text-muted">helped ~{Math.round(x.expected_help * 100)}% of the time</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          <Button className="w-full" onClick={() => nav(`/patient/${pid}`)}>Back to today</Button>
        </>
      )}

      {phase !== 'learned' && (
        <Link to={`/patient/${pid}`} className="block text-center text-sm text-muted">Cancel</Link>
      )}
    </div>
  )
}
