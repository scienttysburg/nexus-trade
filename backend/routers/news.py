import asyncio
from fastapi import APIRouter, Query
from schemas import NewsItem
from services.news import fetch_market_news, build_news_ticker, fetch_ticker_news

router = APIRouter()


@router.get('/ticker', response_model=list[str])
async def get_news_ticker():
  loop = asyncio.get_event_loop()
  news = await loop.run_in_executor(None, fetch_market_news)
  return build_news_ticker(news)


@router.get('/market', response_model=list[NewsItem])
async def get_market_news(
  page: int = Query(1, ge=1),
  limit: int = Query(20, ge=1, le=60),
  category: str = Query('all'),  # 'all' | 'stock' | 'crypto' | 'high'
):
  loop = asyncio.get_event_loop()
  all_news = await loop.run_in_executor(None, fetch_market_news)

  if category == 'high':
    filtered = [n for n in all_news if not n.is_noise and n.impact == 'high']
  elif category in ('stock', 'crypto'):
    filtered = [n for n in all_news if n.category == category]
  else:
    filtered = all_news

  start = (page - 1) * limit
  return filtered[start: start + limit]


@router.get('/stock/{ticker}', response_model=list[NewsItem])
async def get_stock_news(ticker: str):
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, fetch_ticker_news, ticker.upper())
