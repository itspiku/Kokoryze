import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Series } from '../api'

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()}.${dt.getMonth() + 1}.`
}

function fmtVal(v: number, unit: string) {
  if (unit === 'steps') return Math.round(v).toLocaleString()
  if (unit === 'h') return v.toFixed(1) + ' h'
  if (unit === '/10') return v.toFixed(0) + '/10'
  return Math.round(v) + ' ' + unit
}

/** A signal over time with the person's usual range shaded behind it. */
export default function BaselineChart({ s, height = 140, compact = false }: { s: Series; height?: number; compact?: boolean }) {
  const vals = s.points.map((p) => p.value).filter((v): v is number => v != null)
  const lo = Math.min(...vals, s.baseline?.low ?? Infinity)
  const hi = Math.max(...vals, s.baseline?.high ?? -Infinity)
  const pad = (hi - lo) * 0.15 || 1
  const color = s.changed ? '#d97a1e' : '#3f9581'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={s.points} margin={{ top: 6, right: 8, bottom: 0, left: compact ? -28 : -12 }}>
        <CartesianGrid stroke="#eee" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#66736f' }} minTickGap={24}
          axisLine={false} tickLine={false} />
        <YAxis domain={[lo - pad, hi + pad]} tick={{ fontSize: 10, fill: '#66736f' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => (s.unit === 'steps' ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
          width={40} />
        {s.baseline && (
          <>
            <ReferenceArea y1={s.baseline.low} y2={s.baseline.high} fill="#9cc9b9" fillOpacity={0.25} stroke="none" />
            <ReferenceLine y={s.baseline.median} stroke="#3f9581" strokeDasharray="4 4" strokeOpacity={0.6} />
          </>
        )}
        <Tooltip
          formatter={(v) => [fmtVal(Number(v), s.unit), s.label]}
          labelFormatter={(l) => fmtDate(String(l))}
          contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #eee' }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} connectNulls={false}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: { unusual?: boolean; value: number | null }; index?: number }) => {
            const { cx, cy, payload, index } = props
            if (cx == null || cy == null || payload?.value == null) return <g key={index} />
            return payload.unusual
              ? <circle key={index} cx={cx} cy={cy} r={3} fill="#d97a1e" stroke="white" strokeWidth={1} />
              : <circle key={index} cx={cx} cy={cy} r={1.5} fill={color} />
          }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
