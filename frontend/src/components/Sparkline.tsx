/** Tiny trend line for list rows. Gaps (missing days) break the line. */
export default function Sparkline({ values, usual, width = 96, height = 28, label }: {
  values: (number | null)[]; usual?: number | null; width?: number; height?: number; label: string
}) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return <span className="text-xs text-slate-400">no data</span>
  const lo = Math.min(...nums, usual ?? Infinity, 1)
  const hi = Math.max(...nums, usual ?? -Infinity, 10)
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)

  // split into runs of consecutive values so missing days show as gaps
  const runs: string[] = []
  let cur = ''
  values.forEach((v, i) => {
    if (v == null) { if (cur) runs.push(cur); cur = ''; return }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (cur) runs.push(cur)

  const lastIdx = values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop()!
  const last = values[lastIdx]!
  const below = usual != null && last < usual - 1

  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      {usual != null && (
        <line x1={2} x2={width - 2} y1={y(usual)} y2={y(usual)} stroke="#9cc9b9" strokeDasharray="3 3" />
      )}
      {runs.map((d, i) => <path key={i} d={d} fill="none" stroke="#4b5a56" strokeWidth={1.4} />)}
      <circle cx={x(lastIdx)} cy={y(last)} r={2.6} fill={below ? '#d97a1e' : '#3f9581'} />
    </svg>
  )
}
