'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import type { SignalData } from '@/lib/api'

const SIGNAL_COLOR: Record<string, string> = {
  'Strong Buy':  'text-buy',
  'Buy':         'text-buy',
  'Hold':        'text-hold',
  'Sell':        'text-sell',
  'Strong Sell': 'text-sell',
}
const SIGNAL_BG: Record<string, string> = {
  'Strong Buy':  'bg-buy/20 border-buy/40',
  'Buy':         'bg-buy/10 border-buy/20',
  'Hold':        'bg-hold/10 border-hold/20',
  'Sell':        'bg-sell/10 border-sell/20',
  'Strong Sell': 'bg-sell/20 border-sell/40',
}

function CryptoRow({ s }: { s: SignalData }) {
  const pctColor = s.change_pct >= 0 ? 'text-buy' : 'text-sell'
  const pctSign = s.change_pct >= 0 ? '+' : ''
  return (
    <tr className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
      <td className='px-4 py-3'>
        <p className='font-mono text-xs text-[#8b949e]'>{s.ticker.replace('-USD', '')}</p>
        <p className='text-sm text-[#e6edf3] font-medium'>{s.name}</p>
        <p className='text-[10px] text-[#8b949e]'>{s.sector}</p>
      </td>
      <td className='px-3 py-3 font-mono text-sm text-[#e6edf3] text-right'>
        ${s.price < 1 ? s.price.toFixed(4) : s.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className={clsx('px-3 py-3 font-mono text-sm text-right', pctColor)}>
        {pctSign}{s.change_pct.toFixed(2)}%
      </td>
      <td className='px-3 py-3 text-right'>
        <span className={clsx(
          'inline-block text-[10px] font-bold px-2 py-0.5 rounded border',
          SIGNAL_BG[s.signal] ?? 'border-dim'
        )}>
          <span className={SIGNAL_COLOR[s.signal] ?? 'text-[#8b949e]'}>{s.signal}</span>
        </span>
      </td>
      <td className='px-3 py-3 text-right'>
        <div className='flex items-center justify-end gap-1.5'>
          <div className='w-16 h-1.5 bg-[#30363d] rounded-full overflow-hidden'>
            <div
              className={clsx('h-full rounded-full', s.score >= 60 ? 'bg-buy' : s.score >= 40 ? 'bg-hold' : 'bg-sell')}
              style={{ width: `${s.score}%` }}
            />
          </div>
          <span className='font-mono text-xs text-[#8b949e] w-6 text-right'>{s.score}</span>
        </div>
      </td>
      <td className='px-3 py-3 text-right font-mono text-xs text-[#8b949e]'>
        {s.rsi.toFixed(1)}
      </td>
      <td className='px-3 py-3 text-right'>
        <span className={clsx('text-xs font-medium', s.macd_positive ? 'text-buy' : 'text-sell')}>
          {s.macd_positive ? '▲ 正転' : '▼ 負転'}
        </span>
      </td>
      <td className='px-3 py-3 text-right font-mono text-xs text-[#8b949e]'>
        {s.vwap_dev >= 0 ? '+' : ''}{s.vwap_dev.toFixed(2)}%
      </td>
      <td className='px-3 py-3 pr-4 text-right text-xs text-[#8b949e]'>
        {s.timing}
      </td>
    </tr>
  )
}

type FilterSignal = 'all' | 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'

export default function CryptoRadar({ initialSignals }: { initialSignals: SignalData[] }) {
  const [signals, setSignals] = useState<SignalData[]>(initialSignals)
  const [filter, setFilter] = useState<FilterSignal>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/crypto')
      if (res.ok) {
        const data = await res.json()
        setSignals(data)
        setLastUpdated(new Date())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialSignals.length === 0) fetchSignals()
    // 60秒ごとに自動更新
    const timer = setInterval(fetchSignals, 60_000)
    return () => clearInterval(timer)
  }, [fetchSignals, initialSignals.length])

  const filtered = useMemo(() => {
    let data = signals
    if (filter !== 'all') data = data.filter(s => s.signal === filter)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    }
    return data
  }, [signals, filter, search])

  const filterBtn = (f: FilterSignal, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className={clsx(
        'px-3 py-1.5 text-xs rounded-md transition-colors border',
        filter === f
          ? 'bg-accent/20 text-accent border-accent/50'
          : 'text-[#8b949e] border-dim hover:text-[#e6edf3] hover:border-[#58a6ff]/30'
      )}
    >{label}</button>
  )

  return (
    <div className='flex flex-col gap-4 max-w-[1400px] mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>Crypto Radar</h1>
          <p className='text-sm text-[#8b949e]'>
            仮想通貨リアルタイム・シグナル一覧
            {lastUpdated && (
              <span className='ml-2 text-[10px] font-mono'>
                更新: {lastUpdated.toLocaleTimeString('ja-JP')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className={clsx(
            'px-3 py-1.5 text-xs rounded-md border border-dim transition-colors',
            loading ? 'text-[#8b949e]' : 'text-[#e6edf3] hover:bg-[#1c2128]'
          )}
        >
          {loading ? '取得中…' : '↺ 更新'}
        </button>
      </div>

      {/* フィルターバー */}
      <div className='bg-card border border-dim rounded-lg px-4 py-3 flex flex-wrap items-center gap-3'>
        <div className='flex items-center gap-2 flex-wrap'>
          {filterBtn('all', 'すべて')}
          {filterBtn('Strong Buy', 'Strong Buy')}
          {filterBtn('Buy', 'Buy')}
          {filterBtn('Hold', 'Hold')}
          {filterBtn('Sell', 'Sell')}
          {filterBtn('Strong Sell', 'Strong Sell')}
        </div>
        <input
          type='text'
          placeholder='銘柄名・ティッカー検索'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='input ml-auto w-48 text-xs'
        />
        <span className='text-xs text-[#8b949e] font-mono'>{filtered.length} 銘柄</span>
      </div>

      {/* テーブル */}
      <div className='bg-card border border-dim rounded-lg overflow-x-auto'>
        {loading && signals.length === 0 ? (
          <div className='py-20 text-center text-sm text-[#8b949e]'>データ取得中…</div>
        ) : filtered.length === 0 ? (
          <div className='py-20 text-center text-sm text-[#8b949e]'>条件に合う銘柄がありません</div>
        ) : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-dim text-[10px] text-[#8b949e] uppercase'>
                <th className='px-4 py-2 text-left font-medium'>銘柄</th>
                <th className='px-3 py-2 text-right font-medium'>価格 (USD)</th>
                <th className='px-3 py-2 text-right font-medium'>24h変動</th>
                <th className='px-3 py-2 text-right font-medium'>シグナル</th>
                <th className='px-3 py-2 text-right font-medium'>スコア</th>
                <th className='px-3 py-2 text-right font-medium'>RSI</th>
                <th className='px-3 py-2 text-right font-medium'>MACD</th>
                <th className='px-3 py-2 text-right font-medium'>VWAP乖離</th>
                <th className='px-3 py-2 pr-4 text-right font-medium'>タイミング</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => <CryptoRow key={s.ticker} s={s} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
