export interface IndexData {
  symbol: string
  name: string
  value: number
  change: number
  change_pct: number
  sparkline: number[]
  market: 'JP' | 'US'
}

export interface SectorData {
  name: string
  code: string
  change_pct: number
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  top_tickers: string[]
}

export interface SignalData {
  ticker: string
  name: string
  sector: string
  price: number
  change_pct: number
  signal: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
  score: number
  rsi: number
  macd_positive: boolean
  vwap_dev: number
  timing: string
  market: 'JP' | 'US'
}

export interface OHLCVData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface NewsItem {
  id: number
  title: string
  sentiment: 'positive' | 'neutral' | 'negative'
  sentiment_score: number
  published_at: string
  source: string
}

export interface StockDetail {
  ticker: string
  name: string
  sector: string
  price: number
  change_pct: number
  signal: string
  score: number
  rsi: number
  macd_value: number
  macd_signal_line: number
  vwap: number
  vwap_dev: number
  ma5: number
  ma25: number
  ma75: number
  timing_advice: string
  ohlcv: OHLCVData[]
  news: NewsItem[]
}

// Server Component (SSR) は相対URLが使えないため直接バックエンドを参照する
const BASE = typeof window === 'undefined'
  ? 'http://localhost:8000/api/v1'
  : '/api/v1'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`API error: ${res.status} ${path}`)
  return res.json()
}

export interface SymbolEntry {
  ticker: string
  name: string
  sector: string
  enabled: boolean
}

export interface SymbolsData {
  jp: SymbolEntry[]
  us: SymbolEntry[]
}

export interface AppSettings {
  refresh_interval: number
  broadcast_interval: number
  discord_webhook: string
  slack_webhook: string
  webhook_enabled: boolean
  webhook_score_threshold: number
}

async function mutate<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch('/api/v1' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `API error: ${res.status}`)
  }
  return res.json()
}

export const api = {
  indices:    () => get<IndexData[]>('/indices'),
  sectors:    () => get<SectorData[]>('/sectors'),
  signals:    (params?: { market?: string; signal_type?: string; sort_by?: string }) => {
    const q = new URLSearchParams(params as Record<string, string> ?? {}).toString()
    return get<SignalData[]>(`/signals${q ? `?${q}` : ''}`)
  },
  stock:       (ticker: string) => get<StockDetail>(`/stocks/${ticker}`),
  newsTicker:  () => get<string[]>('/news/ticker'),
  marketNews:  () => get<NewsItem[]>('/news/market'),
  stockNews:   (ticker: string) => get<NewsItem[]>(`/news/stock/${ticker}`),

  // 銘柄管理
  getSymbols:    () => get<SymbolsData>('/symbols'),
  addSymbol:     (body: { ticker: string; name: string; sector: string; market: string }) =>
    mutate<{ ticker: string; status: string }>('POST', '/symbols', body),
  deleteSymbol:  (ticker: string) =>
    mutate<{ ticker: string; status: string }>('DELETE', `/symbols/${ticker}`),
  toggleSymbol:  (ticker: string, enabled: boolean) =>
    mutate<{ ticker: string; enabled: boolean }>('PATCH', `/symbols/${ticker}`, { enabled }),

  // アプリ設定
  getSettings:    () => get<AppSettings>('/settings'),
  updateSettings: (patch: Partial<AppSettings>) =>
    mutate<AppSettings>('PATCH', '/settings', patch),
}
