from fastapi import APIRouter, Query
from schemas import SignalData
from services.market_data import fetch_all_signals

router = APIRouter()


@router.get('', response_model=list[SignalData])
async def get_signals(
  market: str | None      = Query(None, description='JP または US'),
  signal_type: str | None = Query(None, description='buy または sell'),
  sort_by: str            = Query('score', description='score | change_pct | rsi'),
):
  import asyncio
  loop = asyncio.get_event_loop()
  data = await loop.run_in_executor(None, fetch_all_signals)

  if market:
    data = [s for s in data if s.market == market.upper()]
  if signal_type == 'buy':
    data = [s for s in data if s.signal in ('Strong Buy', 'Buy')]
  elif signal_type == 'sell':
    data = [s for s in data if s.signal in ('Sell', 'Strong Sell')]

  if sort_by == 'change_pct':
    data = sorted(data, key=lambda x: x.change_pct, reverse=True)
  elif sort_by == 'rsi':
    data = sorted(data, key=lambda x: x.rsi)
  else:
    data = sorted(data, key=lambda x: x.score, reverse=True)

  return data
