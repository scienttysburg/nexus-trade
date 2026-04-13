import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.paper_trading import get_account, execute_order, get_orders, reset_account

router = APIRouter()


class OrderRequest(BaseModel):
  ticker: str
  name: str = ''
  order_type: str       # 'buy' | 'sell'
  shares: float | None = None
  amount: float | None = None


@router.get('/account')
async def paper_account():
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, get_account)


@router.get('/orders')
async def paper_orders(limit: int = 50):
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, get_orders, limit)


@router.post('/order')
async def paper_order(req: OrderRequest):
  if req.order_type not in ('buy', 'sell'):
    raise HTTPException(status_code=400, detail='order_type は buy または sell')
  if req.shares is None and req.amount is None:
    raise HTTPException(status_code=400, detail='shares または amount を指定してください')
  try:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
      None, execute_order,
      req.ticker, req.name, req.order_type, req.shares, req.amount
    )
    return result
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))


@router.post('/reset')
async def paper_reset():
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, reset_account)
