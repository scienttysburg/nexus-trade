"""デモ売買 (Paper Trading) SQLite 永続化サービス。
テーブル構成:
  paper_account   — 口座残高 (id=1 固定の単一レコード)
  paper_positions — 保有ポジション (open)
  paper_orders    — 注文履歴 (全約定記録)
"""
from __future__ import annotations

import logging
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yfinance as yf

import cache
from services.crypto import CRYPTO_TICKERS

logger = logging.getLogger('nexus.paper')

_DB_PATH = Path(__file__).parent.parent / 'trade_log.db'
_lock = threading.Lock()

# 初期資金 (円建て)
INITIAL_BALANCE = 10_000_000.0


def _connect() -> sqlite3.Connection:
  conn = sqlite3.connect(str(_DB_PATH))
  conn.row_factory = sqlite3.Row
  return conn


def init_paper_db() -> None:
  with _lock, _connect() as conn:
    conn.execute('''
      CREATE TABLE IF NOT EXISTS paper_account (
        id               INTEGER PRIMARY KEY CHECK(id = 1),
        cash_balance     REAL    NOT NULL DEFAULT 10000000,
        realized_pnl     REAL    NOT NULL DEFAULT 0,
        total_trades     INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT    NOT NULL,
        updated_at       TEXT    NOT NULL
      )
    ''')
    conn.execute('''
      CREATE TABLE IF NOT EXISTS paper_positions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker       TEXT    NOT NULL,
        name         TEXT    NOT NULL DEFAULT '',
        asset_type   TEXT    NOT NULL DEFAULT 'stock',
        entry_price  REAL    NOT NULL,
        shares       REAL    NOT NULL,
        created_at   TEXT    NOT NULL
      )
    ''')
    conn.execute('''
      CREATE TABLE IF NOT EXISTS paper_orders (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker       TEXT    NOT NULL,
        name         TEXT    NOT NULL DEFAULT '',
        asset_type   TEXT    NOT NULL DEFAULT 'stock',
        order_type   TEXT    NOT NULL,
        price        REAL    NOT NULL,
        shares       REAL    NOT NULL,
        amount       REAL    NOT NULL,
        pnl          REAL,
        executed_at  TEXT    NOT NULL
      )
    ''')
    # 口座レコードが無ければ初期化
    row = conn.execute('SELECT id FROM paper_account WHERE id = 1').fetchone()
    if row is None:
      now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
      conn.execute(
        'INSERT INTO paper_account (id, cash_balance, realized_pnl, total_trades, created_at, updated_at) VALUES (1,?,0,0,?,?)',
        (INITIAL_BALANCE, now, now)
      )
    conn.commit()


# ──────────────────── ユーティリティ ────────────────────

_CRYPTO_TICKERS = {d['ticker'] for d in CRYPTO_TICKERS}


def _asset_type(ticker: str) -> str:
  return 'crypto' if ticker in _CRYPTO_TICKERS else 'stock'


def _get_current_price(ticker: str) -> float | None:
  """キャッシュ優先、なければ yfinance 直接取得。"""
  for cache_key in ('signals', 'crypto_signals'):
    cached = cache.get(cache_key) or []
    for s in cached:
      if s.ticker == ticker:
        return float(s.price)
  try:
    fi = yf.Ticker(ticker).fast_info
    p = float(fi.last_price)
    return p if p > 0 else None
  except Exception:
    return None


# ──────────────────── 口座情報 ────────────────────

def get_account() -> dict[str, Any]:
  with _lock, _connect() as conn:
    row = dict(conn.execute('SELECT * FROM paper_account WHERE id = 1').fetchone())
    positions = conn.execute('SELECT * FROM paper_positions').fetchall()

  # 含み損益を計算
  unrealized_pnl = 0.0
  positions_value = 0.0
  enriched = []
  for p in positions:
    pos = dict(p)
    price = _get_current_price(pos['ticker'])
    if price:
      current_value = price * pos['shares']
      entry_value = pos['entry_price'] * pos['shares']
      pnl = current_value - entry_value
      unrealized_pnl += pnl
      positions_value += current_value
      pos['current_price'] = round(price, 4) if price < 1 else round(price, 2)
      pos['pnl_amount'] = round(pnl, 2)
      pos['pnl_pct'] = round((price - pos['entry_price']) / pos['entry_price'] * 100, 2)
    else:
      positions_value += pos['entry_price'] * pos['shares']
      pos['current_price'] = None
      pos['pnl_amount'] = None
      pos['pnl_pct'] = None
    enriched.append(pos)

  total_assets = row['cash_balance'] + positions_value
  return {
    'cash_balance': round(row['cash_balance'], 2),
    'positions_value': round(positions_value, 2),
    'total_assets': round(total_assets, 2),
    'unrealized_pnl': round(unrealized_pnl, 2),
    'realized_pnl': round(row['realized_pnl'], 2),
    'total_pnl': round(unrealized_pnl + row['realized_pnl'], 2),
    'total_trades': row['total_trades'],
    'return_pct': round((total_assets - INITIAL_BALANCE) / INITIAL_BALANCE * 100, 2),
    'initial_balance': INITIAL_BALANCE,
    'positions': enriched,
  }


