// Friendly date helpers for ISO dates like "2026-11-08".
const at = (iso: string) => new Date(iso + 'T12:00:00')

/** "8 Nov", or "Sun 8 Nov" with weekday. */
export function fmtDay(iso: string, weekday = false) {
  return at(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(weekday ? { weekday: 'short' } : {}) })
}

export function daysAgo(iso: string | null) {
  if (!iso) return null
  return Math.round((Date.now() - at(iso).getTime()) / 86400000)
}
