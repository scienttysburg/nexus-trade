'use client'
import { useMemo } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { OHLCVData } from '@/lib/api'

interface CandlePoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  s0: number
  s1: number
  s2: number
  s3: number
  isUp: boolean
  color: string
}

const WickShape = ({ x, y, width, height, payload }: any) => {
  if (!height || height <= 0) return null
  const cx = x + width / 2
  return (
    <rect
      x={cx - 0.5}
      y={y}
      width={1}
      height={Math.max(height, 0.5)}
      fill={payload?.color ?? '#8b949e'}
    />
  )
}

const BodyShape = ({ x, y, width, height, payload }: any) => {
  const bw = Math.max((width ?? 8) - 2, 1)
  const bh = Math.max(height ?? 0, 1)
  return (
    <rect
      x={x + 1}
      y={y}
      width={bw}
      height={bh}
      fill={payload?.color ?? '#8b949e'}
      rx={1}
    />
  )
}

function CandleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d: CandlePoint = payload[0]?.payload
  if (!d) return null
  const fmt = (n: number) =>
    n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: '10px 12px',
      fontSize: 11,
      lineHeight: 1.6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: '#8b949e', marginBottom: 6, fontWeight: 600 }}>{d.date}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px 12px' }}>
        <span style={{ color: '#8b949e' }}>始値</span>
        <span style={{ fontFamily: 'monospace', color: '#e6edf3', textAlign: 'right' }}>{fmt(d.open)}</span>
        <span style={{ color: '#8b949e' }}>高値</span>
        <span style={{ fontFamily: 'monospace', color: '#3fb950', textAlign: 'right' }}>{fmt(d.high)}</span>
        <span style={{ color: '#8b949e' }}>安値</span>
        <span style={{ fontFamily: 'monospace', color: '#f85149', textAlign: 'right' }}>{fmt(d.low)}</span>
        <span style={{ color: '#8b949e' }}>終値</span>
        <span style={{
          fontFamily: 'monospace',
          color: d.isUp ? '#3fb950' : '#f85149',
          textAlign: 'right',
          fontWeight: 700,
        }}>{fmt(d.close)}</span>
      </div>
    </div>
  )
}

export default function StockChart({ ohlcv }: { ohlcv: OHLCVData[] }) {
  const { data, domainMin, domainMax } = useMemo(() => {
    if (!ohlcv.length) return { data: [], domainMin: 0, domainMax: 1 }

    const allPrices = ohlcv.flatMap(d => [d.high, d.low])
    const rawMin = Math.min(...allPrices)
    const rawMax = Math.max(...allPrices)
    const dMin = rawMin * 0.998
    const dMax = rawMax * 1.002
    const minBody = (dMax - dMin) * 0.003

    const points: CandlePoint[] = ohlcv.map(d => {
      const bodyLow  = Math.min(d.open, d.close)
      const bodyHigh = Math.max(d.open, d.close)
      const isUp = d.close >= d.open
      return {
        date: d.date,
        open: d.open, high: d.high, low: d.low, close: d.close,
        volume: d.volume,
        s0: d.low - dMin,
        s1: bodyLow - d.low,
        s2: Math.max(bodyHigh - bodyLow, minBody),
        s3: d.high - bodyHigh,
        isUp,
        color: isUp ? '#3fb950' : '#f85149',
      }
    })
    return { data: points, domainMin: dMin, domainMax: dMax }
  }, [ohlcv])

  if (!data.length) {
    return (
      <div className='bg-card border border-dim rounded-lg p-4'>
        <h2 className='text-sm font-semibold text-[#e6edf3] mb-3'>株価チャート (日足 · 60日)</h2>
        <div className='h-72 flex items-center justify-center text-[#8b949e] text-sm'>
          チャートデータを取得中...
        </div>
      </div>
    )
  }

  const tickFmt = (v: number) =>
    (v + domainMin).toLocaleString('ja-JP', { maximumFractionDigits: 0 })

  return (
    <div className='bg-card border border-dim rounded-lg p-4'>
      <h2 className='text-sm font-semibold text-[#e6edf3] mb-3'>株価チャート (日足 · 60日)</h2>

      {/* ローソク足 */}
      <div className='h-72'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }} barCategoryGap='15%'>
            <CartesianGrid strokeDasharray='3 3' stroke='#21262d' vertical={false} />
            <XAxis
              dataKey='date'
              tick={{ fontSize: 10, fill: '#8b949e' }}
              tickLine={false}
              axisLine={{ stroke: '#30363d' }}
              tickFormatter={v => v.slice(5)}
              interval='preserveStartEnd'
            />
            <YAxis
              domain={[0, domainMax - domainMin]}
              tick={{ fontSize: 10, fill: '#8b949e', fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={tickFmt}
              width={72}
            />
            <Tooltip content={<CandleTooltip />} cursor={{ fill: '#58a6ff0d' }} />
            {/* スタック: 透明フィラー → 下ひげ → ボディ → 上ひげ */}
            <Bar dataKey='s0' stackId='c' fill='transparent' isAnimationActive={false} legendType='none' />
            <Bar dataKey='s1' stackId='c' shape={<WickShape />}  isAnimationActive={false} legendType='none' />
            <Bar dataKey='s2' stackId='c' shape={<BodyShape />}  isAnimationActive={false} legendType='none' />
            <Bar dataKey='s3' stackId='c' shape={<WickShape />}  isAnimationActive={false} legendType='none' />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 出来高 */}
      <div className='h-14 mt-1'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart data={data} margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap='15%'>
            <XAxis dataKey='date' hide />
            <YAxis hide />
            <Bar dataKey='volume' isAnimationActive={false} radius={[1, 1, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.isUp ? '#3fb95055' : '#f8514955'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className='text-[10px] text-center text-[#8b949e] mt-0.5'>出来高</p>
    </div>
  )
}
