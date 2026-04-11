'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useWebSocket } from '@/hooks/useWebSocket'

const STORAGE_KEY = 'nexus_watchlist'

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setTickers(JSON.parse(saved))
    } catch {}
  }, [])

  const pin = (ticker: string) => {
    setTickers(prev => {
      const next = prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const isPinned = (ticker: string) => tickers.includes(ticker)

  return { tickers, pin, isPinned }
}

const SIGNAL_COLOR: Record<string, string> = {
  'Strong Buy': 'text-buy',
  'Buy':        'text-[#85e89d]',
  'Hold':       'text-hold',
  'Sell':       'text-[#f97583]',
  'Strong Sell':'text-sell',
}

export default function WatchlistClient() {
  const { tickers, pin } = useWatchlist()
  const { signals, status } = useWebSocket({ indices: [], signals: [] })

  const watchSignals = useMemo(
    () => signals.filter(s => tickers.includes(s.ticker)),
    [signals, tickers]
  )

  return (
    <div className='flex flex-col gap-4 max-w-[1200px] mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>Watchlist</h1>
          <p className='text-sm text-[#8b949e]'>
            ピン留め銘柄 {tickers.length} 件
            {status === 'open' && <span className='ml-2 text-[10px] text-buy'>● ライブ</span>}
          </p>
        </div>
      </div>

      {tickers.length === 0 ? (
        <div className='bg-card border border-dim rounded-lg py-20 text-center'>
          <p className='text-[#8b949e] text-sm'>ピン留めした銘柄がありません</p>
          <p className='text-[#8b949e] text-xs mt-2'>
            <Link href='/screener' className='text-accent hover:underline'>シグナルスクリーナー</Link>
            または銘柄詳細ページから ★ でピン留めできます
          </p>
        </div>
      ) : (
        <div className='bg-card border border-dim rounded-lg'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm min-w-[700px]'>
              <thead>
                <tr className='text-xs text-[#8b949e] border-b border-dim bg-[#0d1117]/50'>
                  {['銘柄', 'セクター', '現在値', '騰落率', 'シグナル', 'スコア', 'RSI', ''].map(h => (
                    <th key={h} className='px-3 py-2.5 text-left font-medium whitespace-nowrap first:pl-4'>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickers.map(ticker => {
                  const s = watchSignals.find(x => x.ticker === ticker)
                  if (!s) return (
                    <tr key={ticker} className='border-b border-dim/40'>
                      <td className='px-3 py-2.5 pl-4 font-mono text-[#8b949e] text-sm'>{ticker}</td>
                      <td colSpan={6} className='px-3 py-2.5 text-xs text-[#8b949e]'>データ取得中...</td>
                      <td className='px-3 py-2.5'>
                        <button onClick={() => pin(ticker)} className='text-[10px] text-sell hover:text-sell/70'>★ 解除</button>
                      </td>
                    </tr>
                  )
                  return (
                    <tr key={ticker} className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
                      <td className='px-3 py-2.5 pl-4'>
                        <Link href={`/symbol/${s.ticker}`} className='hover:text-accent transition-colors'>
                          <p className='font-mono text-[11px] text-[#8b949e]'>{s.ticker}</p>
                          <p className='text-sm text-[#e6edf3]'>{s.name}</p>
                        </Link>
                      </td>
                      <td className='px-3 py-2.5 text-xs text-[#8b949e]'>{s.sector}</td>
                      <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3]'>
                        {s.price.toLocaleString('ja-JP')}
                        {s.prepost_flag && (
                          <span className='ml-1 text-[9px] bg-hold/20 text-hold border border-hold/30 px-1 py-0.5 rounded'>
                            {s.prepost_flag}
                          </span>
                        )}
                      </td>
                      <td className={clsx('px-3 py-2.5 font-mono text-sm font-medium', s.change_pct >= 0 ? 'text-buy' : 'text-sell')}>
                        {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                      </td>
                      <td className={clsx('px-3 py-2.5 text-xs font-medium', SIGNAL_COLOR[s.signal] ?? '')}>
                        {s.signal}
                      </td>
                      <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3]'>{s.score}</td>
                      <td className={clsx('px-3 py-2.5 font-mono text-sm', s.rsi >= 70 ? 'text-sell' : s.rsi <= 30 ? 'text-buy' : 'text-[#e6edf3]')}>
                        {s.rsi.toFixed(1)}
                      </td>
                      <td className='px-3 py-2.5'>
                        <button onClick={() => pin(ticker)} className='text-[10px] text-hold hover:text-sell transition-colors'>
                          ★ 解除
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
