'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useWebSocket } from '@/hooks/useWebSocket'
import IndexCard from './IndexCard'
import SectorHeatmap from './SectorHeatmap'
import NewsTicker from './NewsTicker'
import { deriveSectors } from '@/lib/sectors'
import type { IndexData, SignalData } from '@/lib/api'

interface Props {
  initialIndices: IndexData[]
  initialSignals: SignalData[]
  newsTicker: string[]
}

type MarketFilter = 'all' | 'JP' | 'US'

const SIGNAL_COLOR: Record<string, string> = {
  'Strong Buy': 'text-buy', 'Buy': 'text-[#85e89d]', 'Hold': 'text-hold',
  'Sell': 'text-[#f97583]', 'Strong Sell': 'text-sell',
}

function WsStatusBadge({ status, lastUpdated }: { status: string; lastUpdated: Date | null }) {
  return (
    <div className='flex items-center gap-2 text-xs text-[#8b949e]'>
      <span className={clsx(
        'w-2 h-2 rounded-full',
        status === 'open'   ? 'bg-buy animate-pulse' :
        status === 'closed' ? 'bg-sell' : 'bg-hold animate-pulse'
      )} />
      <span>
        {status === 'open'   ? 'ライブ接続中' :
         status === 'closed' ? '再接続中...' : '接続中...'}
      </span>
      {lastUpdated && (
        <span className='text-[10px]'>
          最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
        </span>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className='bg-card border border-dim rounded-lg p-4 flex flex-col gap-3 animate-pulse'>
      <div className='flex justify-between'>
        <div className='flex flex-col gap-1.5'>
          <div className='h-2.5 w-10 bg-[#21262d] rounded' />
          <div className='h-3.5 w-24 bg-[#21262d] rounded' />
        </div>
        <div className='h-4 w-6 bg-[#21262d] rounded' />
      </div>
      <div className='h-14 bg-[#21262d] rounded' />
      <div className='flex justify-between items-end'>
        <div className='h-6 w-28 bg-[#21262d] rounded' />
        <div className='h-4 w-20 bg-[#21262d] rounded' />
      </div>
    </div>
  )
}

function SkeletonHeatmap() {
  return (
    <div className='bg-card border border-dim rounded-lg p-4 animate-pulse'>
      <div className='h-4 w-32 bg-[#21262d] rounded mb-3' />
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className='h-20 bg-[#21262d] rounded-lg' />
        ))}
      </div>
    </div>
  )
}

function SignalCard({ signal }: { signal: SignalData }) {
  const positive = signal.change_pct >= 0
  return (
    <Link
      href={`/symbol/${signal.ticker}`}
      className='flex items-center justify-between py-2 border-b border-dim/50 last:border-0 hover:bg-[#1c2128] -mx-4 px-4 transition-colors'
    >
      <div className='min-w-0'>
        <p className='text-xs font-mono text-[#8b949e]'>{signal.ticker}</p>
        <p className='text-sm text-[#e6edf3] truncate'>{signal.name}</p>
        <p className='text-[10px] text-[#8b949e]'>{signal.sector}</p>
      </div>
      <div className='text-right shrink-0 ml-3'>
        <p className='text-xs font-medium text-[#8b949e] mb-0.5'>{signal.signal}</p>
        <p className={clsx('font-mono text-sm font-semibold', positive ? 'text-buy' : 'text-sell')}>
          {positive ? '+' : ''}{signal.change_pct.toFixed(2)}%
        </p>
        <div className='flex items-center justify-end gap-1 mt-0.5'>
          <div className='w-12 h-1 bg-[#30363d] rounded-full overflow-hidden'>
            <div
              className='h-full rounded-full'
              style={{
                width: `${signal.score}%`,
                backgroundColor: signal.score >= 70 ? '#3fb950' : signal.score >= 40 ? '#d29922' : '#f85149',
              }}
            />
          </div>
          <span className='text-[10px] font-mono text-[#8b949e]'>{signal.score}</span>
        </div>
        {signal.prepost_flag && (
          <span className='text-[9px] bg-hold/20 text-hold border border-hold/30 px-1 rounded'>
            {signal.prepost_flag}
          </span>
        )}
      </div>
    </Link>
  )
}

