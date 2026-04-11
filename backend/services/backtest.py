"""軽量バックテストエンジン (Step 4 - Phase 2)。

アルゴリズム:
  1. 1年分の日足OHLCV を取得
  2. 全日付の指標を pandas ベクトル演算で一括計算 (ルックアヘッドなし)
  3. スコア >= buy_threshold の日に翌日オープンでエントリー
  4. TP/SL/最大保有日数でイグジット
  5. 勝率・PF・期待値・最大ドローダウンを集計
"""
import logging
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import yfinance as yf

from services.scoring import calc_score

logger = logging.getLogger('nexus.backtest')

_executor = ThreadPoolExecutor(max_workers=2)

# ---- データクラス ----

@dataclass
class TradeRecord:
  entry_date:  str
  exit_date:   str
  entry_price: float
  exit_price:  float
  pnl_pct:     float
  result:      str   # 'win' | 'loss' | 'neutral'


@dataclass
class BacktestResult:
  ticker:        str
  period_days:   int
  total_trades:  int
  win_trades:    int
  loss_trades:   int
  win_rate:      float
  avg_win_pct:   float
  avg_loss_pct:  float
  profit_factor: float
  expected_value:float
  max_drawdown:  float
  trades:        list[TradeRecord] = field(default_factory=list)


def _fetch_ohlcv(ticker: str) -> pd.DataFrame | None:
  try:
    t = yf.Ticker(ticker)
    df = t.history(period='1y', auto_adjust=True, actions=False, repair=True, timeout=15)
    return df if len(df) >= 80 else None
  except Exception as e:
    logger.error(f'[backtest] fetch {ticker}: {e}')
    return None


