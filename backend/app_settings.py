"""アプリケーション設定管理 (Step 2 - Phase 2)。
app_config.json を唯一の真実の源として読み書きする。
スレッドセーフ (threading.Lock)。
"""
import json
import threading
from pathlib import Path

_PATH = Path(__file__).parent / 'app_config.json'
_lock = threading.Lock()

_DEFAULTS: dict = {
  'refresh_interval':        60,   # バックグラウンドリフレッシュ間隔(秒)
  'broadcast_interval':      30,   # WebSocket ブロードキャスト間隔(秒)
  'discord_webhook':         '',
  'slack_webhook':           '',
  'webhook_enabled':         False,
  'webhook_score_threshold': 80,
}


def _load() -> dict:
  if _PATH.exists():
    with open(_PATH, encoding='utf-8') as f:
      return {**_DEFAULTS, **json.load(f)}
  return _DEFAULTS.copy()


def _save(data: dict) -> None:
  with open(_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)


def get() -> dict:
  with _lock:
    return _load()


def update(patch: dict) -> dict:
  with _lock:
    data = _load()
    data.update(patch)
    _save(data)
    return data
