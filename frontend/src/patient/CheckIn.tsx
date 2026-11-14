import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import type { ChatMessage, ChatProposal, CheckInValues } from '../api'
import { SendIcon, SparkIcon } from '../components/icons'
import { Button, Card } from '../components/ui'

function Slider({ label, value, onChange, low, high, max = 10 }: {
  label: string; value: number; onChange: (v: number) => void; low: string; high: string; max?: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="font-medium">{label}</label>
        <span className="text-lg font-semibold text-sage-700">{value}</span>
      </div>
      <input type="range" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-sage-600" aria-label={label} />
      <div className="flex justify-between text-xs text-muted"><span>{low}</span><span>{high}</span></div>
    </div>
  )
}

const SLEEP = ['😫', '😕', '😐', '🙂', '😴']

/** The slider form. Also used to confirm what the AI chat understood. */
function CheckInForm({ initial, onSubmit, busy, submitLabel }: {
  initial?: Partial<ChatProposal>; onSubmit: (v: CheckInValues) => void; busy: boolean; submitLabel: string
}) {
  const [mood, setMood] = useState(initial?.mood ?? 5)
  const [energy, setEnergy] = useState(initial?.energy ?? 5)
  const [anxiety, setAnxiety] = useState(initial?.anxiety ?? 3)
  const [sleep, setSleep] = useState<number | null>(initial?.sleep_quality ?? null)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <>
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
      <Button className="w-full py-3" disabled={busy}
        onClick={() => onSubmit({ mood, energy, anxiety, sleep_quality: sleep ?? undefined, notes: notes.trim() || undefined })}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine
        ? 'rounded-br-md bg-sage-600 text-white' : 'rounded-bl-md bg-white text-ink ring-1 ring-black/5'}`}>
        {m.content}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex justify-start" aria-label="Kokoryze is typing">
      <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 ring-1 ring-black/5">
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  )
}

function Chat({ pid, opening, onProposal, onUnavailable, onCrisis }: {
  pid: string; opening: string
  onProposal: (p: ChatProposal) => void
  onUnavailable: (typed: string) => void
  onCrisis: (state: unknown) => void
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  async function send(content: string, wrapUp = false) {
    if (!content.trim() || busy) return
    const next: ChatMessage[] = [...msgs, { role: 'user', content: content.trim() }]
    setMsgs(next)
    setText('')
    setBusy(true)
    try {
      const r = await api.chat(pid, next, wrapUp)
      setMsgs([...next, { role: 'assistant', content: r.reply }])
      if (r.crisis) { onCrisis({ resources: r.resources, notified: r.clinic_notified }); return }
      if (r.done && r.proposal) setTimeout(() => onProposal(r.proposal!), 900)
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        onUnavailable(next.filter((m) => m.role === 'user').map((m) => m.content).join(' '))
      } else {
        setMsgs([...next, { role: 'assistant', content: "Sorry, I couldn't send that. Please try again." }])
      }
    } finally {
      setBusy(false)
    }
  }

  const userTurns = msgs.filter((m) => m.role === 'user').length

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2.5">
        <Bubble m={{ role: 'assistant', content: opening }} />
        {msgs.map((m, i) => <Bubble key={i} m={m} />)}
        {busy && <Typing />}
        <div ref={end} />
      </div>

      <form className="sticky bottom-0 flex items-end gap-2 bg-cream/95 pt-2 pb-1 backdrop-blur"
        onSubmit={(e) => { e.preventDefault(); send(text) }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Type how you're doing…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
          aria-label="Your message"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border-0 bg-white px-3.5 py-2.5 text-sm ring-1 ring-black/10 focus:ring-2 focus:ring-sage-500 focus:outline-none" />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-600 text-white disabled:bg-sage-300">
          <SendIcon width={18} height={18} />
        </button>
      </form>
      {userTurns >= 2 && !busy && (
        <button onClick={() => send("That's all for today.", true)} className="text-center text-xs text-sage-700">
          I'm done, wrap up the check-in
        </button>
      )}
    </div>
  )
}

export default function CheckIn() {
  const { pid = 'ben' } = useParams()
  const nav = useNavigate()
  const [info, setInfo] = useState<{ available: boolean; opening: string } | null>(null)
  const [mode, setMode] = useState<'chat' | 'form' | 'confirm'>('form')
  const [proposal, setProposal] = useState<Partial<ChatProposal> | undefined>()
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.chatInfo(pid).then((i) => { setInfo(i); if (i.available) setMode('chat') }).catch(() => setInfo({ available: false, opening: '' }))
  }, [pid])

  async function save(v: CheckInValues) {
    setBusy(true)
    try {
      const r = await api.checkIn(pid, v)
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
        <p className="text-sm text-muted">
          {mode === 'confirm' ? "Here's what I understood. Adjust anything that's off." : 'About a minute. There are no right answers.'}
        </p>
      </header>

      {mode !== 'confirm' && (
        <div className="grid grid-cols-2 rounded-xl bg-sand p-1 text-sm" role="tablist">
          <button role="tab" aria-selected={mode === 'chat'} disabled={!info?.available}
            onClick={() => setMode('chat')}
            title={info?.available ? '' : 'Chat needs an Anthropic API key on the server'}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition disabled:opacity-50 ${mode === 'chat' ? 'bg-white shadow-sm' : 'text-muted'}`}>
            <SparkIcon width={16} height={16} /> Chat
          </button>
          <button role="tab" aria-selected={mode === 'form'} onClick={() => setMode('form')}
            className={`rounded-lg py-2 font-medium transition ${mode === 'form' ? 'bg-white shadow-sm' : 'text-muted'}`}>
            Quick form
          </button>
        </div>
      )}

      {notice && <p className="rounded-xl bg-peach/30 p-3 text-sm">{notice}</p>}
      {info && !info.available && mode === 'form' && (
        <p className="text-xs text-muted">Chat check-in turns on when the server has an Anthropic API key.</p>
      )}

      {mode === 'chat' && info?.available && (
        <Chat pid={pid} opening={info.opening}
          onProposal={(p) => { setProposal(p); setMode('confirm') }}
          onCrisis={(state) => nav(`/patient/${pid}/crisis`, { state })}
          onUnavailable={(typed) => {
            setNotice("Chat isn't available right now, so here's the quick form. Your words are in the notes.")
            setProposal({ notes: typed })
            setMode('form')
          }} />
      )}

      {mode === 'form' && <CheckInForm key={`form-${proposal?.notes ?? ''}`} initial={proposal} onSubmit={save} busy={busy} submitLabel="Save check-in" />}
      {mode === 'confirm' && <CheckInForm key="confirm" initial={proposal} onSubmit={save} busy={busy} submitLabel="Looks right, save" />}

      <p className="text-center text-xs text-muted">You choose what your clinic sees in Privacy.</p>
    </div>
  )
}
