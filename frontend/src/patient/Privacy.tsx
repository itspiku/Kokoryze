import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Card, ErrorBox, Loading } from '../components/ui'
import { useApi } from '../useApi'

const ORDER = ['mood', 'notes', 'sleep', 'activity', 'heart', 'cognitive', 'safety']

export default function Privacy() {
  const { pid = 'ben' } = useParams()
  const { data, error, loading, setData } = useApi(() => api.sharing(pid), [pid])
  const [confirm, setConfirm] = useState(false)
  const [deleted, setDeleted] = useState(false)

  if (error) return <ErrorBox error={error} />
  if (loading || !data) return <Loading />

  async function toggle(k: string) {
    setData(await api.setSharing(pid, { [k]: !data!.sharing[k] }))
  }

  return (
    <div className="space-y-4 p-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Privacy & sharing</h1>
        <p className="text-sm text-muted">You decide what your clinic can see. Changes apply immediately.</p>
      </header>

      <Card className="divide-y divide-black/5 p-0">
        {ORDER.map((k) => (
          <label key={k} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm">{data.labels[k]}</span>
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={data.sharing[k]} onChange={() => toggle(k)} />
              <span className="h-6 w-11 rounded-full bg-black/15 transition peer-checked:bg-sage-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sage-500" />
              <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </span>
          </label>
        ))}
      </Card>

      <Card className="space-y-2 text-sm text-ink/80">
        <div className="font-medium text-ink">What we never collect</div>
        <p>No audio recordings, no location, no messages, no contacts. Only daily summaries like "7.2 h sleep".</p>
      </Card>

      <Card className="space-y-3">
        <div className="font-medium">Your data</div>
        {deleted ? (
          <p className="text-sm text-sage-700">All your data was deleted. ✓</p>
        ) : confirm ? (
          <>
            <p className="text-sm">This permanently deletes all your check-ins, sensor data and activity history. This can't be undone.</p>
            <div className="flex gap-2">
              <Button variant="soft" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Button>
              <button className="flex-1 rounded-xl bg-urgent px-4 py-2.5 text-sm font-medium text-white"
                onClick={async () => { await api.deleteData(pid); setDeleted(true) }}>Delete everything</button>
            </div>
          </>
        ) : (
          <Button variant="soft" className="w-full" onClick={() => setConfirm(true)}>Delete my data</Button>
        )}
      </Card>
    </div>
  )
}
