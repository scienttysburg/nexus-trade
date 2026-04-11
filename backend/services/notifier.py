"""外部 Webhook 通知サービス (Step 4 - Phase 2)。
Discord / Slack への非同期プッシュ通知を担当する。
"""
import asyncio
import logging
from typing import Any

import httpx

import app_settings

logger = logging.getLogger('nexus.notifier')

_client = httpx.AsyncClient(timeout=10.0)


def _discord_payload(ticker: str, name: str, signal: str, score: int, price: float, change_pct: float) -> dict:
  color = {
    'Strong Buy': 0x3FB950,
    'Buy':        0x85E89D,
    'Hold':       0xD29922,
    'Sell':       0xF97583,
    'Strong Sell':0xF85149,
  }.get(signal, 0x8B949E)
  sign = '+' if change_pct >= 0 else ''
  return {
    'embeds': [{
      'title': f'🚨 {signal}: {ticker}',
      'description': f'**{name}**',
      'color': color,
      'fields': [
        {'name': 'スコア',  'value': f'**{score}** / 100', 'inline': True},
        {'name': '価格',    'value': f'{price:,.2f}',       'inline': True},
        {'name': '変化率',  'value': f'{sign}{change_pct:.2f}%', 'inline': True},
      ],
      'footer': {'text': 'Nexus Trade Signal Alert'},
    }]
  }


def _slack_payload(ticker: str, name: str, signal: str, score: int, price: float, change_pct: float) -> dict:
  sign = '+' if change_pct >= 0 else ''
  emoji = {'Strong Buy': ':chart_with_upwards_trend:', 'Buy': ':arrow_up:', 'Hold': ':pause_button:',
           'Sell': ':arrow_down:', 'Strong Sell': ':chart_with_downwards_trend:'}.get(signal, ':bell:')
  return {
    'text': f'{emoji} *{signal}*: `{ticker}` {name}\nスコア: *{score}/100* | 価格: {price:,.2f} ({sign}{change_pct:.2f}%)',
  }


async def notify(
  ticker: str,
  name: str,
  signal: str,
  score: int,
  price: float,
  change_pct: float,
) -> None:
  """設定が有効な場合に Discord / Slack へ通知を送信する。"""
  cfg = app_settings.get()
  if not cfg['webhook_enabled']:
    return

  tasks: list[Any] = []

  if cfg['discord_webhook']:
    tasks.append(_send_discord(cfg['discord_webhook'], ticker, name, signal, score, price, change_pct))

  if cfg['slack_webhook']:
    tasks.append(_send_slack(cfg['slack_webhook'], ticker, name, signal, score, price, change_pct))

  if tasks:
    await asyncio.gather(*tasks, return_exceptions=True)


async def _send_discord(url: str, ticker: str, name: str, signal: str, score: int, price: float, change_pct: float) -> None:
  try:
    r = await _client.post(url, json=_discord_payload(ticker, name, signal, score, price, change_pct))
    r.raise_for_status()
    logger.info(f'[notifier] Discord sent: {ticker} {signal}')
  except Exception as e:
    logger.warning(f'[notifier] Discord failed: {e}')


async def _send_slack(url: str, ticker: str, name: str, signal: str, score: int, price: float, change_pct: float) -> None:
  try:
    r = await _client.post(url, json=_slack_payload(ticker, name, signal, score, price, change_pct))
    r.raise_for_status()
    logger.info(f'[notifier] Slack sent: {ticker} {signal}')
  except Exception as e:
    logger.warning(f'[notifier] Slack failed: {e}')


async def notify_batch(signals: list) -> None:
  """シグナルリストから閾値超えの銘柄をまとめて通知する。"""
  cfg = app_settings.get()
  if not cfg['webhook_enabled']:
    return
  threshold = cfg['webhook_score_threshold']
  for s in signals:
    if s.score >= threshold:
      await notify(s.ticker, s.name, s.signal, s.score, s.price, s.change_pct)
