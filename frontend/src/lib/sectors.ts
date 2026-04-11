import type { SignalData, SectorData } from './api'

export function deriveSectors(signals: SignalData[]): SectorData[] {
  const bucket = new Map<string, SignalData[]>()
  signals.forEach(s => {
    const arr = bucket.get(s.sector) ?? []
    arr.push(s)
    bucket.set(s.sector, arr)
  })

  const result: SectorData[] = []
  bucket.forEach((stocks, sector) => {
    const avgChg   = stocks.reduce((sum, s) => sum + s.change_pct, 0) / stocks.length
    const avgScore = stocks.reduce((sum, s) => sum + s.score, 0) / stocks.length

    let signal: SectorData['signal']
    if      (avgScore >= 72) signal = 'strong_buy'
    else if (avgScore >= 58) signal = 'buy'
    else if (avgScore >= 42) signal = 'hold'
    else if (avgScore >= 28) signal = 'sell'
    else                     signal = 'strong_sell'

    const top = [...stocks].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50)).slice(0, 2)

    result.push({
      name: sector,
      code: sector.replace(/[・]/g, '_'),
      change_pct: Math.round(avgChg * 100) / 100,
      signal,
      top_tickers: top.map(s => s.ticker),
    })
  })

  return result.sort((a, b) => b.change_pct - a.change_pct)
}
