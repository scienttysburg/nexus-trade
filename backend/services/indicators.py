"""テクニカル指標の計算 (Step 3 - Phase 2 最適化済み)。

最適化方針:
  1. pandas Series → numpy ndarray に変換して演算コストを削減
  2. Numba @njit(cache=True) で RSI・EMA のループをネイティブコードにコンパイル
  3. Numba 未インストール時は自動的に純粋 NumPy 実装にフォールバック
"""
import numpy as np
import pandas as pd

# ---- Numba JIT (オプション依存) ----
try:
  from numba import njit as _njit
  _NUMBA = True
except ImportError:
  _NUMBA = False
  def _njit(**kw):          # type: ignore[misc]
    def dec(fn): return fn
    return dec


# ---- JIT コアロジック ----

@_njit(cache=True)
def _rsi_core(closes: np.ndarray, period: int) -> float:
  """Wilder EMA による RSI (Numba JIT コンパイル対象)。"""
  n = len(closes)
  if n < period + 2:
    return 50.0
  delta = closes[1:] - closes[:-1]
  gains  = np.where(delta > 0, delta,   0.0)
  losses = np.where(delta < 0, -delta,  0.0)

  # 最初の period 本の単純平均でシード
  avg_gain = np.mean(gains[:period])
  avg_loss = np.mean(losses[:period])

  alpha = 1.0 / period
  for i in range(period, len(gains)):
    avg_gain = alpha * gains[i] + (1.0 - alpha) * avg_gain
    avg_loss = alpha * losses[i] + (1.0 - alpha) * avg_loss

  if avg_loss == 0.0:
    return 100.0
  rs = avg_gain / avg_loss
  return 100.0 - (100.0 / (1.0 + rs))


@_njit(cache=True)
def _ema_core(arr: np.ndarray, span: int) -> np.ndarray:
  """指数移動平均 (Numba JIT コンパイル対象)。"""
  alpha = 2.0 / (span + 1)
  result = np.empty_like(arr)
  result[0] = arr[0]
  for i in range(1, len(arr)):
    result[i] = alpha * arr[i] + (1.0 - alpha) * result[i - 1]
  return result


@_njit(cache=True)
def _vwap_core(high: np.ndarray, low: np.ndarray, close: np.ndarray, volume: np.ndarray) -> float:
  """出来高加重平均価格 (Numba JIT コンパイル対象)。"""
  typical   = (high + low + close) / 3.0
  total_vol = np.sum(volume)
  if total_vol == 0.0:
    return close[-1]
  return np.sum(typical * volume) / total_vol


@_njit(cache=True)
def _ma_core(closes: np.ndarray, period: int) -> float:
  """単純移動平均 (Numba JIT コンパイル対象)。"""
  n = len(closes)
  if n < period:
    return closes[-1]
  return np.mean(closes[-period:])


# ---- 公開インターフェース (pandas Series を受け付ける) ----

def calc_rsi(closes: pd.Series, period: int = 14) -> float:
  arr = closes.to_numpy(dtype=np.float64)
  val = _rsi_core(arr, period)
  return float(val) if not np.isnan(val) else 50.0


def calc_macd(
  closes: pd.Series,
  fast: int = 12,
  slow: int = 26,
  signal: int = 9,
) -> tuple[float, float, float]:
  """(macd_line, signal_line, histogram) を返す。"""
  if len(closes) < slow + signal:
    return 0.0, 0.0, 0.0
  arr       = closes.to_numpy(dtype=np.float64)
  ema_fast  = _ema_core(arr, fast)
  ema_slow  = _ema_core(arr, slow)
  macd_line = ema_fast - ema_slow
  sig_line  = _ema_core(macd_line, signal)
  histogram = macd_line - sig_line
  return float(macd_line[-1]), float(sig_line[-1]), float(histogram[-1])


def calc_vwap(df: pd.DataFrame, period: int = 20) -> float:
  """直近 period 日分の VWAP (日足近似)。"""
  d      = df.tail(period)
  high   = d['High'].to_numpy(dtype=np.float64)
  low    = d['Low'].to_numpy(dtype=np.float64)
  close  = d['Close'].to_numpy(dtype=np.float64)
  volume = d['Volume'].to_numpy(dtype=np.float64)
  volume = np.where(volume == 0, np.nan, volume)
  mask   = ~np.isnan(volume)
  if not mask.any():
    return float(close[-1])
  val = _vwap_core(high[mask], low[mask], close[mask], volume[mask])
  return float(val) if not np.isnan(val) else float(close[-1])


def calc_ma(closes: pd.Series, period: int) -> float:
  arr = closes.to_numpy(dtype=np.float64)
  val = _ma_core(arr, period)
  return float(val) if not np.isnan(val) else float(arr[-1])
