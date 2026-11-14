import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api'
import { Logo } from './components/ui'

export default function App() {
  const [resetMsg, setResetMsg] = useState('')

  async function reset() {
    await api.reset()
    setResetMsg('Demo data reset ✓')
    setTimeout(() => setResetMsg(''), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sage-50 to-cream">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <Logo />
        <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-5xl">
          Staying well at home,<br />after the clinic.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Kokoryze turns brain and body signals into simple, useful insights. It helps people stay well after
          TMS treatment for depression, catches early changes, and keeps their clinician informed.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {['Sense', 'Respond', 'Learn', 'Escalate'].map((s, i) => (
            <span key={s} className="rounded-full bg-white px-3 py-1 ring-1 ring-black/5">
              <span className="mr-1 text-sage-600">{i + 1}.</span>{s}
            </span>
          ))}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link to="/patient/ben" className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
            <div className="text-3xl">📱</div>
            <h2 className="mt-3 text-xl font-semibold">Patient app</h2>
            <p className="mt-1 text-sm text-muted">
              Daily check-in, "your week vs. your normal", activities that learn what helps you, and a brain session.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-sage-700 group-hover:underline">Open as Ben →</span>
          </Link>
          <Link to="/clinic" className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
            <div className="text-3xl">🩺</div>
            <h2 className="mt-3 text-xl font-semibold">Clinician dashboard</h2>
            <p className="mt-1 text-sm text-muted">
              See in ten seconds who might need a call, with plain-language reasons and trends against each
              person's own baseline.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-sage-700 group-hover:underline">Open dashboard →</span>
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span>Synthetic demo data only · Not a medical device · Not a diagnosis</span>
          <button onClick={reset} className="rounded-lg px-2 py-1 ring-1 ring-black/10 hover:bg-white">Reset demo</button>
          {resetMsg && <span className="text-sage-700">{resetMsg}</span>}
        </div>
      </div>
    </div>
  )
}
