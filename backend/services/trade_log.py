"""Trade Log SQLite 永続化サービス。
positions テーブルの CRUD と現在価格によるエンリッチを担当する。
"""
import logging
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yfinance as yf

import cache
import symbol_store
from schemas import TradePosition, TradePositionCreate, TradePositionUpdate

logger = logging.getLogger('nexus.trade_log')

_DB_PATH = Path(__file__).parent.parent / 'trade_log.db'
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
  conn = sqlite3.connect(str(_DB_PATH))
  conn.row_factory = sqlite3.Row
  return conn


def init_db() -> None:
  with _lock, _connect() as conn:
    conn.execute('''
      CREATE TABLE IF NOT EXISTS positions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker       TEXT    NOT NULL,
        name         TEXT    NOT NULL DEFAULT '',
        market       TEXT    NOT NULL DEFAULT 'JP',
        entry_date   TEXT    NOT NULL,
        entry_price  REAL    NOT NULL,
        shares       REAL    NOT NULL DEFAULT 1,
        take_profit  REAL,
        stop_loss    REAL,
        notes        TEXT    NOT NULL DEFAULT '',
        status       TEXT    NOT NULL DEFAULT 'open',
        exit_date    TEXT,
        exit_price   REAL,
        created_at   TEXT    NOT NULL
      )
    ''')
    conn.commit()


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
  return dict(row)


def _get_current_price(ticker: str) -> float | None:
  """キャッシュ済みシグナルから現在価格を取得。なければ直接取得。"""
  signals = cache.get('signals') or []
  for s in signals:
    if s.ticker == ticker:
      return s.price
  try:
    t = yf.Ticker(ticker)
    fi = t.fast_info
    p = float(fi.last_price)
    return p if p > 0 else None
  except Exception:
    return None


def _enrich(row: dict) -> TradePosition:
  entry_price = row['entry_price']
  status = row.get('status', 'open')

  # クローズ済みポジション: exit_price で確定損益を計算
  if status == 'closed' and row.get('exit_price') is not None:
    exit_price = float(row['exit_price'])
    pnl_pct = round((exit_price - entry_price) / entry_price * 100, 2) if entry_price > 0 else None
    pnl_amount = round((exit_price - entry_price) * row['shares'], 2) if entry_price > 0 else None
    return TradePosition(
      **row,
      current_price=exit_price,
      pnl_pct=pnl_pct,
      pnl_amount=pnl_amount,
    )

  # オープンポジション: 現在価格で含み損益を計算
  current = _get_current_price(row['ticker'])
  pnl_pct = None
  pnl_amount = None
  if current is not None and entry_price > 0:
    pnl_pct = round((current - entry_price) / entry_price * 100, 2)
    pnl_amount = round((current - entry_price) * row['shares'], 2)
  return TradePosition(
    **row,
    current_price=round(current, 2) if current else None,
    pnl_pct=pnl_pct,
    pnl_amount=pnl_amount,
  )


def get_positions(status: str | None = None) -> list[TradePosition]:
  with _lock, _connect() as conn:
    if status:
      rows = conn.execute(
        'SELECT * FROM positions WHERE status = ? ORDER BY created_at DESC', (status,)
      ).fetchall()
    else:
      rows = conn.execute(
        'SELECT * FROM positions ORDER BY created_at DESC'
      ).fetchall()
  return [_enrich(_row_to_dict(r)) for r in rows]


def get_position(pos_id: int) -> TradePosition | None:
  with _lock, _connect() as conn:
    row = conn.execute('SELECT * FROM positions WHERE id = ?', (pos_id,)).fetchone()
  if row is None:
    return None
  return _enrich(_row_to_dict(row))


def create_position(data: TradePositionCreate) -> TradePosition:
  now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
  name = data.name or symbol_store.get_ticker_name(data.ticker)
  market = data.market or symbol_store.get_market(data.ticker)
  with _lock, _connect() as conn:
    cur = conn.execute(
      '''INSERT INTO positions
         (ticker, name, market, entry_date, entry_price, shares, take_profit, stop_loss, notes, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,\'open\',?)''',
      (data.ticker, name, market, data.entry_date, data.entry_price,
       data.shares, data.take_profit, data.stop_loss, data.notes, now)
    )
    conn.commit()
    pos_id = cur.lastrowid
  result = get_position(pos_id)
  if result is None:
    raise RuntimeError('position creation failed')
  return result


def update_position(pos_id: int, patch: TradePositionUpdate) -> TradePosition | None:
  fields: list[str] = []
  values: list[Any] = []
  # exclude_unset=True: 送信された値のみ更新。Noneはフィールドをクリアする意味で使える。
  for field, val in patch.model_dump(exclude_unset=True).items():
    fields.append(f'{field} = ?')
    values.append(val)
  if not fields:
    return get_position(pos_id)
  values.append(pos_id)
  with _lock, _connect() as conn:
    conn.execute(
      f'UPDATE positions SET {", ".join(fields)} WHERE id = ?', values
    )
    conn.commit()
  return get_position(pos_id)


def delete_position(pos_id: int) -> bool:
  with _lock, _connect() as conn:
    cur = conn.execute('DELETE FROM positions WHERE id = ?', (pos_id,))
    conn.commit()
  return cur.rowcount > 0


def get_open_positions_raw() -> list[dict]:
  """価格監視ループ用: open ポジションを生データで返す。"""
  with _lock, _connect() as conn:
    rows = conn.execute(
      'SELECT * FROM positions WHERE status = \'open\''
    ).fetchall()
  return [_row_to_dict(r) for r in rows]


def close_position(pos_id: int, exit_price: float) -> None:
  now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
  with _lock, _connect() as conn:
    conn.execute(
      'UPDATE positions SET status = \'closed\', exit_date = ?, exit_price = ? WHERE id = ?',
      (now, exit_price, pos_id)
    )
    conn.commit()
