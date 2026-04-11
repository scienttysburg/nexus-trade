"""シンプルなインメモリ TTL キャッシュ (Step 3 - Phase 2 改善版)。

改善点:
  - スタンピード防止: 同一キーに対して compute_fn が1回しか実行されないよう
    threading.Event でブロッキング待機する。
  - 既存の get / set / invalidate は後方互換を維持。
"""
import threading
import time

_store: dict[str, tuple] = {}
_store_lock = threading.Lock()

_events: dict[str, threading.Event] = {}
_events_lock = threading.Lock()


def get(key: str):
  with _store_lock:
    if key in _store:
      val, exp = _store[key]
      if time.monotonic() < exp:
        return val
      del _store[key]
  return None


def set(key: str, val, ttl: int = 60) -> None:
  with _store_lock:
    _store[key] = (val, time.monotonic() + ttl)


def invalidate(key: str) -> None:
  with _store_lock:
    _store.pop(key, None)


def get_or_compute(key: str, compute_fn, ttl: int = 60):
  """スタンピード防止付きキャッシュ取得。

  キャッシュミス時に compute_fn を1度だけ実行し、
  並行リクエストは Event で待機させる。
  """
  val = get(key)
  if val is not None:
    return val

  # どのスレッドが compute を担当するか決める
  with _events_lock:
    val = get(key)         # ダブルチェック
    if val is not None:
      return val

    if key in _events:
      event = _events[key]
      owner = False
    else:
      event = threading.Event()
      _events[key] = event
      owner = True

  if not owner:
    event.wait(timeout=60)
    return get(key)        # 成功時は値あり、失敗時は None (呼び出し元が再計算)

  try:
    val = compute_fn()
    set(key, val, ttl=ttl)
    return val
  finally:
    with _events_lock:
      _events.pop(key, None)
    event.set()
