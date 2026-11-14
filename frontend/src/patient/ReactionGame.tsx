import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Card } from '../components/ui'

const TRIALS = 5
type G = 'intro' | 'wait' | 'go' | 'early' | 'between' | 'done'

export default function ReactionGame() {
  const { pid = 'ben' } = useParams()
  const [g, setG] = useState<G>('intro')
  const [times, setTimes] = useState<number[]>([])
  const [usual, setUsual] = useState<number | null>(null)
  const goAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function arm() {
    setG('wait')
    timer.current = window.setTimeout(() => { goAt.current = performance.now(); setG('go') }, 1000 + Math.random() * 2000)
  }

  async function tap() {
    if (g === 'wait') {
      clearTimeout(timer.current)
      setG('early')
      return
    }
    if (g !== 'go') return
    const rt = Math.round(performance.now() - goAt.current)
    if (rt < 120) { setG('early'); return }
    const t = [...times, rt]
    setTimes(t)
    if (t.length >= TRIALS) {
      const med = [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)]
      const r = await api.reaction(pid, med, t)
      setUsual(r.usual)
      setG('done')
    } else {
      setG('between')
    }
  }

  const median = times.length ? [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] : null

  const zone = {
    intro: 'bg-sand', wait: 'bg-lilac/60', go: 'bg-sage-500', early: 'bg-peach', between: 'bg-sand', done: 'bg-sand',
  }[g]

  return (
    <div className="space-y-4 p-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Reaction game ⚡</h1>
        <p className="text-sm text-muted">Tap as soon as the circle turns green. {TRIALS} rounds, about 30 seconds.</p>
      </header>

      <button onClick={g === 'intro' || g === 'between' || g === 'early' ? arm : tap}
        disabled={g === 'done'}
        className={`flex h-72 w-full select-none items-center justify-center rounded-3xl text-xl font-semibold transition-colors ${zone}`}>
        {g === 'intro' && 'Tap to start'}
        {g === 'wait' && 'Wait for green…'}
        {g === 'go' && <span className="text-white">TAP!</span>}
        {g === 'early' && 'Too early! Tap to retry'}
        {g === 'between' && <span>{times[times.length - 1]} ms · tap for next ({times.length}/{TRIALS})</span>}
        {g === 'done' && <span>Done! 🎉</span>}
      </button>

      {g === 'done' && median != null && (
        <Card className="space-y-1 text-center">
          <div className="text-sm text-muted">Today's median</div>
          <div className="text-3xl font-semibold text-sage-700">{median} ms</div>
          {usual != null && <div className="text-sm text-muted">Your usual: {Math.round(usual)} ms</div>}
          <p className="pt-2 text-xs text-muted">
            Tiredness, distraction and practice all change scores. We only look at long, steady trends, never one game.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="soft" className="flex-1" onClick={() => { setTimes([]); setG('intro') }}>Play again</Button>
            <Link to={`/patient/${pid}`} className="flex-1"><Button className="w-full">Done</Button></Link>
          </div>
        </Card>
      )}
    </div>
  )
}
