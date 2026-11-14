import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { EegFrame, EegSummary } from '../api'
import { Button, Card } from '../components/ui'

const SPEED = 3          // replay speed (3 = 3x real time, ~40 s total)
const TRACE_POINTS = 200 // ~4 s of signal on screen

function Gauge({ value }: { value: number }) {
  // semicircle 0-100
  const angle = Math.PI * (1 - value / 100)
  const x = 100 + 80 * Math.cos(angle)
  const y = 100 - 80 * Math.sin(angle)
  return (
    <svg viewBox="0 0 200 115" className="w-full" role="img" aria-label={`Relaxation index ${Math.round(value)} of 100`}>
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="#f4b98a" />
          <stop offset="0.5" stopColor="#b8b2e6" />
          <stop offset="1" stopColor="#3f9581" />
        </linearGradient>
      </defs>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#f1ebe1" strokeWidth="16" strokeLinecap="round" />
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#g)" strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * 251.3} 251.3`} />
      <circle cx={x} cy={y} r="7" fill="#fff" stroke="#24604f" strokeWidth="3" />
      <text x="100" y="92" textAnchor="middle" className="fill-ink" style={{ fontSize: 30, fontWeight: 600 }}>{Math.round(value)}</text>
      <text x="100" y="110" textAnchor="middle" className="fill-muted" style={{ fontSize: 10 }}>relaxation index</text>
    </svg>
  )
}

function Trace({ data }: { data: number[] }) {
  const w = 320, h = 70
  if (data.length < 2) return <div style={{ height: h }} />
  const lim = 60 // µV shown range
  const d = data.map((v, i) => {
    const x = (i / (TRACE_POINTS - 1)) * w
    const y = h / 2 - (Math.max(-lim, Math.min(lim, v)) / lim) * (h / 2 - 2)
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join('')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: h }} aria-hidden>
      <path d={d} fill="none" stroke="#24604f" strokeWidth="1.2" />
    </svg>
  )
}

function Bar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-muted">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-sand">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, v * 160)}%`, background: color }} />
      </div>
      <span className="w-9 text-right tabular-nums">{Math.round(v * 100)}%</span>
    </div>
  )
}

export default function BrainSession() {
  const [running, setRunning] = useState(false)
  const [frame, setFrame] = useState<EegFrame | null>(null)
  const [trace, setTrace] = useState<number[]>([])
  const [summary, setSummary] = useState<EegSummary | null>(null)
  const [count, setCount] = useState({ n: 0, total: 0, ok: 0 })
  const [source, setSource] = useState('')
  const ws = useRef<WebSocket | null>(null)
  const fallback = useRef<number | undefined>(undefined)

  useEffect(() => () => { ws.current?.close(); clearInterval(fallback.current) }, [])

  function onFrame(f: EegFrame) {
    setFrame(f)
    setTrace((t) => [...t, ...f.raw].slice(-TRACE_POINTS))
    setCount((c) => ({ ...c, n: c.n + 1, ok: c.ok + (f.ok ? 1 : 0) }))
  }

  function reset() {
    setSummary(null); setFrame(null); setTrace([]); setCount({ n: 0, total: 0, ok: 0 })
  }

  // If the WebSocket can't connect, replay the same data from the REST endpoint.
  async function startFallback() {
    const s = await api.eegSession()
    setSource(s.source)
    setCount((c) => ({ ...c, total: s.frames.length }))
    let i = 0
    fallback.current = window.setInterval(() => {
      if (i >= s.frames.length) { clearInterval(fallback.current); setSummary(s.summary); setRunning(false); return }
      onFrame(s.frames[i++])
    }, 1000 / SPEED)
  }

  function start() {
    reset()
    setRunning(true)
    let gotData = false
    const sock = new WebSocket(api.eegSocketUrl(SPEED))
    ws.current = sock
    sock.onmessage = (e) => {
      gotData = true
      const m = JSON.parse(e.data)
      if (m.type === 'meta') { setSource(m.source); setCount((c) => ({ ...c, total: m.total })) }
      if (m.type === 'frame') onFrame(m)
      if (m.type === 'summary') { setSummary(m); setRunning(false) }
    }
    sock.onerror = () => { if (!gotData) startFallback() }
  }

  function stop() {
    ws.current?.close(); clearInterval(fallback.current); setRunning(false)
  }

  const during = frame?.phase === 'during'

  return (
    <div className="space-y-4 p-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Brain session 🧠</h1>
        <p className="text-sm text-muted">See how your brain responds to a relaxation exercise.</p>
      </header>

      <Card>
        <div className="flex items-center justify-between text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${!frame ? 'bg-sand text-muted' : during ? 'bg-sage-100 text-sage-700' : 'bg-peach/40 text-ink'}`}>
            {!frame ? 'Ready' : during ? 'During: breathing exercise, eyes closed' : 'Before: resting, eyes open'}
          </span>
          {count.total > 0 && (
            <span className="text-muted">signal quality {count.n ? Math.round((count.ok / count.n) * 100) : 100}%</span>
          )}
        </div>
        <div className="mt-3"><Gauge value={frame?.relax ?? 0} /></div>
        <div className="mt-2">
          <div className="mb-1 text-[11px] text-muted">Live EEG · channel Oz (back of head)</div>
          <div className="rounded-lg bg-sage-50"><Trace data={trace} /></div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Bar label="Theta" v={frame?.theta ?? 0} color="#b8b2e6" />
          <Bar label="Alpha" v={frame?.alpha ?? 0} color="#3f9581" />
          <Bar label="Beta" v={frame?.beta ?? 0} color="#f4b98a" />
        </div>
        {count.total > 0 && (
          <div className="mt-3 h-1 rounded-full bg-sand">
            <div className="h-full rounded-full bg-sage-500" style={{ width: `${(count.n / count.total) * 100}%` }} />
          </div>
        )}
      </Card>

      {summary ? (
        <Card className="space-y-2">
          <div className="font-semibold">Session summary</div>
          <p className="text-sm">
            Your relaxation index went from <b>{Math.round(summary.relax_before)}</b> to <b>{Math.round(summary.relax_during)}</b> during
            the exercise. Alpha activity (linked to calm, wakeful rest) was {summary.alpha_change_pct != null && summary.alpha_change_pct >= 0
              ? <b>{Math.round(summary.alpha_change_pct)}% higher</b> : 'not higher'}.
          </p>
          <p className="text-xs text-muted">
            In the full loop, this becomes an extra "did it help?" signal, so Kokoryze learns which activities your brain responds to.
          </p>
          <Button variant="soft" className="w-full" onClick={start}>Run again</Button>
        </Card>
      ) : running ? (
        <Button variant="soft" className="w-full" onClick={stop}>Stop</Button>
      ) : (
        <Button className="w-full py-3" onClick={start}>Start session</Button>
      )}

      <p className="text-[11px] leading-snug text-muted">
        Demo: a real public EEG research recording{source ? ` (${source})` : ''} replayed as if live at {SPEED}× speed.
        With a consumer headband (e.g. Muse) the same pipeline runs in real time. Not a medical measurement.
      </p>
    </div>
  )
}
