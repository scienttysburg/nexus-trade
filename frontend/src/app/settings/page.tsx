import { api } from '@/lib/api'
import SettingsClient from '@/components/settings/SettingsClient'

export const metadata = { title: '設定 — Nexus Trade' }

export default async function SettingsPage() {
  const [symbolsData, settings] = await Promise.all([
    api.getSymbols().catch(() => ({ jp: [], us: [] })),
    api.getSettings().catch(() => null),
  ])
  return <SettingsClient initialSymbols={symbolsData} initialSettings={settings} />
}
