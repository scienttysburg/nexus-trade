import type { SectorData } from '@/lib/api'
import clsx from 'clsx'

const SIGNAL_STYLE: Record<SectorData['signal'], string> = {
  strong_buy:  'bg-[#1a4731] border-buy text-buy',
  buy:         'bg-[#122d20] border-[#3fb950]/50 text-[#85e89d]',
  hold:        'bg-[#2d2a1a] border-[#d29922]/50 text-[#d29922]',
  sell:        'bg-[#2d1a1a] border-[#f85149]/50 text-[#f97583]',
  strong_sell: 'bg-[#3d1818] border-sell text-sell',
}

const SIGNAL_LABEL: Record<SectorData['signal'], string> = {
  strong_buy: '強買', buy: '買い', hold: '様子見', sell: '売り', strong_sell: '強売',
}

const BAR_COLOR: Record<SectorData['signal'], string> = {
  strong_buy: '#3fb950', buy: '#3fb950', hold: '#d29922', sell: '#f85149', strong_sell: '#f85149',
}

export default function SectorHeatmap({ sectors }: { sectors: SectorData[] }) {
  return (
    <div className='bg-card border border-dim rounded-lg p-4'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-sm font-semibold text-[#e6edf3]'>セクター別強弱マップ</h2>
        <span className='text-[10px] text-[#8b949e]'>{sectors.length} セクター</span>
      </div>
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'>
        {sectors.map(s => (
          <div
            key={s.code}
            className={clsx(
              'border rounded-lg p-2.5 flex flex-col gap-1 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg cursor-default',
              SIGNAL_STYLE[s.signal]
            )}
          >
            <span className='text-[11px] font-medium leading-tight truncate' title={s.name}>{s.name}</span>
            <span className='font-mono text-base font-bold leading-none'>
              {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
            </span>

            {/* 変動率バー */}
            <div className='h-0.5 bg-black/20 rounded-full overflow-hidden'>
              <div
                className='h-full rounded-full'
                style={{
                  width: `${Math.min(Math.abs(s.change_pct) / 4 * 100, 100)}%`,
                  backgroundColor: BAR_COLOR[s.signal],
                }}
              />
            </div>

            <div className='flex items-center justify-between mt-0.5'>
              <span className='text-[10px] opacity-75 font-medium'>{SIGNAL_LABEL[s.signal]}</span>
              {s.top_tickers.length > 0 && (
                <div className='flex gap-1'>
                  {s.top_tickers.slice(0, 2).map(t => (
                    <span key={t} className='text-[9px] font-mono opacity-50 leading-none'>{t.replace('.T', '')}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