function SectorModal({ sectorName, signals, onClose }: {
  sectorName: string
  signals: SignalData[]
  onClose: () => void
}) {
  return (
    <div className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-card border border-dim rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col'>
        <div className='flex items-center justify-between px-4 py-3 border-b border-dim'>
          <h3 className='text-sm font-semibold text-[#e6edf3]'>{sectorName}</h3>
          <button onClick={onClose} className='text-[#8b949e] hover:text-[#e6edf3] transition-colors text-lg leading-none'>✕</button>
        </div>
        <div className='overflow-y-auto flex-1'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-xs text-[#8b949e] border-b border-dim bg-[#0d1117]/50 sticky top-0'>
                {['銘柄', '現在値', '騰落率', 'シグナル', 'スコア'].map(h => (
                  <th key={h} className='px-3 py-2 text-left font-medium first:pl-4'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.sort((a, b) => b.score - a.score).map(s => (
                <tr key={s.ticker} className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
                  <td className='px-3 py-2 pl-4'>
                    <Link href={`/symbol/${s.ticker}`} onClick={onClose} className='hover:text-accent transition-colors'>
                      <p className='font-mono text-[10px] text-[#8b949e]'>{s.ticker}</p>
                      <p className='text-sm text-[#e6edf3]'>{s.name}</p>
                    </Link>
                  </td>
                  <td className='px-3 py-2 font-mono text-sm text-[#e6edf3]'>{s.price.toLocaleString('ja-JP')}</td>
                  <td className={clsx('px-3 py-2 font-mono text-sm font-medium', s.change_pct >= 0 ? 'text-buy' : 'text-sell')}>
                    {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                  </td>
                  <td className={clsx('px-3 py-2 text-xs font-medium', SIGNAL_COLOR[s.signal] ?? '')}>
                    {s.signal}
                  </td>
                  <td className='px-3 py-2 font-mono text-sm text-[#e6edf3]'>{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function LiveDashboard({ initialIndices, initialSignals, newsTicker }: Props) {
  const { indices, signals, status, lastUpdated } = useWebSocket({
    indices: initialIndices,
    signals: initialSignals,
  })

  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all')
  const [selectedSector, setSelectedSector] = useState<string | null>(null)

  const filteredSignals = useMemo(
    () => marketFilter === 'all' ? signals : signals.filter(s => s.market === marketFilter),
    [signals, marketFilter]
  )
  const filteredIndices = useMemo(
    () => marketFilter === 'all' ? indices : indices.filter(i => i.market === marketFilter),
    [indices, marketFilter]
  )

  const sectors = useMemo(() => deriveSectors(filteredSignals), [filteredSignals])

  // Bug Fix: topBuy はスコア降順、topSell はスコア昇順（最も強い売りを上位に）
  const topBuy = useMemo(
    () => [...filteredSignals]
      .filter(s => s.signal === 'Strong Buy' || s.signal === 'Buy')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    [filteredSignals]
  )
  const topSell = useMemo(
    () => [...filteredSignals]
      .filter(s => s.signal === 'Sell' || s.signal === 'Strong Sell')
      .sort((a, b) => a.score - b.score)  // 昇順: スコアが低い = 売りシグナルが強い
      .slice(0, 5),
    [filteredSignals]
  )

  const loading = signals.length === 0 && status !== 'closed'

  const modalSignals = useMemo(
    () => selectedSector ? filteredSignals.filter(s => s.sector === selectedSector) : [],
    [selectedSector, filteredSignals]
  )

  const btnTab = (active: boolean) => clsx(
    'px-3 py-1.5 text-xs rounded-md transition-colors border',
    active
      ? 'bg-accent/20 text-accent border-accent/50'
      : 'text-[#8b949e] border-dim hover:text-[#e6edf3] hover:border-[#58a6ff]/30'
  )

  return (
    <div className='flex flex-col gap-4 max-w-[1600px] mx-auto'>
      {selectedSector && (
        <SectorModal
          sectorName={selectedSector}
          signals={modalSignals}
          onClose={() => setSelectedSector(null)}
        />
      )}

      <div className='flex items-center justify-between flex-wrap gap-2'>
        <div className='flex items-center gap-3'>
          <h1 className='text-base font-semibold text-[#e6edf3]'>Market Pulse</h1>
          <div className='flex gap-1.5'>
            {(['all', 'JP', 'US'] as const).map(m => (
              <button key={m} onClick={() => setMarketFilter(m)} className={btnTab(marketFilter === m)}>
                {m === 'all' ? '全市場' : m}
              </button>
            ))}
          </div>
        </div>
        <WsStatusBadge status={status} lastUpdated={lastUpdated} />
      </div>

      {/* インデックスカード */}
      {filteredIndices.length > 0 ? (
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
          {filteredIndices.map(idx => <IndexCard key={idx.symbol} data={idx} />)}
        </div>
      ) : loading ? (
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className='bg-card border border-dim rounded-lg p-4 text-center text-xs text-[#8b949e] py-6'>
          インデックスデータを取得中... (Yahoo Finance に接続しています)
        </div>
      )}

      {/* セクターヒートマップ */}
      {sectors.length > 0 ? (
        <SectorHeatmap sectors={sectors} onSectorClick={setSelectedSector} />
      ) : loading ? (
        <SkeletonHeatmap />
      ) : (
        <div className='bg-card border border-dim rounded-lg p-4'>
          <h2 className='text-sm font-semibold text-[#e6edf3] mb-2'>セクター別強弱マップ</h2>
          <p className='text-center py-6 text-xs text-[#8b949e]'>
            {filteredSignals.length > 0 ? 'セクターを集計中...' : '銘柄データを取得中...'}
          </p>
        </div>
      )}

      {/* トップシグナル */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div className='bg-card border border-dim rounded-lg p-4'>
          <h2 className='text-sm font-semibold text-buy mb-3'>▲ トップ買いシグナル</h2>
          {topBuy.length > 0 ? (
            <div className='flex flex-col'>
              {topBuy.map(s => <SignalCard key={s.ticker} signal={s} />)}
            </div>
          ) : loading ? (
            <div className='flex flex-col gap-2 animate-pulse'>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className='h-12 bg-[#21262d] rounded' />
              ))}
            </div>
          ) : (
            <p className='text-center py-6 text-xs text-[#8b949e]'>
              {filteredSignals.length > 0 ? '現在、買いシグナルに該当する銘柄はありません' : 'データを取得中...'}
            </p>
          )}
        </div>

        <div className='bg-card border border-dim rounded-lg p-4'>
          <h2 className='text-sm font-semibold text-sell mb-3'>▼ トップ売りシグナル</h2>
          {topSell.length > 0 ? (
            <div className='flex flex-col'>
              {topSell.map(s => <SignalCard key={s.ticker} signal={s} />)}
            </div>
          ) : loading ? (
            <div className='flex flex-col gap-2 animate-pulse'>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className='h-12 bg-[#21262d] rounded' />
              ))}
            </div>
          ) : (
            <p className='text-center py-6 text-xs text-[#8b949e]'>
              {filteredSignals.length > 0 ? '現在、売りシグナルに該当する銘柄はありません' : 'データを取得中...'}
            </p>
          )}
        </div>
      </div>

      {/* ニューステッカー */}
      <NewsTicker items={newsTicker} />
    </div>
  )
}
