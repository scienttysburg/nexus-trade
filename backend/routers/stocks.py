from fastapi import APIRouter, HTTPException
from schemas import StockDetail
from services.market_data import fetch_stock_detail
from config import WATCHLIST

router = APIRouter()


@router.get('/{ticker}', response_model=StockDetail)
async def get_stock_detail(ticker: str):
  import asyncio
  t = ticker.upper()
  loop = asyncio.get_event_loop()
  detail = await loop.run_in_executor(None, fetch_stock_detail, t)
  if detail is None:
    raise HTTPException(status_code=404, detail=f'{ticker} のデータを取得できませんでした')
  return detail
