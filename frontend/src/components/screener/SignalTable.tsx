'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { SignalData } from '@/lib/api'

const SIGNAL_STYLE: Record<string, string> = {
  'Strong Buy': 'bg-[#1a4731] text-buy border border-buy/50',
  'Buy':        'bg-[#122d20] text-[#85e89d] border border-[#3fb950]/30',
  'Hold':       'bg-[#2d2a1a] text-hold border border-hold/30',
  'Sell':       'bg-[#2d1a1a] text-[#f97583] border border-sell/30',
  'Strong Sell':'bg-[#3d1818] text-sell border border-sell/50',
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#3fb950' : score >= 40 ? '#d29922' : '#f85149'
  return (
    <div className='flex items-center gap-2'>
      <div className='w-16 h-1.5 bg-[#30363d] rounded-full overflow-hidden'>
        <div className='h-full rounded-full transition-all duration-500' style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className='font-mono text-xs text-[#c9d1d9] w-6 text-right'>{score}</span>
    </div>
  )
}

type Filter = 'all' | 'buy' | 'sell'
type SortKey = 'score' | 'change_pct' | 'rsi'

const btn = (active: boolean) =>
  clsx(
    'px-3 py-1.5 text-xs rounded-md transition-colors border',
    active
      ? 'bg-accent/20 text-accent border-accent/50'
      : 'text-[#8b949e] border-dim hover:text-[#e6edf3] hover:border-[#58a6ff]/30'
  )

export default function SignalTable({ initialData }: { initialData: SignalData[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [market, setMarket] = useState<'all' | 'JP' | 'US'>('all')
  const [query, setQuery] = useState('')

  const data = useMemo(() => {
    let d = [...initialData]
    if (filter === 'buy')  d = d.filter(s => s.signal === 'Strong Buy' || s.signal === 'Buy')
    if (filter === 'sell') d = d.filter(s => s.signal === 'Sell' || s.signal === 'Strong Sell')
    if (market !== 'all')  d = d.filter(s => s.market === market)

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      d = d.filter(s =>
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
      )
    }

    d.sort((a, b) =>
      sortBy === 'score'      ? b.score - a.score :
      sortBy === 'change_pct' ? b.change_pct - a.change_pct :
                                a.rsi - b.rsi
    )
    return d
  }, [initialData, filter, sortBy, market, query])

  return (
    <div className='bg-card border border-dim rounded-lg'>
      {/* フィルターバー */}
      <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-dim'>
        <div className='flex items-center gap-2 flex-wrap'>
          {(['all', 'buy', 'sell'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={btn(filter === f)}>
              {f === 'all' ? 'すべて' : f === 'buy' ? '▲ 買い' : '▼ 売り'}
            </button>
          ))}
          <span className='text-xs text-[#8b949e] font-mono ml-1'>
            {data.length} 銘柄
          </span>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          {(['all', 'JP', 'US'] as const).map(m => (
            <button key={m} onClick={() => setMarket(m)} className={btn(market === m)}>
              {m === 'all' ? '全市場' : m}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className='px-2 py-1.5 text-xs bg-[#0d1117] border border-dim rounded-md text-[#8b949e] focus:outline-none focus:border-accent cursor-pointer'
          >
            <option value='score'>スコア順</option>
            <option value='change_pct'>騰落率順</option>
            <option value='rsi'>RSI順</option>
          </select>
        </div>
      </div>

      {/* 検索バー */}
      <div className='px-4 py-2.5 border-b border-dim'>
        <input
          type='text'
          placeholder='銘柄名 / ティッカー / セクターで検索...'
          value={query}
          onChange={e => setQuery(e.target.value)}
          className='w-full max-w-md px-3 py-1.5 text-xs bg-[#0d1117] border border-dim rounded-md text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-accent transition-colors'
        />
      </div>

      {/* テーブル */}
      <div className='overflow-x-auto'>
        <table className='w-full text-sm min-w-[720px]'>
          <thead>
            <tr className='text-xs text-[#8b949e] border-b border-dim bg-[#0d1117]/50'>
              {['銘柄', 'セクター', '現在値', '騰落率', 'シグナル', 'スコア', 'RSI', 'MACD', 'VWAP乖離', '推奨時間帯'].map(h => (
                <th key={h} className='px-3 py-2.5 text-left font-medium whitespace-nowrap first:pl-4'>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(s => (
              <tr key={s.ticker} className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors group'>
                <td className='px-3 py-2.5 pl-4'>
                  <Link href={`/symbol/${s.ticker}`} className='block hover:text-accent transition-colors'>
                    <p className='font-mono text-[11px] text-[#8b949e] group-hover:text-[#58a6ff]/70 transition-colors'>{s.ticker}</p>
                    <p className='font-medium text-[#e6edf3] text-xs leading-tight'>{s.name}</p>
                  </Link>
                </td>
                <td className='px-3 py-2.5 text-xs text-[#8b949e] whitespace-nowrap'>{s.sector}</td>
                <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3] whitespace-nowrap'>
                  {s.price.toLocaleString('ja-JP')}
                  {s.prepost_flag && (
                    <span className='ml-1 text-[9px] bg-hold/20 text-hold border border-hold/30 px-1 py-0.5 rounded'>
                      {s.prepost_flag}
                    </span>
                  )}
                </td>
                <td className={clsx('px-3 py-2.5 font-mono text-sm font-medium whitespace-nowrap', s.change_pct >= 0 ? 'text-buy' : 'text-sell')}>
                  {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                </td>
                <td className='px-3 py-2.5'>
                  <span className={clsx('text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap', SIGNAL_STYLE[s.signal] ?? '')}>
                    {s.signal}
                  </span>
                </td>
                <td className='px-3 py-2.5'><ScoreBar score={s.score} /></td>
                <td className={clsx(
                  'px-3 py-2.5 font-mono text-sm',
                  s.rsi >= 70 ? 'text-sell' : s.rsi <= 30 ? 'text-buy' : 'text-[#e6edf3]'
                )}>
                  {s.rsi.toFixed(1)}
                </td>
                <td className={clsx('px-3 py-2.5 font-mono text-xs', s.macd_positive ? 'text-buy' : 'text-sell')}>
                  {s.macd_positive ? '▲ 正転' : '▼ 負転'}
                </td>
                <td className={clsx('px-3 py-2.5 font-mono text-sm', s.vwap_dev >= 0 ? 'text-buy' : 'text-sell')}>
                  {s.vwap_dev >= 0 ? '+' : ''}{s.vwap_dev.toFixed(1)}%
                </td>
                <td className='px-3 py-2.5 text-xs text-[#8b949e] whitespace-nowrap'>{s.timing}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className='py-16 text-center'>
            <p className='text-[#8b949e] text-sm'>条件に合う銘柄がありません</p>
            <p className='text-[#8b949e] text-xs mt-1'>
              {query ? '検索ワードを変更してください' : 'フィルターを変更してください'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
