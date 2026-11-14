// Demo control: pretend it's a given time of day so suggestions are predictable on stage.
import type { TimeOfDay } from './api'

const KEY = 'kokoryze.tod'

export function getDemoTod(): TimeOfDay | '' {
  try {
    return (localStorage.getItem(KEY) as TimeOfDay | null) ?? ''
  } catch {
    return ''
  }
}

export function setDemoTod(v: TimeOfDay | '') {
  try {
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: ignore */
  }
}

export const todQuery = (sep: '?' | '&' = '?') => {
  const t = getDemoTod()
  return t ? `${sep}tod=${t}` : ''
}
