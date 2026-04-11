import { api } from '@/lib/api'
import NewsIntel from '@/components/news/NewsIntel'

export default async function NewsPage() {
  const news = await api.marketNews()
  return <NewsIntel initialNews={news} />
}
