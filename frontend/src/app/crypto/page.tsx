import { api } from '@/lib/api'
import CryptoRadar from '@/components/crypto/CryptoRadar'

export default async function CryptoPage() {
  let signals = []
  try {
    signals = await api.cryptoSignals()
  } catch {
    // バックエンド未起動時はクライアントサイドでフェッチ
  }
  return <CryptoRadar initialSignals={signals} />
}
