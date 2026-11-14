import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'

export default function ClinicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/clinic" className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:inline">Clinician</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/patient/ben" className="text-sage-700 hover:underline">Patient app →</Link>
            <span className="hidden text-slate-500 sm:inline">Dr. Laine · TMS follow-up</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
