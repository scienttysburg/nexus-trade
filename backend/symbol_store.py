"""動的銘柄管理ストア (Step 1 - Phase 2)。
symbols.json を唯一の真実の源として読み書きする。
スレッドセーフ (threading.Lock)。
"""
import json
import threading
from pathlib import Path

_PATH = Path(__file__).parent / 'symbols.json'
_lock = threading.Lock()


def _load() -> dict:
  if _PATH.exists():
    with open(_PATH, encoding='utf-8') as f:
      return json.load(f)
  return {'jp': [], 'us': []}


def _save(data: dict) -> None:
  with open(_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)


# --------- 読み取り API ---------

def get_all() -> dict:
  with _lock:
    return _load()


def get_watchlist() -> list[str]:
  """有効な全銘柄ティッカーリスト。"""
  with _lock:
    data = _load()
  return [
    s['ticker']
    for s in data.get('jp', []) + data.get('us', [])
    if s.get('enabled', True)
  ]


def get_jp_tickers() -> set[str]:
  with _lock:
    data = _load()
  return {s['ticker'] for s in data.get('jp', []) if s.get('enabled', True)}


def get_us_tickers() -> set[str]:
  with _lock:
    data = _load()
  return {s['ticker'] for s in data.get('us', []) if s.get('enabled', True)}


def get_market(ticker: str) -> str:
  with _lock:
    data = _load()
  jp = {s['ticker'] for s in data.get('jp', [])}
  return 'JP' if ticker in jp else 'US'


def get_ticker_name(ticker: str) -> str:
  with _lock:
    data = _load()
  for s in data.get('jp', []) + data.get('us', []):
    if s['ticker'] == ticker:
      return s['name']
  return ticker


def get_ticker_sector(ticker: str) -> str:
  with _lock:
    data = _load()
  for s in data.get('jp', []) + data.get('us', []):
    if s['ticker'] == ticker:
      return s.get('sector', 'その他')
  return 'その他'


# --------- 書き込み API ---------

def add_symbol(ticker: str, name: str, sector: str, market: str) -> bool:
  """銘柄を追加。既存の場合は False を返す。"""
  key = 'jp' if market == 'JP' else 'us'
  with _lock:
    data = _load()
    existing = [s['ticker'] for s in data.get('jp', []) + data.get('us', [])]
    if ticker in existing:
      return False
    data.setdefault(key, []).append({
      'ticker': ticker,
      'name': name,
      'sector': sector,
      'enabled': True,
    })
    _save(data)
  return True


def remove_symbol(ticker: str) -> bool:
  """銘柄を削除。存在しない場合は False を返す。"""
  with _lock:
    data = _load()
    for key in ('jp', 'us'):
      before = len(data.get(key, []))
      data[key] = [s for s in data.get(key, []) if s['ticker'] != ticker]
      if len(data[key]) < before:
        _save(data)
        return True
  return False


def toggle_symbol(ticker: str, enabled: bool) -> bool:
  """銘柄の有効/無効を切り替え。存在しない場合は False を返す。"""
  with _lock:
    data = _load()
    for key in ('jp', 'us'):
      for s in data.get(key, []):
        if s['ticker'] == ticker:
          s['enabled'] = enabled
          _save(data)
          return True
  return False
