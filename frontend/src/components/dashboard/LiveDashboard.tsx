'use client'
import { useMemo } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import IndexCard from './IndexCard'
import SectorHeatmap from './SectorHeatmap'
import NewsTicker from './NewsTicker'
import { deriveSectors } from '@/lib/sectors'
import type { IndexData, SignalData } from '@/lib/api'
import clsx from 'clsx'

interface Props {
  initialIndices: IndexData[]
  initialSignals: SignalData[]
  newsTicker: string[]
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
    <div className='flex items-center justify-between py-2 border-b border-dim/50 last:border-0'>
      <div className='min-w-0'>
        <p className='text-xs font-mono text-[#8b949e]'>{signal.ticker}</p>
        <p className='text-sm text-[#e6edf3] truncate'>{signal.name}</p>
        <p className='text-[10px] text-[#8b949e]'>{signal.sector}</p>
      </div>
      <div className='text-right shrink-0 ml-3'>
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
      </div>
    </div>
  )
}

export default function LiveDashboard({ initialIndices, initialSignals, newsTicker }: Props) {
  const { indices, signals, status, lastUpdated } = useWebSocket({
    indices: initialIndices,
    signals: initialSignals,
  })

  const sectors = useMemo(() => deriveSectors(signals), [signals])
  const topBuy  = useMemo(
    () => signals.filter(s => s.signal === 'Strong Buy' || s.signal === 'Buy').slice(0, 5),
    [signals]
  )
  const topSell = useMemo(
    () => signals.filter(s => s.signal === 'Sell' || s.signal === 'Strong Sell').slice(0, 5),
    [signals]
  )

  const loading = signals.length === 0 && status !== 'closed'

  return (
    <div className='flex flex-col gap-4 max-w-[1600px] mx-auto'>
      <div className='flex items-center justify-between'>
        <h1 className='text-base font-semibold text-[#e6edf3]'>グローバルダッシュボード</h1>
        <WsStatusBadge status={status} lastUpdated={lastUpdated} />
      </div>

      {/* インデックスカード */}
      {indices.length > 0 ? (
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
          {indices.map(idx => <IndexCard key={idx.symbol} data={idx} />)}
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
        <SectorHeatmap sectors={sectors} />
      ) : loading ? (
        <SkeletonHeatmap />
      ) : (
        <div className='bg-card border border-dim rounded-lg p-4'>
          <h2 className='text-sm font-semibold text-[#e6edf3] mb-2'>セクター別強弱マップ</h2>
          <p className='text-center py-6 text-xs text-[#8b949e]'>
            {signals.length > 0
              ? 'セクターを集計中...'
              : '銘柄データを取得中... (初回起動は数十秒かかる場合があります)'}
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
              {signals.length > 0
                ? '現在、買いシグナル (Buy/Strong Buy) に該当する銘柄はありません'
                : 'データを取得中...'}
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
              {signals.length > 0
                ? '現在、売りシグナル (Sell/Strong Sell) に該当する銘柄はありません'
                : 'データを取得中...'}
            </p>
          )}
        </div>
      </div>

      {/* ニューステッカー */}
      <NewsTicker items={newsTicker} />
    </div>
  )
}
