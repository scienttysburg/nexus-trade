import { api } from '@/lib/api'
import LiveScreener from '@/components/screener/LiveScreener'

export default async function ScreenerPage() {
  const signals = await api.signals({ sort_by: 'score' })
  return <LiveScreener initialSignals={signals} />
}
