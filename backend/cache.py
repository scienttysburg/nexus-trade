"""シンプルなインメモリ TTL キャッシュ。"""
import time

_store: dict[str, tuple] = {}


def get(key: str):
  if key in _store:
    val, exp = _store[key]
    if time.monotonic() < exp:
      return val
    del _store[key]
  return None


def set(key: str, val, ttl: int = 60) -> None:
  _store[key] = (val, time.monotonic() + ttl)


def invalidate(key: str) -> None:
  _store.pop(key, None)
