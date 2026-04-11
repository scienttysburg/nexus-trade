from fastapi import APIRouter
from schemas import NewsItem
from services.news import fetch_market_news, build_news_ticker, fetch_ticker_news

router = APIRouter()


@router.get('/ticker', response_model=list[str])
async def get_news_ticker():
  import asyncio
  loop = asyncio.get_event_loop()
  news = await loop.run_in_executor(None, fetch_market_news)
  return build_news_ticker(news)


@router.get('/market', response_model=list[NewsItem])
async def get_market_news():
  import asyncio
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, fetch_market_news)


@router.get('/stock/{ticker}', response_model=list[NewsItem])
async def get_stock_news(ticker: str):
  import asyncio
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, fetch_ticker_news, ticker.upper())
