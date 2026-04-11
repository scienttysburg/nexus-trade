"""バックテスト REST API (Step 4 - Phase 2)。

GET /api/v1/backtest/{ticker}?days=90&hold_days=5&buy_threshold=65
"""
import asyncio
from fastapi import APIRouter, HTTPException, Query

from services.backtest import run_backtest, _executor

router = APIRouter()


@router.get('/{ticker}')
async def backtest(
  ticker: str,
  days:          int = Query(90,  ge=30, le=365),
  hold_days:     int = Query(5,   ge=1,  le=20),
  buy_threshold: int = Query(65,  ge=0,  le=100),
  take_profit:   float = Query(0.05, ge=0.01, le=0.30),
  stop_loss:     float = Query(0.03, ge=0.01, le=0.30),
):
  loop = asyncio.get_event_loop()
  result = await loop.run_in_executor(
    _executor,
    lambda: run_backtest(
      ticker.upper(),
      period_days   = days,
      hold_days     = hold_days,
      buy_threshold = buy_threshold,
      take_profit   = take_profit,
      stop_loss     = stop_loss,
    )
  )
  if result is None:
    raise HTTPException(404, f'{ticker} のデータを取得できませんでした')

  # dataclass → dict
  return {
    'ticker':         result.ticker,
    'period_days':    result.period_days,
    'total_trades':   result.total_trades,
    'win_trades':     result.win_trades,
    'loss_trades':    result.loss_trades,
    'win_rate':       result.win_rate,
    'avg_win_pct':    result.avg_win_pct,
    'avg_loss_pct':   result.avg_loss_pct,
    'profit_factor':  result.profit_factor,
    'expected_value': result.expected_value,
    'max_drawdown':   result.max_drawdown,
    'trades': [
      {
        'entry_date':  t.entry_date,
        'exit_date':   t.exit_date,
        'entry_price': t.entry_price,
        'exit_price':  t.exit_price,
        'pnl_pct':     t.pnl_pct,
        'result':      t.result,
      }
      for t in result.trades
    ],
  }
