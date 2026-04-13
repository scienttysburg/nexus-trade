"""仮想通貨データ取得 & シグナル計算。
yfinance の仮想通貨ティッカー (BTC-USD 等) を使用。
株式より高ボラなので、スコアリング閾値を仮想通貨向けに調整する。
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yfinance as yf

import cache
from schemas import SignalData
from services.indicators import calc_ma, calc_macd, calc_rsi, calc_vwap

logger = logging.getLogger('nexus.crypto')

_executor = ThreadPoolExecutor(max_workers=4)

# ──────────────────── 対象銘柄リスト ────────────────────

CRYPTO_TICKERS: list[dict] = [
  {'ticker': 'BTC-USD',  'name': 'Bitcoin',    'sector': 'Crypto'},
  {'ticker': 'ETH-USD',  'name': 'Ethereum',   'sector': 'Crypto'},
  {'ticker': 'SOL-USD',  'name': 'Solana',     'sector': 'Crypto'},
  {'ticker': 'XRP-USD',  'name': 'XRP',        'sector': 'Crypto'},
  {'ticker': 'BNB-USD',  'name': 'BNB',        'sector': 'Crypto'},
  {'ticker': 'ADA-USD',  'name': 'Cardano',    'sector': 'Crypto'},
  {'ticker': 'DOGE-USD', 'name': 'Dogecoin',   'sector': 'Crypto'},
  {'ticker': 'AVAX-USD', 'name': 'Avalanche',  'sector': 'Crypto'},
  {'ticker': 'DOT-USD',  'name': 'Polkadot',   'sector': 'Crypto'},
  {'ticker': 'LINK-USD', 'name': 'Chainlink',  'sector': 'Crypto'},
  {'ticker': 'MATIC-USD','name': 'Polygon',    'sector': 'Crypto'},
  {'ticker': 'UNI-USD',  'name': 'Uniswap',    'sector': 'DeFi'},
  {'ticker': 'LTC-USD',  'name': 'Litecoin',   'sector': 'Crypto'},
  {'ticker': 'BCH-USD',  'name': 'Bitcoin Cash','sector': 'Crypto'},
  {'ticker': 'ATOM-USD', 'name': 'Cosmos',     'sector': 'Crypto'},
]

_TICKER_META: dict[str, dict] = {d['ticker']: d for d in CRYPTO_TICKERS}


def _calc_crypto_score(
  rsi: float,
  macd_val: float,
  macd_sig: float,
  vwap_dev: float,
  close: float,
  ma5: float,
  ma25: float,
  ma75: float,
) -> int:
  """仮想通貨向けスコアリング。高ボラに対応するため VWAP 閾値を緩める。"""
  score = 0

  # RSI (0–25) — 閾値は株式と同じ
  if rsi <= 30:
    score += 25
  elif rsi <= 40:
    score += int(20 + (40 - rsi) * 0.5)
  elif rsi <= 50:
    score += int(12 + (50 - rsi) * 0.8)
  elif rsi <= 60:
    score += int(6 + (60 - rsi) * 0.6)
  elif rsi <= 70:
    score += int((70 - rsi) * 0.6)

  # MACD (0–25)
  hist = macd_val - macd_sig
  if macd_val > 0 and hist > 0:
    score += 25
  elif macd_val > 0 and hist <= 0:
    score += 15
  elif macd_val <= 0 and hist > 0:
    score += 10

  # VWAP乖離 (0–25) — 仮想通貨は±5%程度の乖離が普通なので閾値を2倍に
  if vwap_dev >= 4.0:
    score += 25
  elif vwap_dev >= 2.0:
    score += 20
  elif vwap_dev >= 0:
    score += 15
  elif vwap_dev >= -2.0:
    score += 8
  elif vwap_dev >= -4.0:
    score += 3

  # MA整列 (0–25)
  if close > ma5 and ma5 > ma25 and ma25 > ma75:
    score += 25
  elif close > ma5 and ma5 > ma25:
    score += 18
  elif close > ma5:
    score += 12
  elif close > ma25:
    score += 8
  elif close > ma75:
    score += 4

  return max(0, min(100, score))


def _get_signal_label(score: int) -> str:
  if score >= 80: return 'Strong Buy'
  if score >= 60: return 'Buy'
  if score >= 40: return 'Hold'
  if score >= 20: return 'Sell'
  return 'Strong Sell'


def _get_timing(score: int, macd_positive: bool) -> str:
  """仮想通貨は 24h365d なのでタイミングはトレンドベース。"""
  if score >= 80: return '強いアップトレンド'
  if score >= 65 and macd_positive: return 'アップトレンド継続'
  if score >= 50: return 'トレンド待ち'
  if score >= 30: return 'ダウントレンド注意'
  return 'ショート推奨'


def _fetch_crypto(ticker: str) -> SignalData | None:
  try:
    t = yf.Ticker(ticker)
    df = t.history(period='3mo', auto_adjust=True, actions=False, timeout=15)
    if df is None or df.empty or len(df) < 20:
      logger.warning(f'[crypto] {ticker}: データ不足')
      return None

    closes = df['Close']
    try:
      fi = t.fast_info
      current = float(fi.last_price)
      prev = float(fi.previous_close)
      if current > 0 and prev > 0:
        change_pct = (current - prev) / prev * 100
      else:
        raise ValueError('invalid fast_info')
    except Exception:
      current = float(closes.iloc[-1])
      prev = float(closes.iloc[-2])
      change_pct = (current - prev) / prev * 100

    rsi = calc_rsi(closes)
    macd_val, macd_sig, _ = calc_macd(closes)
    vwap = calc_vwap(df)
    vwap_dev = (current - vwap) / vwap * 100
    ma5 = calc_ma(closes, 5)
    ma25 = calc_ma(closes, 25)
    ma75 = calc_ma(closes, 75)

    score = _calc_crypto_score(rsi, macd_val, macd_sig, vwap_dev, current, ma5, ma25, ma75)
    signal = _get_signal_label(score)
    macd_positive = macd_val > 0
    meta = _TICKER_META.get(ticker, {'name': ticker, 'sector': 'Crypto'})

    return SignalData(
      ticker=ticker,
      name=meta['name'],
      sector=meta['sector'],
      price=round(current, 4) if current < 1 else round(current, 2),
      change_pct=round(change_pct, 2),
      signal=signal,
      score=score,
      rsi=round(rsi, 1),
      macd_positive=macd_positive,
      vwap_dev=round(vwap_dev, 2),
      timing=_get_timing(score, macd_positive),
      market='CRYPTO',
    )
  except Exception as e:
    logger.error(f'[crypto] {ticker}: {e}')
    return None


def fetch_crypto_signals() -> list[SignalData]:
  """全仮想通貨のシグナルを取得（スタンピード防止キャッシュ付き）。"""
  def _compute():
    results: list[SignalData] = []
    tickers = [d['ticker'] for d in CRYPTO_TICKERS]
    futures = {_executor.submit(_fetch_crypto, t): t for t in tickers}
    for future in as_completed(futures):
      try:
        s = future.result()
        if s:
          results.append(s)
      except Exception as e:
        logger.error(f'[crypto] future error: {e}')
    results.sort(key=lambda x: x.score, reverse=True)
    logger.info(f'[crypto] {len(results)}/{len(tickers)} 銘柄取得完了')
    return results

  return cache.get_or_compute('crypto_signals', _compute, ttl=60) or []
