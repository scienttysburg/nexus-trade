import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import clsx from 'clsx'
import StockChart from '@/components/symbol/StockChart'
import BacktestCard from '@/components/symbol/BacktestCard'
import PinButton from '@/components/watchlist/PinButton'

const SIGNAL_STYLE: Record<string, string> = {
  'Strong Buy': 'text-buy border-buy bg-[#1a4731]',
  'Buy':        'text-[#85e89d] border-[#3fb950]/50 bg-[#122d20]',
  'Hold':       'text-hold border-hold/50 bg-[#2d2a1a]',
  'Sell':       'text-[#f97583] border-sell/50 bg-[#2d1a1a]',
  'Strong Sell':'text-sell border-sell bg-[#3d1818]',
}

const SENTIMENT_ICON: Record<string, string> = {
  positive: '▲', neutral: '●', negative: '▼',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-buy', neutral: 'text-[#8b949e]', negative: 'text-sell',
}

function IndicatorCard({
  label, value, color, sub,
}: {
  label: string
  value: string
  color: string
  sub?: string
}) {
  return (
    <div className='bg-card border border-dim rounded-lg p-3 text-center hover:border-[#58a6ff]/30 transition-colors'>
      <p className='text-[10px] text-[#8b949e] mb-1 uppercase tracking-wide'>{label}</p>
      <p className={clsx('font-mono text-sm font-bold', color)}>{value}</p>
      {sub && <p className='text-[10px] text-[#8b949e] mt-0.5'>{sub}</p>}
    </div>
  )
}

export default async function SymbolPage({ params }: { params: { ticker: string } }) {
  let stock
  try {
    stock = await api.stock(params.ticker)
  } catch {
    notFound()
  }

  const positive = stock.change_pct >= 0
  const signalStyle = SIGNAL_STYLE[stock.signal] ?? ''

  const indicators = [
    {
      label: 'RSI (14)',
      value: stock.rsi.toFixed(1),
      color: stock.rsi >= 70 ? 'text-sell' : stock.rsi <= 30 ? 'text-buy' : 'text-[#e6edf3]',
      sub: stock.rsi >= 70 ? '過熱気味' : stock.rsi <= 30 ? '売られすぎ' : '中立',
    },
    {
      label: 'MACD',
      value: stock.macd_value.toFixed(4),
      color: stock.macd_value >= 0 ? 'text-buy' : 'text-sell',
      sub: stock.macd_value >= 0 ? '正転 (上昇)' : '負転 (下降)',
    },
    {
      label: 'MACD Signal',
      value: stock.macd_signal_line.toFixed(4),
      color: 'text-[#e6edf3]',
    },
    {
      label: 'VWAP',
      value: stock.vwap.toLocaleString('ja-JP'),
      color: 'text-[#e6edf3]',
    },
    {
      label: 'VWAP乖離',
      value: `${stock.vwap_dev >= 0 ? '+' : ''}${stock.vwap_dev.toFixed(2)}%`,
      color: stock.vwap_dev >= 0 ? 'text-buy' : 'text-sell',
      sub: stock.vwap_dev >= 0 ? 'VWAP上方' : 'VWAP下方',
    },
    {
      label: 'MA5',
      value: stock.ma5.toLocaleString('ja-JP'),
      color: stock.price >= stock.ma5 ? 'text-buy' : 'text-sell',
      sub: stock.price >= stock.ma5 ? '株価 > MA5' : '株価 < MA5',
    },
    {
      label: 'MA25',
      value: stock.ma25.toLocaleString('ja-JP'),
      color: stock.price >= stock.ma25 ? 'text-buy' : 'text-sell',
      sub: stock.price >= stock.ma25 ? '株価 > MA25' : '株価 < MA25',
    },
    {
      label: 'MA75',
      value: stock.ma75.toLocaleString('ja-JP'),
      color: stock.price >= stock.ma75 ? 'text-buy' : 'text-sell',
      sub: stock.price >= stock.ma75 ? '株価 > MA75' : '株価 < MA75',
    },
  ]

  return (
    <div className='flex flex-col gap-4 max-w-[1400px] mx-auto'>

      {/* ヘッダー */}
      <div className='bg-card border border-dim rounded-lg p-4'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0'>
            <p className='font-mono text-xs text-[#8b949e]'>
              {stock.ticker}
              <span className='mx-1.5 opacity-40'>·</span>
              {stock.sector}
            </p>
            <h1 className='text-2xl font-bold text-[#e6edf3] mt-0.5'>{stock.name}</h1>
          </div>

          <div className='flex items-start gap-4'>
            <PinButton ticker={stock.ticker} />
            <div className='text-right'>
              <p className='font-mono text-3xl font-bold text-[#e6edf3] leading-none'>
                {stock.price.toLocaleString('ja-JP')}
              </p>
              <p className={clsx('font-mono text-base mt-1', positive ? 'text-buy' : 'text-sell')}>
                {positive ? '+' : ''}{stock.change_pct.toFixed(2)}%
              </p>
            </div>

            <div className={clsx('border rounded-lg px-4 py-2.5 text-center min-w-[90px]', signalStyle)}>
              <p className='text-[10px] opacity-70 uppercase tracking-wide mb-0.5'>シグナル</p>
              <p className='font-bold text-sm leading-tight'>{stock.signal}</p>
              <p className='font-mono text-2xl font-bold leading-tight'>{stock.score}</p>
              <p className='text-[10px] opacity-70'>/ 100</p>
            </div>
          </div>
        </div>
      </div>

      {/* チャート */}
      <StockChart ohlcv={stock.ohlcv} />

      {/* テクニカル指標 */}
      <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2'>
        {indicators.map(item => (
          <IndicatorCard key={item.label} {...item} />
        ))}
      </div>

      {/* エントリーアドバイス */}
      <div className='bg-card border border-accent/30 rounded-lg p-4'>
        <h2 className='text-sm font-semibold text-accent mb-3'>⚡ エントリータイミング分析</h2>
        <pre className='text-sm text-[#c9d1d9] whitespace-pre-wrap font-sans leading-relaxed'>{stock.timing_advice}</pre>
      </div>

      {/* バックテスト */}
      <BacktestCard ticker={stock.ticker} />

      {/* 関連ニュース */}
      {stock.news.length > 0 && (
        <div className='bg-card border border-dim rounded-lg p-4'>
          <h2 className='text-sm font-semibold text-[#e6edf3] mb-3'>
            関連ニュース
            <span className='ml-2 text-xs font-normal text-[#8b949e]'>{stock.news.length} 件</span>
          </h2>
          <div className='flex flex-col gap-0'>
            {stock.news.map(n => (
              <div key={n.id} className='flex items-start gap-3 py-2.5 border-b border-dim/50 last:border-0'>
                <span className={clsx('text-xs font-bold mt-0.5 shrink-0 w-3 text-center', SENTIMENT_COLOR[n.sentiment])}>
                  {SENTIMENT_ICON[n.sentiment]}
                </span>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm text-[#e6edf3] leading-snug'>{n.title}</p>
                  <p className='text-xs text-[#8b949e] mt-0.5'>{n.source} · {n.published_at}</p>
                </div>
                <span className={clsx('font-mono text-xs shrink-0 font-medium', n.sentiment_score >= 0 ? 'text-buy' : 'text-sell')}>
                  {n.sentiment_score >= 0 ? '+' : ''}{n.sentiment_score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
