import type { ReactNode } from 'react'
import type { Status } from '../api'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <circle cx="16" cy="16" r="15" fill={light ? '#ffffff' : '#2f7d6d'} />
        <path d="M7 17h4l2-5 3 10 3-7 2 2h4" fill="none" stroke={light ? '#2f7d6d' : '#fff'} strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Kokoryze
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="p-6 text-center text-sm text-muted">{label}</div>
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
      Couldn't reach the backend. Is it running on port 8000?
      <div className="mt-1 font-mono text-xs opacity-70">{error}</div>
    </div>
  )
}

const STATUS_STYLE: Record<Status, { dot: string; chip: string }> = {
  urgent: { dot: 'bg-urgent', chip: 'bg-red-50 text-urgent ring-red-200' },
  review: { dot: 'bg-review', chip: 'bg-orange-50 text-orange-800 ring-orange-200' },
  missing: { dot: 'bg-missing', chip: 'bg-slate-100 text-slate-700 ring-slate-200' },
  watch: { dot: 'bg-watch', chip: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  stable: { dot: 'bg-stable', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
}

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.chip}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot} ${status === 'urgent' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      Indicators show change from this person's own usual pattern. They are not a diagnosis.
      Demo uses synthetic data only.
    </p>
  )
}

export function Button({ children, onClick, variant = 'primary', className = '', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'soft'; className?: string
  disabled?: boolean; type?: 'button' | 'submit'
}) {
  const v = {
    primary: 'bg-sage-600 text-white hover:bg-sage-700 disabled:bg-sage-300',
    soft: 'bg-sage-50 text-sage-700 hover:bg-sage-100',
    ghost: 'text-sage-700 hover:bg-sage-50',
  }[variant]
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 ${v} ${className}`}>
      {children}
    </button>
  )
}
