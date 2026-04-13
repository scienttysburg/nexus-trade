import { api } from '@/lib/api'
import NewsIntel from '@/components/news/NewsIntel'

export default async function NewsPage() {
  let news = []
  try {
    news = await api.marketNewsPaged(1, 20, 'all')
  } catch {
    // バックエンド未起動時は空で初期化
  }
  return <NewsIntel initialNews={news} />
}
