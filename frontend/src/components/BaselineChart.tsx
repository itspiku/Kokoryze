import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Series } from '../api'

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function fmtVal(v: number, unit: string) {
  if (unit === 'steps') return Math.round(v).toLocaleString()
  if (unit === 'h') return v.toFixed(1) + ' h'
  if (unit === '/10') return v.toFixed(0) + '/10'
  return Math.round(v) + ' ' + unit
}

/** Round, evenly spaced axis ticks (e.g. 4, 6, 8 instead of 4.3, 6.1, 7.9). */
function niceTicks(lo: number, hi: number, count = 4) {
  const raw = (hi - lo) / count || 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { ticks, domain: [start, end] as [number, number] }
}

const tickLabel = (unit: string) => (v: number) =>
  unit === 'steps' ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : String(Number(v.toFixed(1)))

/** A signal over time with the person's usual range shaded behind it.
 *  The line stays neutral; only unusual days are orange, so you can see when things changed. */
export default function BaselineChart({ s, height = 140, compact = false }: { s: Series; height?: number; compact?: boolean }) {
  const vals = s.points.map((p) => p.value).filter((v): v is number => v != null)
  const lo = Math.min(...vals, s.baseline?.low ?? Infinity)
  const hi = Math.max(...vals, s.baseline?.high ?? -Infinity)
  const { ticks, domain } = niceTicks(lo, hi)
  const onsetInRange = s.onset && s.points.some((p) => p.date === s.onset)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={s.points} margin={{ top: onsetInRange && s.changed ? 18 : 8, right: 8, bottom: 0, left: compact ? -24 : -14 }}>
        <CartesianGrid stroke="#eef0ef" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#66736f' }} minTickGap={28}
          axisLine={false} tickLine={false} />
        <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 10, fill: '#66736f' }} axisLine={false} tickLine={false}
          tickFormatter={tickLabel(s.unit)} width={40} interval={0} />
        {s.baseline && (
          <>
            <ReferenceArea y1={s.baseline.low} y2={s.baseline.high} fill="#9cc9b9" fillOpacity={0.25} stroke="none" />
            <ReferenceLine y={s.baseline.median} stroke="#3f9581" strokeDasharray="4 4" strokeOpacity={0.6} />
          </>
        )}
        {s.changed && onsetInRange && (
          <ReferenceLine x={s.onset!} stroke="#d97a1e" strokeDasharray="3 3"
            label={{ value: 'change began', position: 'top', fontSize: 10, fill: '#b4621a' }} />
        )}
        <Tooltip
          formatter={(v) => [fmtVal(Number(v), s.unit), s.label]}
          labelFormatter={(l) => fmtDate(String(l))}
          contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #eee' }}
        />
        <Line type="monotone" dataKey="value" stroke="#4b5a56" strokeWidth={1.6} connectNulls={false}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: { unusual?: boolean; value: number | null }; index?: number }) => {
            const { cx, cy, payload, index } = props
            if (cx == null || cy == null || payload?.value == null) return <g key={index} />
            return payload.unusual
              ? <circle key={index} cx={cx} cy={cy} r={3.2} fill="#d97a1e" stroke="white" strokeWidth={1} />
              : <circle key={index} cx={cx} cy={cy} r={1.4} fill="#4b5a56" />
          }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
