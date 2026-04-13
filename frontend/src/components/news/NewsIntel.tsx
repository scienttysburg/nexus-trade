'use client'
import { useState, useMemo, useCallback, useRef } from 'react'
import clsx from 'clsx'
import type { NewsItem } from '@/lib/api'

const PAGE_SIZE = 20

const IMPACT_STYLE: Record<string, string> = {
  high:   'bg-[#3d1818] text-sell border border-sell/50',
  medium: 'bg-[#2d2a1a] text-hold border border-hold/30',
  low:    'bg-[#161b22] text-[#8b949e] border border-dim',
}
const IMPACT_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }
const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-buy', negative: 'text-sell', neutral: 'text-[#8b949e]',
}
const SENTIMENT_ICON: Record<string, string> = {
  positive: '▲', negative: '▼', neutral: '●',
}

type CategoryTab = 'all' | 'stock' | 'crypto' | 'high'
type ImpactFilter = 'all' | 'high' | 'medium' | 'low'
type SentimentFilter = 'all' | 'positive' | 'negative' | 'neutral'

const btn = (active: boolean) => clsx(
  'px-3 py-1.5 text-xs rounded-md transition-colors border',
  active
    ? 'bg-accent/20 text-accent border-accent/50'
    : 'text-[#8b949e] border-dim hover:text-[#e6edf3] hover:border-[#58a6ff]/30'
)

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'high',   label: 'High Impact' },
  { key: 'stock',  label: '株式' },
  { key: 'crypto', label: 'Crypto' },
]

export default function NewsIntel({ initialNews }: { initialNews: NewsItem[] }) {
  const [category, setCategory] = useState<CategoryTab>('all')
  const [impact, setImpact] = useState<ImpactFilter>('all')
  const [sentiment, setSentiment] = useState<SentimentFilter>('all')
  const [showNoise, setShowNoise] = useState(false)
  const [page, setPage] = useState(1)
  const [extraNews, setExtraNews] = useState<NewsItem[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const fetchedPages = useRef<Set<number>>(new Set([1]))

  // カテゴリタブ切り替え時はサーバーからフェッチ
  const handleCategoryChange = useCallback(async (cat: CategoryTab) => {
    setCategory(cat)
    setPage(1)
    setExtraNews([])
    setHasMore(true)
    fetchedPages.current = new Set([1])
  }, [])

  // クライアントサイドフィルタリング (初期データ + 追加ロード分)
  const allNews = useMemo(() => {
    const base = category === 'all' ? initialNews : []
    return [...base, ...extraNews]
  }, [initialNews, extraNews, category])

  const filtered = useMemo(() => {
    let data = allNews
    if (category === 'high') data = data.filter(n => !n.is_noise && n.impact === 'high')
    else if (category === 'stock') data = data.filter(n => n.category === 'stock')
    else if (category === 'crypto') data = data.filter(n => n.category === 'crypto')
    if (!showNoise) data = data.filter(n => !n.is_noise)
    if (impact !== 'all') data = data.filter(n => n.impact === impact)
    if (sentiment !== 'all') data = data.filter(n => n.sentiment === sentiment)
    return data
  }, [allNews, category, impact, sentiment, showNoise])

  const visibleNews = filtered.slice(0, page * PAGE_SIZE)
  const canShowMore = visibleNews.length < filtered.length || hasMore

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    const nextPage = page + 1

    // まだフェッチしていないページはサーバーから取得
    if (!fetchedPages.current.has(nextPage)) {
      setLoadingMore(true)
      try {
        const q = new URLSearchParams({
          page: String(nextPage),
          limit: String(PAGE_SIZE),
          category,
        }).toString()
        const res = await fetch(`/api/v1/news/market?${q}`)
        if (res.ok) {
          const data: NewsItem[] = await res.json()
          if (data.length === 0) {
            setHasMore(false)
          } else {
            setExtraNews(prev => [...prev, ...data])
            fetchedPages.current.add(nextPage)
            if (data.length < PAGE_SIZE) setHasMore(false)
          }
        } else {
          setHasMore(false)
        }
      } catch {
        setHasMore(false)
      } finally {
        setLoadingMore(false)
      }
    }

    setPage(nextPage)
  }, [loadingMore, page, category])

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

      {/* カテゴリタブ */}
      <div className='flex gap-2 border-b border-dim pb-2'>
        {CATEGORY_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleCategoryChange(key)}
            className={clsx(
              'px-4 py-1.5 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-[2px]',
              category === key
                ? 'text-accent border-accent'
                : 'text-[#8b949e] border-transparent hover:text-[#e6edf3] hover:border-dim'
            )}
          >
            {label}
            {key === 'crypto' && (
              <span className='ml-1 text-[9px] text-[#f0883e] border border-[#f0883e]/30 rounded px-1'>₿</span>
            )}
          </button>
        ))}
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
        <span className='text-xs text-[#8b949e] font-mono'>{visibleNews.length} / {filtered.length} 件</span>
      </div>

      {/* ニュースリスト */}
      <div className='flex flex-col gap-2'>
        {visibleNews.length === 0 ? (
          <div className='bg-card border border-dim rounded-lg py-16 text-center text-xs text-[#8b949e]'>
            条件に合うニュースがありません
          </div>
        ) : visibleNews.map(n => (
          <div
            key={`${n.id}-${n.source}`}
            className='bg-card border border-dim rounded-lg p-4 flex items-start gap-3 hover:bg-[#1c2128] transition-colors'
          >
            <div className='flex flex-col items-center gap-1 shrink-0 pt-0.5'>
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                IMPACT_STYLE[n.impact]
              )}>
                {IMPACT_LABEL[n.impact]}
              </span>
              {n.category === 'crypto' && (
                <span className='text-[9px] text-[#f0883e] border border-[#f0883e]/30 bg-[#f0883e]/10 rounded px-1'>₿</span>
              )}
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

      {/* もっと見る / ローディング */}
      {canShowMore && (
        <div className='flex justify-center py-2'>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className={clsx(
              'px-6 py-2 text-xs rounded-md border transition-colors',
              loadingMore
                ? 'border-dim text-[#8b949e] cursor-not-allowed'
                : 'border-accent/30 text-accent hover:bg-accent/10'
            )}
          >
            {loadingMore ? '読み込み中…' : 'もっと見る'}
          </button>
        </div>
      )}
    </div>
  )
}
