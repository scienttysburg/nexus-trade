import { api } from '@/lib/api'
import SectorMatrixClient from '@/components/sectors/SectorMatrixClient'

export default async function SectorsPage() {
  const signals = await api.signals({ sort_by: 'score' })
  return <SectorMatrixClient initialSignals={signals} />
}
