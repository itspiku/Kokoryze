// Small stroke icons (24x24, currentColor). Consistent on every device, unlike emoji.
import type { ReactNode, SVGProps } from 'react'

function Icon({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden width={22} height={22} {...p}>
      {children}
    </svg>
  )
}

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></Icon>
)
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></Icon>
)
export const TrendIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 17l5-5 4 3 8-8" /><path d="M15 7h5v5" /></Icon>
)
export const BrainIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1z" />
    <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" />
  </Icon>
)
export const LockIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
)
export const WindIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 9h11a3 3 0 1 0-3-3" /><path d="M3 14h15a3 3 0 1 1-3 3" /></Icon>
)
export const WalkIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6 3 3v3M12 15l-1-5 4 2 3 1M11 10l-3 2-1 3" /></Icon>
)
export const PeopleIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5M18 20a6 6 0 0 0-2.5-4.9" /></Icon>
)
export const LeafIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19l7-7" /></Icon>
)
export const BoltIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M13 3 5 13h6l-1 8 8-10h-6z" /></Icon>
)
export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M4 12 20 4l-6 16-3-7z" /><path d="m11 13 9-9" /></Icon>
)
export const SparkIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></Icon>
)

const CATEGORY_ICON = {
  relaxation: WindIcon,
  activation: WalkIcon,
  social: PeopleIcon,
  sensory: LeafIcon,
} as const

export function CategoryIcon({ category, className = '' }: { category: keyof typeof CATEGORY_ICON; className?: string }) {
  const I = CATEGORY_ICON[category]
  const tint = {
    relaxation: 'bg-lilac/30 text-[#5b54a8]', activation: 'bg-peach/40 text-[#9a5a26]',
    social: 'bg-sage-100 text-sage-700', sensory: 'bg-emerald-100 text-emerald-700',
  }[category]
  return (
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint} ${className}`}>
      <I />
    </span>
  )
}
