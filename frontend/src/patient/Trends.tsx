import { useParams } from 'react-router-dom'
import { api } from '../api'
import BaselineChart from '../components/BaselineChart'
import { Card, ErrorBox, Loading } from '../components/ui'
import { useApi } from '../useApi'

const SHOW = ['sleep_hours', 'steps', 'mood', 'energy', 'hrv_rmssd', 'reaction_ms']

export default function Trends() {
  const { pid = 'ben' } = useParams()
  const { data, error, loading } = useApi(() => api.trends(pid, 30), [pid])
  if (error) return <ErrorBox error={error} />
  if (loading || !data) return <Loading />

  return (
    <div className="space-y-4 p-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Your trends</h1>
        <p className="text-sm text-muted">The shaded band is <em>your</em> usual range, learned from your first two weeks at home.</p>
      </header>
      {SHOW.map((k) => data.signals.find((s) => s.key === k)).filter(Boolean).map((s) => (
        <Card key={s!.key} className="pb-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">{s!.label}</h2>
            <span className={`text-xs ${s!.changed ? 'text-review' : 'text-muted'}`}>
              {s!.changed ? 'Different from usual lately' : 'Within your usual range'}
            </span>
          </div>
          <BaselineChart s={s!} height={120} compact />
        </Card>
      ))}
    </div>
  )
}
