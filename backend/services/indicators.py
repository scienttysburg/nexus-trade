"""テクニカル指標の計算 (Step 4)。
全関数は pandas Series / DataFrame を受け取り float を返す純粋関数。
"""
import numpy as np
import pandas as pd


def calc_rsi(closes: pd.Series, period: int = 14) -> float:
  if len(closes) < period + 2:
    return 50.0
  delta = closes.diff().dropna()
  gain = delta.clip(lower=0)
  loss = (-delta).clip(lower=0)
  # Wilder平滑化 (com = period - 1 で EWM を使用)
  avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
  avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
  rs = avg_gain / avg_loss.replace(0, np.nan)
  rsi = 100 - (100 / (1 + rs))
  val = float(rsi.iloc[-1])
  return val if not np.isnan(val) else 50.0


def calc_macd(
  closes: pd.Series,
  fast: int = 12,
  slow: int = 26,
  signal: int = 9,
) -> tuple[float, float, float]:
  """(macd_line, signal_line, histogram) を返す。"""
  if len(closes) < slow + signal:
    return 0.0, 0.0, 0.0
  ema_fast   = closes.ewm(span=fast,   adjust=False).mean()
  ema_slow   = closes.ewm(span=slow,   adjust=False).mean()
  macd_line  = ema_fast - ema_slow
  signal_line = macd_line.ewm(span=signal, adjust=False).mean()
  histogram  = macd_line - signal_line
  return (
    float(macd_line.iloc[-1]),
    float(signal_line.iloc[-1]),
    float(histogram.iloc[-1]),
  )


def calc_vwap(df: pd.DataFrame, period: int = 20) -> float:
  """直近 period 日分の出来高加重平均価格 (日足の近似 VWAP)。"""
  d = df.tail(period).copy()
  typical = (d['High'] + d['Low'] + d['Close']) / 3
  vol = d['Volume'].replace(0, np.nan)
  if vol.dropna().empty:
    return float(d['Close'].iloc[-1])
  vwap = (typical * vol).sum() / vol.sum()
  return float(vwap) if not np.isnan(vwap) else float(d['Close'].iloc[-1])


def calc_ma(closes: pd.Series, period: int) -> float:
  if len(closes) < period:
    return float(closes.iloc[-1])
  val = float(closes.rolling(period).mean().iloc[-1])
  return val if not np.isnan(val) else float(closes.iloc[-1])
