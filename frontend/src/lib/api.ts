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
  prepost_flag?: 'Pre' | 'Post' | null
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
  impact: 'high' | 'medium' | 'low'
  is_noise: boolean
  category: 'stock' | 'crypto'
}

export interface TradePosition {
  id: number
  ticker: string
  name: string
  market: string
  entry_date: string
  entry_price: number
  shares: number
  take_profit: number | null
  stop_loss: number | null
  notes: string
  status: 'open' | 'closed'
  exit_date: string | null
  exit_price: number | null
  created_at: string
  current_price: number | null
  pnl_pct: number | null
  pnl_amount: number | null
}

export interface TradePositionCreate {
  ticker: string
  name?: string
  market?: string
  entry_date: string
  entry_price: number
  shares: number
  take_profit?: number | null
  stop_loss?: number | null
  notes?: string
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

export interface TradeRecord {
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  pnl_pct: number
  result: 'win' | 'loss' | 'neutral'
}

export interface PaperPosition {
  id: number
  ticker: string
  name: string
  asset_type: string
  entry_price: number
  shares: number
  created_at: string
  current_price: number | null
  pnl_amount: number | null
  pnl_pct: number | null
}

export interface PaperAccount {
  cash_balance: number
  positions_value: number
  total_assets: number
  unrealized_pnl: number
  realized_pnl: number
  total_pnl: number
  total_trades: number
  return_pct: number
  initial_balance: number
  positions: PaperPosition[]
}

export interface PaperOrder {
  id: number
  ticker: string
  name: string
  asset_type: string
  order_type: string
  price: number
  shares: number
  amount: number
  pnl: number | null
  executed_at: string
}

export interface PaperOrderRequest {
  ticker: string
  name?: string
  order_type: 'buy' | 'sell'
  shares?: number
  amount?: number
}

export interface PaperOrderResult {
  order_id: number
  type: string
  ticker: string
  price: number
  shares: number
  amount: number
  realized_pnl?: number
}

export interface BacktestResult {
  ticker: string
  period_days: number
  total_trades: number
  win_trades: number
  loss_trades: number
  win_rate: number
  avg_win_pct: number
  avg_loss_pct: number
  profit_factor: number
  expected_value: number
  max_drawdown: number
  trades: TradeRecord[]
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
  lookupSymbol:  (ticker: string) => get<{ ticker: string; name: string; sector: string; market: string }>(`/symbols/lookup?ticker=${encodeURIComponent(ticker)}`),
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

  // バックテスト
  backtest: (ticker: string, params?: { days?: number; hold_days?: number; buy_threshold?: number }) => {
    const q = new URLSearchParams(params as Record<string, string> ?? {}).toString()
    return get<BacktestResult>(`/backtest/${ticker}${q ? `?${q}` : ''}`)
  },

  // ニュース (curated)
  curatedNews: () => get<NewsItem[]>('/news/market'),
  marketNewsPaged: (page: number, limit: number, category: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit), category }).toString()
    return get<NewsItem[]>(`/news/market?${q}`)
  },

  // 仮想通貨
  cryptoSignals: () => get<SignalData[]>('/crypto'),

  // Paper Trading
  paperAccount:  () => get<PaperAccount>('/paper/account'),
  paperOrders:   (limit?: number) => get<PaperOrder[]>(`/paper/orders${limit ? `?limit=${limit}` : ''}`),
  paperOrder:    (body: PaperOrderRequest) =>
    mutate<PaperOrderResult>('POST', '/paper/order', body),
  paperReset:    () => mutate<{ status: string; initial_balance: number }>('POST', '/paper/reset'),

  // Trade Log
  getPositions:    (status?: 'open' | 'closed') => {
    const q = status ? `?status=${status}` : ''
    return get<TradePosition[]>(`/trade-log${q}`)
  },
  addPosition:     (body: TradePositionCreate) =>
    mutate<TradePosition>('POST', '/trade-log', body),
  updatePosition:  (id: number, patch: Partial<TradePositionCreate & { status?: string; exit_price?: number; exit_date?: string }>) =>
    mutate<TradePosition>('PATCH', `/trade-log/${id}`, patch),
  deletePosition:  (id: number) =>
    mutate<{ id: number; status: string }>('DELETE', `/trade-log/${id}`),
}
