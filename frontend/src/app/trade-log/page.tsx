import { api } from '@/lib/api'
import TradeLogClient from '@/components/trade-log/TradeLogClient'

export default async function TradeLogPage() {
  const positions = await api.getPositions()
  return <TradeLogClient initialPositions={positions} />
}
