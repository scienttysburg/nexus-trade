"""WebSocket エンドポイント (Step 6)。

接続フロー:
  1. クライアントが ws://localhost:8000/ws に接続
  2. サーバーが即時スナップショット (type=snapshot) を送信
  3. 以降 30 秒ごとに差分更新 (type=prices, type=signals) をプッシュ
  4. クライアントが ping を送ると pong を返す（接続維持用）
"""
import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import app_settings
from services.market_data import fetch_all_signals, fetch_indices

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
  def __init__(self) -> None:
    self._clients: set[WebSocket] = set()

  async def connect(self, ws: WebSocket) -> None:
    await ws.accept()
    self._clients.add(ws)
    logger.info(f'WS connected. total={len(self._clients)}')

  def disconnect(self, ws: WebSocket) -> None:
    self._clients.discard(ws)
    logger.info(f'WS disconnected. total={len(self._clients)}')

  async def broadcast(self, payload: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    msg = json.dumps(payload, ensure_ascii=False)
    for ws in list(self._clients):
      try:
        await ws.send_text(msg)
      except Exception:
        dead.append(ws)
    for ws in dead:
      self._clients.discard(ws)

  @property
  def count(self) -> int:
    return len(self._clients)


manager = ConnectionManager()


def _build_snapshot(loop: asyncio.AbstractEventLoop) -> dict:
  signals = loop.run_until_complete(
    loop.run_in_executor(None, fetch_all_signals)
  ) if loop.is_running() else fetch_all_signals()
  indices = loop.run_until_complete(
    loop.run_in_executor(None, fetch_indices)
  ) if loop.is_running() else fetch_indices()
  return {
    'type': 'snapshot',
    'signals': [s.model_dump() for s in signals],
    'indices': [idx.model_dump() for idx in indices],
  }


@router.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
  await manager.connect(ws)
  loop = asyncio.get_event_loop()
  try:
    # 初回スナップショット
    signals = await loop.run_in_executor(None, fetch_all_signals)
    indices = await loop.run_in_executor(None, fetch_indices)
    await ws.send_text(json.dumps({
      'type': 'snapshot',
      'signals': [s.model_dump() for s in signals],
      'indices': [idx.model_dump() for idx in indices],
    }, ensure_ascii=False))

    # メッセージ受信ループ（ping 応答）
    while True:
      try:
        text = await asyncio.wait_for(ws.receive_text(), timeout=35.0)
        if text == 'ping':
          await ws.send_text('{"type":"pong"}')
      except asyncio.TimeoutError:
        # 35 秒応答なし → サーバーから ping
        await ws.send_text('{"type":"ping"}')
  except WebSocketDisconnect:
    pass
  except Exception as e:
    logger.warning(f'WS error: {e}')
  finally:
    manager.disconnect(ws)


async def broadcast_loop() -> None:
  """設定された間隔で全接続クライアントへ最新データをブロードキャスト。"""
  loop = asyncio.get_event_loop()
  while True:
    interval = app_settings.get()['broadcast_interval']
    await asyncio.sleep(interval)
    if manager.count == 0:
      continue
    try:
      signals = await loop.run_in_executor(None, fetch_all_signals)
      indices = await loop.run_in_executor(None, fetch_indices)
      await manager.broadcast({
        'type': 'update',
        'signals': [s.model_dump() for s in signals],
        'indices': [idx.model_dump() for idx in indices],
      })
    except Exception as e:
      logger.error(f'[broadcast_loop] {e}')