# ──────────────────── 注文実行 ────────────────────

def execute_order(
  ticker: str,
  name: str,
  order_type: str,        # 'buy' | 'sell'
  shares: float | None,
  amount: float | None,   # 円 or USD 建てで金額指定する場合
) -> dict[str, Any]:
  """成行注文を疑似約定。price はリアルタイム取得。"""
  price = _get_current_price(ticker)
  if price is None:
    raise ValueError(f'価格を取得できません: {ticker}')

  asset_type = _asset_type(ticker)

  if order_type == 'buy':
    if shares is None and amount is not None:
      shares = amount / price
    if shares is None or shares <= 0:
      raise ValueError('数量または金額を指定してください')
    cost = price * shares
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    with _lock, _connect() as conn:
      row = conn.execute('SELECT cash_balance FROM paper_account WHERE id = 1').fetchone()
      if row['cash_balance'] < cost:
        raise ValueError(f'残高不足: 必要額 {cost:,.0f} / 残高 {row["cash_balance"]:,.0f}')
      conn.execute(
        'UPDATE paper_account SET cash_balance = cash_balance - ?, total_trades = total_trades + 1, updated_at = ? WHERE id = 1',
        (cost, now)
      )
      conn.execute(
        'INSERT INTO paper_positions (ticker, name, asset_type, entry_price, shares, created_at) VALUES (?,?,?,?,?,?)',
        (ticker, name, asset_type, price, shares, now)
      )
      order_id = conn.execute(
        'INSERT INTO paper_orders (ticker, name, asset_type, order_type, price, shares, amount, pnl, executed_at) VALUES (?,?,?,?,?,?,?,NULL,?)',
        (ticker, name, asset_type, 'buy', price, shares, cost, now)
      ).lastrowid
      conn.commit()
    return {'order_id': order_id, 'type': 'buy', 'ticker': ticker, 'price': price, 'shares': shares, 'amount': cost}

  elif order_type == 'sell':
    if shares is None and amount is not None:
      shares = amount / price
    if shares is None or shares <= 0:
      raise ValueError('数量または金額を指定してください')
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    with _lock, _connect() as conn:
      # FIFO で保有ポジションから売却
      rows = conn.execute(
        'SELECT * FROM paper_positions WHERE ticker = ? ORDER BY created_at ASC',
        (ticker,)
      ).fetchall()
      total_held = sum(r['shares'] for r in rows)
      if total_held < shares:
        raise ValueError(f'保有数量不足: 保有 {total_held:.4f} / 売却希望 {shares:.4f}')

      proceed = price * shares
      realized = 0.0
      remaining = shares
      for row in rows:
        if remaining <= 0:
          break
        sell_qty = min(remaining, row['shares'])
        realized += (price - row['entry_price']) * sell_qty
        remaining -= sell_qty
        if sell_qty >= row['shares']:
          conn.execute('DELETE FROM paper_positions WHERE id = ?', (row['id'],))
        else:
          conn.execute(
            'UPDATE paper_positions SET shares = shares - ? WHERE id = ?',
            (sell_qty, row['id'])
          )

      conn.execute(
        'UPDATE paper_account SET cash_balance = cash_balance + ?, realized_pnl = realized_pnl + ?, total_trades = total_trades + 1, updated_at = ? WHERE id = 1',
        (proceed, realized, now)
      )
      order_id = conn.execute(
        'INSERT INTO paper_orders (ticker, name, asset_type, order_type, price, shares, amount, pnl, executed_at) VALUES (?,?,?,?,?,?,?,?,?)',
        (ticker, name, asset_type, 'sell', price, shares, proceed, round(realized, 2), now)
      ).lastrowid
      conn.commit()
    return {'order_id': order_id, 'type': 'sell', 'ticker': ticker, 'price': price, 'shares': shares, 'amount': proceed, 'realized_pnl': round(realized, 2)}
  else:
    raise ValueError(f'不明な注文タイプ: {order_type}')


def get_orders(limit: int = 50) -> list[dict]:
  with _lock, _connect() as conn:
    rows = conn.execute(
      'SELECT * FROM paper_orders ORDER BY executed_at DESC LIMIT ?', (limit,)
    ).fetchall()
  return [dict(r) for r in rows]


def reset_account() -> dict:
  now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
  with _lock, _connect() as conn:
    conn.execute('DELETE FROM paper_positions')
    conn.execute('DELETE FROM paper_orders')
    conn.execute(
      'UPDATE paper_account SET cash_balance = ?, realized_pnl = 0, total_trades = 0, updated_at = ? WHERE id = 1',
      (INITIAL_BALANCE, now)
    )
    conn.commit()
  return {'status': 'reset', 'initial_balance': INITIAL_BALANCE}
