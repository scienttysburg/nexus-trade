'use client'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import type { IndexData } from '@/lib/api'

function fmt(n: number) {
  return n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function IndexCard({ data }: { data: IndexData }) {
  const positive = data.change_pct >= 0
  const color = positive ? '#3fb950' : '#f85149'
  const chartData = data.sparkline.map((v, i) => ({ i, v }))

  return (
    <div
      className='bg-card border border-dim rounded-lg p-4 flex flex-col gap-2.5 transition-all duration-200 hover:border-[#58a6ff]/50 hover:shadow-lg hover:shadow-[#58a6ff]/5 cursor-default'
    >
      <div className='flex justify-between items-start'>
        <div>
          <p className='text-xs text-[#8b949e] font-mono'>{data.symbol}</p>
          <p className='text-sm font-semibold text-[#e6edf3]'>{data.name}</p>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${
          data.market === 'JP'
            ? 'bg-[#1f3a5f] text-[#58a6ff]'
            : 'bg-[#3a2a1f] text-[#e3b341]'
        }`}>
          {data.market}
        </span>
      </div>

      <div className='h-14'>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${data.symbol}`} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%'  stopColor={color} stopOpacity={0.25} />
                <stop offset='95%' stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 6,
                fontSize: 11,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
              formatter={(v: number) => [fmt(v), '']}
              labelFormatter={() => ''}
            />
            <Area
              type='monotone'
              dataKey='v'
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#g-${data.symbol})`}
              dot={false}
              activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className='flex justify-between items-end'>
        <span className='font-mono text-xl font-bold text-[#e6edf3] leading-none'>
          {fmt(data.value)}
        </span>
        <div className='text-right'>
          <p className={`font-mono text-xs font-medium ${positive ? 'text-buy' : 'text-sell'}`}>
            {positive ? '+' : ''}{data.change.toFixed(2)}
          </p>
          <p className={`font-mono text-sm font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
            {positive ? '+' : ''}{data.change_pct.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  )
}
