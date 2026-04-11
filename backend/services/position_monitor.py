"""ポジション監視バックグラウンドタスク。
open ポジションの現在価格を定期チェックし、TP/SL到達時に Webhook 通知を送る。
"""
import asyncio
import logging
from typing import Any

from services import trade_log as tl
from services.notifier import notify

logger = logging.getLogger('nexus.position_monitor')


def _check_positions_sync() -> list[dict[str, Any]]:
  """同期処理: open ポジションをチェックし、TP/SL到達分を返す。
  SQLite と yfinance の呼び出しはすべてここに集約し、run_in_executor で実行する。
  """
  positions = tl.get_open_positions_raw()
  alerts: list[dict[str, Any]] = []

  for pos in positions:
    ticker = pos['ticker']
    entry_price = pos['entry_price']
    take_profit = pos['take_profit']
    stop_loss = pos['stop_loss']
    pos_id = pos['id']
    name = pos.get('name', ticker)

    current = tl._get_current_price(ticker)
    if current is None or entry_price <= 0:
      continue

    pnl_pct = (current - entry_price) / entry_price * 100

    if take_profit and current >= take_profit:
      tl.close_position(pos_id, current)
      logger.info(f'[monitor] TP hit: {ticker} @ {current} (TP={take_profit})')
      alerts.append({
        'ticker': ticker, 'name': name,
        'signal': 'Strong Buy',
        'alert_label': f'TP到達 +{pnl_pct:.2f}%',
        'pnl_pct': pnl_pct, 'price': current,
      })

    elif stop_loss and current <= stop_loss:
      tl.close_position(pos_id, current)
      logger.info(f'[monitor] SL hit: {ticker} @ {current} (SL={stop_loss})')
      alerts.append({
        'ticker': ticker, 'name': name,
        'signal': 'Strong Sell',
        'alert_label': f'SL到達 {pnl_pct:.2f}%',
        'pnl_pct': pnl_pct, 'price': current,
      })

  return alerts


async def _check_positions() -> None:
  """同期処理をスレッドプールで実行し、通知のみ async で送信する。"""
  loop = asyncio.get_event_loop()
  alerts = await loop.run_in_executor(None, _check_positions_sync)

  for a in alerts:
    try:
      score = max(0, min(100, int(50 + a['pnl_pct'] * 2)))
      await notify(
        ticker=a['ticker'],
        name=f"{a['name']} [{a['alert_label']}]",
        signal=a['signal'],
        score=score,
        price=a['price'],
        change_pct=a['pnl_pct'],
      )
    except Exception as e:
      logger.warning(f'[monitor] notify failed: {e}')


async def start_position_monitor() -> None:
  """60秒ごとにオープンポジションをチェックするループを起動。"""
  async def _loop():
    while True:
      await asyncio.sleep(60)
      try:
        await _check_positions()
      except Exception as e:
        logger.error(f'[position_monitor] {e}')

  asyncio.create_task(_loop())
  logger.info('[position_monitor] started (interval: 60s)')
