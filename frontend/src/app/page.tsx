import { api } from '@/lib/api'
import LiveDashboard from '@/components/dashboard/LiveDashboard'

export default async function DashboardPage() {
  const [indices, signals, newsTicker] = await Promise.all([
    api.indices(),
    api.signals({ sort_by: 'score' }),
    api.newsTicker(),
  ])

  return (
    <LiveDashboard
      initialIndices={indices}
      initialSignals={signals}
      newsTicker={newsTicker}
    />
  )
}
