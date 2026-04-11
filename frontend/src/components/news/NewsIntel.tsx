'use client'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { NewsItem } from '@/lib/api'

const IMPACT_STYLE: Record<string, string> = {
  high:   'bg-[#3d1818] text-sell border border-sell/50',
  medium: 'bg-[#2d2a1a] text-hold border border-hold/30',
  low:    'bg-[#161b22] text-[#8b949e] border border-dim',
}
const IMPACT_LABEL: Record<string, string> = {
  high: '高', medium: '中', low: '低',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-buy',
  negative: 'text-sell',
  neutral:  'text-[#8b949e]',
}
const SENTIMENT_ICON: Record<string, string> = {
  positive: '▲', negative: '▼', neutral: '●',
}

type ImpactFilter = 'all' | 'high' | 'medium' | 'low'
type SentimentFilter = 'all' | 'positive' | 'negative' | 'neutral'

const btn = (active: boolean) => clsx(
  'px-3 py-1.5 text-xs rounded-md transition-colors border',
  active
    ? 'bg-accent/20 text-accent border-accent/50'
    : 'text-[#8b949e] border-dim hover:text-[#e6edf3] hover:border-[#58a6ff]/30'
)

export default function NewsIntel({ initialNews }: { initialNews: NewsItem[] }) {
  const [impact, setImpact] = useState<ImpactFilter>('all')
  const [sentiment, setSentiment] = useState<SentimentFilter>('all')
  const [showNoise, setShowNoise] = useState(false)

  const news = useMemo(() => {
    let data = initialNews
    if (!showNoise) data = data.filter(n => !n.is_noise)
    if (impact !== 'all') data = data.filter(n => n.impact === impact)
    if (sentiment !== 'all') data = data.filter(n => n.sentiment === sentiment)
    return data
  }, [initialNews, impact, sentiment, showNoise])

  const highCount = initialNews.filter(n => !n.is_noise && n.impact === 'high').length

  return (
    <div className='flex flex-col gap-4 max-w-[1200px] mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-lg font-semibold text-[#e6edf3]'>Market Intel</h1>
          <p className='text-sm text-[#8b949e]'>
            AIキュレーション済みニュース
            {highCount > 0 && (
              <span className='ml-2 text-sell font-medium'>高インパクト {highCount}件</span>
            )}
          </p>
        </div>
      </div>

      {/* フィルターバー */}
      <div className='bg-card border border-dim rounded-lg px-4 py-3 flex flex-wrap items-center gap-3'>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-[#8b949e]'>重要度:</span>
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button key={f} onClick={() => setImpact(f)} className={btn(impact === f)}>
              {f === 'all' ? 'すべて' : f === 'high' ? '高' : f === 'medium' ? '中' : '低'}
            </button>
          ))}
        </div>
        <div className='flex items-center gap-2 ml-4'>
          <span className='text-xs text-[#8b949e]'>センチメント:</span>
          {(['all', 'positive', 'negative', 'neutral'] as const).map(f => (
            <button key={f} onClick={() => setSentiment(f)} className={btn(sentiment === f)}>
              {f === 'all' ? 'すべて' : f === 'positive' ? '▲ 強気' : f === 'negative' ? '▼ 弱気' : '● 中立'}
            </button>
          ))}
        </div>
        <label className='flex items-center gap-1.5 ml-auto cursor-pointer text-xs text-[#8b949e]'>
          <input
            type='checkbox'
            checked={showNoise}
            onChange={e => setShowNoise(e.target.checked)}
            className='accent-accent'
          />
          ノイズを含む
        </label>
        <span className='text-xs text-[#8b949e] font-mono'>{news.length} 件</span>
      </div>

      {/* ニュースリスト */}
      <div className='flex flex-col gap-2'>
        {news.length === 0 ? (
          <div className='bg-card border border-dim rounded-lg py-16 text-center text-xs text-[#8b949e]'>
            条件に合うニュースがありません
          </div>
        ) : news.map(n => (
          <div
            key={n.id}
            className='bg-card border border-dim rounded-lg p-4 flex items-start gap-3 hover:bg-[#1c2128] transition-colors'
          >
            <div className='flex flex-col items-center gap-1 shrink-0 pt-0.5'>
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                IMPACT_STYLE[n.impact]
              )}>
                {IMPACT_LABEL[n.impact]}
              </span>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm text-[#e6edf3] leading-snug'>{n.title}</p>
              <div className='flex items-center gap-3 mt-1.5'>
                <span className={clsx('text-xs font-medium', SENTIMENT_COLOR[n.sentiment])}>
                  {SENTIMENT_ICON[n.sentiment]}{' '}
                  {n.sentiment === 'positive' ? '強気' : n.sentiment === 'negative' ? '弱気' : '中立'}
                  {' '}({n.sentiment_score >= 0 ? '+' : ''}{n.sentiment_score.toFixed(2)})
                </span>
                <span className='text-[10px] text-[#8b949e]'>{n.source}</span>
                <span className='text-[10px] text-[#8b949e] ml-auto'>{n.published_at}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