def run_backtest(
  ticker: str,
  period_days: int = 90,
  hold_days: int   = 5,
  buy_threshold: int = 65,
  take_profit: float = 0.05,
  stop_loss: float   = 0.03,
) -> BacktestResult | None:
  df = _fetch_ohlcv(ticker)
  if df is None:
    return None

  # 直近 period_days + 80 行 (MA75 ウォームアップ用)
  warmup = 80
  df = df.tail(period_days + warmup).copy()
  closes = df['Close']

  # ---- 全日付の指標をベクトル演算で一括計算 ----
  delta    = closes.diff()
  avg_gain = delta.clip(lower=0).ewm(com=13, adjust=False).mean()
  avg_loss = (-delta).clip(lower=0).ewm(com=13, adjust=False).mean()
  rsi_s    = 100 - 100 / (1 + avg_gain / avg_loss.replace(0, np.nan))

  ema12    = closes.ewm(span=12, adjust=False).mean()
  ema26    = closes.ewm(span=26, adjust=False).mean()
  macd_s   = ema12 - ema26
  sig_s    = macd_s.ewm(span=9, adjust=False).mean()

  vol      = df['Volume'].replace(0, np.nan)
  typical  = (df['High'] + df['Low'] + closes) / 3
  vwap_s   = (typical * vol).rolling(20).sum() / vol.rolling(20).sum()
  vwap_dev_s = (closes - vwap_s) / vwap_s * 100

  ma5_s    = closes.rolling(5).mean()
  ma25_s   = closes.rolling(25).mean()
  ma75_s   = closes.rolling(75).mean()

  # numpy 配列に変換 (高速アクセス)
  rsi_a      = rsi_s.to_numpy()
  macd_a     = macd_s.to_numpy()
  sig_a      = sig_s.to_numpy()
  vwap_dev_a = vwap_dev_s.to_numpy()
  close_a    = closes.to_numpy()
  ma5_a      = ma5_s.to_numpy()
  ma25_a     = ma25_s.to_numpy()
  ma75_a     = ma75_s.to_numpy()
  open_a     = df['Open'].to_numpy()
  high_a     = df['High'].to_numpy()
  low_a      = df['Low'].to_numpy()
  dates      = df.index

  # ---- トレードシミュレーション ----
  trades: list[TradeRecord] = []
  start_idx   = warmup - 5          # ウォームアップ後から開始
  end_idx     = len(df) - hold_days - 2
  last_exit_i = -1

  for i in range(start_idx, end_idx):
    if i <= last_exit_i:
      continue  # 前のポジション保有中はスキップ

    vals = [rsi_a[i], macd_a[i], sig_a[i], vwap_dev_a[i], ma5_a[i], ma25_a[i], ma75_a[i]]
    if any(np.isnan(v) for v in vals):
      continue

    score = calc_score(
      rsi_a[i], macd_a[i], sig_a[i], vwap_dev_a[i],
      close_a[i], ma5_a[i], ma25_a[i], ma75_a[i],
    )
    if score < buy_threshold:
      continue

    # 翌日オープンでエントリー
    entry_i = i + 1
    if np.isnan(open_a[entry_i]):
      continue
    entry_price = float(open_a[entry_i])
    tp_price    = entry_price * (1 + take_profit)
    sl_price    = entry_price * (1 - stop_loss)

    exit_i     = min(entry_i + hold_days, len(df) - 1)
    exit_price = float(close_a[exit_i])
    exit_date  = str(dates[exit_i].date())

    # 日中に TP/SL に到達したか確認
    for j in range(entry_i, exit_i + 1):
      if float(high_a[j]) >= tp_price:
        exit_price = tp_price
        exit_date  = str(dates[j].date())
        exit_i     = j
        break
      if float(low_a[j]) <= sl_price:
        exit_price = sl_price
        exit_date  = str(dates[j].date())
        exit_i     = j
        break

    last_exit_i = exit_i
    pnl_pct = (exit_price - entry_price) / entry_price * 100
    result  = 'win' if pnl_pct > 0.1 else ('loss' if pnl_pct < -0.1 else 'neutral')

    trades.append(TradeRecord(
      entry_date  = str(dates[entry_i].date()),
      exit_date   = exit_date,
      entry_price = round(entry_price, 2),
      exit_price  = round(exit_price, 2),
      pnl_pct     = round(pnl_pct, 2),
      result      = result,
    ))

  # ---- 集計 ----
  if not trades:
    return BacktestResult(
      ticker=ticker, period_days=period_days,
      total_trades=0, win_trades=0, loss_trades=0,
      win_rate=0.0, avg_win_pct=0.0, avg_loss_pct=0.0,
      profit_factor=0.0, expected_value=0.0, max_drawdown=0.0,
    )

  wins   = [t for t in trades if t.result == 'win']
  losses = [t for t in trades if t.result == 'loss']

  win_rate  = len(wins) / len(trades) * 100
  avg_win   = sum(t.pnl_pct for t in wins)   / len(wins)   if wins   else 0.0
  avg_loss  = abs(sum(t.pnl_pct for t in losses) / len(losses)) if losses else 0.0
  gross_win = sum(t.pnl_pct for t in wins)
  gross_loss= abs(sum(t.pnl_pct for t in losses))
  pf        = round(gross_win / gross_loss, 2) if gross_loss > 0 else 99.9
  ev        = (win_rate / 100 * avg_win) - ((1 - win_rate / 100) * avg_loss)

  # 最大ドローダウン (累積 PnL ベース)
  cum, peak, max_dd = 0.0, 0.0, 0.0
  for t in trades:
    cum += t.pnl_pct
    if cum > peak:
      peak = cum
    dd = peak - cum
    if dd > max_dd:
      max_dd = dd

  return BacktestResult(
    ticker        = ticker,
    period_days   = period_days,
    total_trades  = len(trades),
    win_trades    = len(wins),
    loss_trades   = len(losses),
    win_rate      = round(win_rate, 1),
    avg_win_pct   = round(avg_win, 2),
    avg_loss_pct  = round(avg_loss, 2),
    profit_factor = min(pf, 99.9),
    expected_value= round(ev, 2),
    max_drawdown  = round(max_dd, 2),
    trades        = trades[-30:],  # 直近 30 件のみ返す
  )
