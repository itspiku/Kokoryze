import { Link, useLocation, useParams } from 'react-router-dom'
import type { CrisisResources } from '../api'

const FALLBACK: CrisisResources = {
  message: "You're not alone, and you deserve support right now.",
  contacts: [
    { label: 'Emergency (Finland & EU)', number: '112', note: 'If you are in immediate danger' },
    { label: 'MIELI Crisis Helpline (Finland)', number: '09 2525 0111', note: 'Talk to someone, 24/7' },
  ],
  disclaimer: 'Kokoryze is a support tool, not an emergency service.',
}

export default function Crisis() {
  const { pid = 'ben' } = useParams()
  const st = (useLocation().state ?? {}) as { resources?: CrisisResources; notified?: boolean }
  const r = st.resources ?? FALLBACK

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-lilac/40 to-cream p-6">
      <div className="flex-1 space-y-5 pt-6">
        <div className="text-5xl">🫂</div>
        <h1 className="text-2xl font-semibold leading-snug">{r.message}</h1>
        <p className="text-sm text-ink/80">
          It sounds like things are really hard right now. Talking to someone can help, and you don't have to wait.
        </p>

        <div className="space-y-3">
          {r.contacts.map((c) => (
            <a key={c.number} href={`tel:${c.number.replace(/\s/g, '')}`}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div>
                <div className="font-semibold">{c.label}</div>
                <div className="text-xs text-muted">{c.note}</div>
              </div>
              <div className="rounded-full bg-sage-600 px-4 py-2 font-semibold text-white">📞 {c.number}</div>
            </a>
          ))}
          <a href="tel:" className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div>
              <div className="font-semibold">Call my clinic</div>
              <div className="text-xs text-muted">Your care team</div>
            </div>
            <div className="rounded-full bg-sage-50 px-4 py-2 font-semibold text-sage-700">📞 Call</div>
          </a>
        </div>

        {st.notified && (
          <p className="rounded-xl bg-white/70 p-3 text-sm">
            Because you allowed safety alerts, your clinic has been notified and someone will reach out.
          </p>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">{r.disclaimer}</p>
      <Link to={`/patient/${pid}`} className="mt-3 text-center text-sm text-sage-700">Back to the app</Link>
    </div>
  )
}
