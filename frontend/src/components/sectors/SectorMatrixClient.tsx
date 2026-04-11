'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useWebSocket } from '@/hooks/useWebSocket'
import { deriveSectors } from '@/lib/sectors'
import type { SignalData } from '@/lib/api'

const SIGNAL_STYLE: Record<string, string> = {
  strong_buy:  'bg-[#1a4731] border-buy text-buy',
  buy:         'bg-[#122d20] border-[#3fb950]/50 text-[#85e89d]',
  hold:        'bg-[#2d2a1a] border-[#d29922]/50 text-[#d29922]',
  sell:        'bg-[#2d1a1a] border-[#f85149]/50 text-[#f97583]',
  strong_sell: 'bg-[#3d1818] border-sell text-sell',
}
const SIGNAL_LABEL: Record<string, string> = {
  strong_buy: '強買', buy: '買い', hold: '様子見', sell: '売り', strong_sell: '強売',
}
const SIGNAL_COLOR: Record<string, string> = {
  'Strong Buy': 'text-buy', 'Buy': 'text-[#85e89d]', 'Hold': 'text-hold',
  'Sell': 'text-[#f97583]', 'Strong Sell': 'text-sell',
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
          <button
            onClick={onClose}
            className='text-[#8b949e] hover:text-[#e6edf3] transition-colors text-lg leading-none'
          >
            ✕
          </button>
        </div>
        <div className='overflow-y-auto flex-1'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-xs text-[#8b949e] border-b border-dim bg-[#0d1117]/50 sticky top-0'>
                {['銘柄', '市場', '現在値', '騰落率', 'シグナル', 'スコア'].map(h => (
                  <th key={h} className='px-3 py-2.5 text-left font-medium first:pl-4'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map(s => (
                <tr key={s.ticker} className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors'>
                  <td className='px-3 py-2.5 pl-4'>
                    <Link href={`/symbol/${s.ticker}`} onClick={onClose} className='hover:text-accent transition-colors'>
                      <p className='font-mono text-[11px] text-[#8b949e]'>{s.ticker}</p>
                      <p className='text-sm text-[#e6edf3]'>{s.name}</p>
                    </Link>
                  </td>
                  <td className='px-3 py-2.5 text-xs text-[#8b949e]'>{s.market}</td>
                  <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3]'>
                    {s.price.toLocaleString('ja-JP')}
                  </td>
                  <td className={clsx('px-3 py-2.5 font-mono text-sm font-medium', s.change_pct >= 0 ? 'text-buy' : 'text-sell')}>
                    {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                  </td>
                  <td className={clsx('px-3 py-2.5 text-xs font-medium', SIGNAL_COLOR[s.signal] ?? '')}>
                    {s.signal}
                  </td>
                  <td className='px-3 py-2.5 font-mono text-sm text-[#e6edf3]'>{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function SectorMatrixClient({ initialSignals }: { initialSignals: SignalData[] }) {
  const { signals } = useWebSocket({ indices: [], signals: initialSignals })
  const [marketFilter, setMarketFilter] = useState<'all' | 'JP' | 'US'>('all')
  const [selectedSector, setSelectedSector] = useState<string | null>(null)

  const filteredSignals = useMemo(
    () => marketFilter === 'all' ? signals : signals.filter(s => s.market === marketFilter),
    [signals, marketFilter]
  )
  const sectors = useMemo(() => deriveSectors(filteredSignals), [filteredSignals])

  const modalSignals = useMemo(
    () => selectedSector
      ? [...filteredSignals.filter(s => s.sector === selectedSector)]
          .sort((a, b) => b.score - a.score)
      : [],
    [selectedSector, filteredSignals]
  )

  const btn = (active: boolean) => clsx(
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

      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>Sector Matrix</h1>
          <p className='text-sm text-[#8b949e]'>セクター別資金循環・強弱分析</p>
        </div>
        <div className='flex gap-2'>
          {(['all', 'JP', 'US'] as const).map(m => (
            <button key={m} onClick={() => setMarketFilter(m)} className={btn(marketFilter === m)}>
              {m === 'all' ? '全市場' : m}
            </button>
          ))}
        </div>
      </div>

      <div className='bg-card border border-dim rounded-lg p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-sm font-semibold text-[#e6edf3]'>セクター一覧</h2>
          <span className='text-[10px] text-[#8b949e]'>{sectors.length} セクター ／ クリックで銘柄一覧</span>
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'>
          {sectors.map(s => (
            <button
              key={s.code}
              onClick={() => setSelectedSector(s.name)}
              className={clsx(
                'border rounded-lg p-2.5 flex flex-col gap-1 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg text-left',
                SIGNAL_STYLE[s.signal]
              )}
            >
              <span className='text-[11px] font-medium leading-tight truncate' title={s.name}>{s.name}</span>
              <span className='font-mono text-base font-bold leading-none'>
                {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
              </span>
              <div className='h-0.5 bg-black/20 rounded-full overflow-hidden'>
                <div
                  className='h-full rounded-full'
                  style={{
                    width: `${Math.min(Math.abs(s.change_pct) / 4 * 100, 100)}%`,
                    backgroundColor: s.signal.includes('buy') ? '#3fb950' : s.signal.includes('sell') ? '#f85149' : '#d29922',
                  }}
                />
              </div>
              <div className='flex items-center justify-between mt-0.5'>
                <span className='text-[10px] opacity-75 font-medium'>{SIGNAL_LABEL[s.signal]}</span>
                <span className='text-[9px] opacity-50'>{s.top_tickers.length > 0 ? s.top_tickers[0].replace('.T', '') : ''}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* セクター詳細テーブル */}
      <div className='bg-card border border-dim rounded-lg'>
        <div className='px-4 py-3 border-b border-dim'>
          <h2 className='text-sm font-semibold text-[#e6edf3]'>セクター詳細</h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-xs text-[#8b949e] border-b border-dim bg-[#0d1117]/50'>
                {['セクター', '平均騰落率', 'シグナル', '構成銘柄数', '主要銘柄'].map(h => (
                  <th key={h} className='px-4 py-2.5 text-left font-medium'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map(s => {
                const sectorSignals = filteredSignals.filter(sig => sig.sector === s.name)
                return (
                  <tr
                    key={s.code}
                    className='border-b border-dim/40 hover:bg-[#1c2128] transition-colors cursor-pointer'
                    onClick={() => setSelectedSector(s.name)}
                  >
                    <td className='px-4 py-2.5 text-sm text-[#e6edf3] font-medium'>{s.name}</td>
                    <td className={clsx('px-4 py-2.5 font-mono text-sm font-medium', s.change_pct >= 0 ? 'text-buy' : 'text-sell')}>
                      {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                    </td>
                    <td className={clsx('px-4 py-2.5 text-xs font-medium', SIGNAL_STYLE[s.signal].split(' ').find(c => c.startsWith('text-')) ?? '')}>
                      {SIGNAL_LABEL[s.signal]}
                    </td>
                    <td className='px-4 py-2.5 text-xs text-[#8b949e]'>{sectorSignals.length} 銘柄</td>
                    <td className='px-4 py-2.5 text-xs text-[#8b949e]'>
                      {s.top_tickers.slice(0, 3).map(t => t.replace('.T', '')).join(' / ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
