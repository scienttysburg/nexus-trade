"""yfinance によるリアルデータ取得 & 整形 (Step 3)。
テクニカル指標の計算は services/indicators.py, スコアは scoring.py に委譲。
"""
import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yfinance as yf

import cache
import app_settings
import symbol_store
from config import INDEX_DISPLAY, INDEX_TICKERS, SECTOR_CODE
from schemas import IndexData, NewsItem, OHLCVData, SectorData, SignalData, StockDetail
from services.indicators import calc_ma, calc_macd, calc_rsi, calc_vwap
from services.scoring import build_timing_advice, calc_score, get_signal_label, get_timing

logger = logging.getLogger('nexus.market_data')

# Yahoo Finance のレート制限を避けるため並列数を抑える (14 → 4)
_executor = ThreadPoolExecutor(max_workers=4)


def _get_us_prepost_flag() -> str | None:
  """現在の米国時間を判定し、Pre/Post/None を返す。"""
  from datetime import timedelta
  utc_now = time.gmtime()
  month = utc_now.tm_mon
  hour_utc = utc_now.tm_hour + utc_now.tm_min / 60
  wday = utc_now.tm_wday  # 0=Mon, 6=Sun
  if wday >= 5:
    return None
  # DST: 3〜11月は ET=UTC-4、それ以外は ET=UTC-5
  offset = -4 if 3 <= month <= 11 else -5
  hour_et = (hour_utc + offset) % 24
  if 4 <= hour_et < 9.5:
    return 'Pre'
  if 16 <= hour_et < 20:
    return 'Post'
  return None

# ------------------- 内部ヘルパー -------------------

def _market_of(ticker: str) -> str:
  return symbol_store.get_market(ticker)


def _fetch_history(
  ticker: str,
  period: str = '6mo',
  auto_adjust: bool = True,
  retries: int = 1,
) -> tuple[pd.DataFrame | None, yf.Ticker]:
  """yfinance から履歴データを取得。失敗時は 1 回リトライ。"""
  t = yf.Ticker(ticker)
  last_error: Exception | None = None
  for attempt in range(retries + 1):
    try:
      df = t.history(
        period=period,
        auto_adjust=auto_adjust,
        actions=False,
        repair=True,
        timeout=15,
      )
      if df.empty:
        logger.warning(f'[yfinance] {ticker}: empty dataframe')
        return None, t
      if len(df) < 20:
        logger.warning(f'[yfinance] {ticker}: only {len(df)} rows')
        return None, t
      return df, t
    except Exception as e:
      last_error = e
      if attempt < retries:
        time.sleep(1 + attempt)
  logger.error(f'[yfinance] {ticker}: {type(last_error).__name__}: {last_error}')
  return None, t


def _get_current_price(t: yf.Ticker, df: pd.DataFrame) -> tuple[float, float]:
  """株式の現在値を取得。fast_info を優先、失敗時は history の末尾。
  インデックス (^N225 等) は fast_info が信頼できないので使わないこと。
  """
  try:
    fi = t.fast_info
    last  = float(fi.last_price)
    prev  = float(fi.previous_close)
    if last > 0 and prev > 0:
      return last, (last - prev) / prev * 100
  except Exception:
    pass
  closes = df['Close']
  current = float(closes.iloc[-1])
  prev    = float(closes.iloc[-2])
  return current, (current - prev) / prev * 100


def _build_signal(ticker: str, df: pd.DataFrame, t: yf.Ticker) -> SignalData | None:
  try:
    closes = df['Close']
    current, change_pct = _get_current_price(t, df)

    rsi               = calc_rsi(closes)
    macd_val, macd_sig, _ = calc_macd(closes)
    vwap              = calc_vwap(df)
    vwap_dev          = (current - vwap) / vwap * 100
    ma5               = calc_ma(closes, 5)
    ma25              = calc_ma(closes, 25)
    ma75              = calc_ma(closes, 75)

    score         = calc_score(rsi, macd_val, macd_sig, vwap_dev, current, ma5, ma25, ma75)
    signal        = get_signal_label(score)
    macd_positive = macd_val > 0
    market        = _market_of(ticker)

    prepost_flag = _get_us_prepost_flag() if market == 'US' else None

    return SignalData(
      ticker=ticker,
      name=symbol_store.get_ticker_name(ticker),
      sector=symbol_store.get_ticker_sector(ticker),
      price=round(current, 2),
      change_pct=round(change_pct, 2),
      signal=signal,
      score=score,
      rsi=round(rsi, 1),
      macd_positive=macd_positive,
      vwap_dev=round(vwap_dev, 2),
      timing=get_timing(score, macd_positive, market),
      market=market,
      prepost_flag=prepost_flag,
    )
  except Exception as e:
    logger.error(f'[build_signal] {ticker}: {e}')
    return None


# ------------------- 公開 API -------------------

def _compute_signals() -> list[SignalData]:
  all_tickers = symbol_store.get_watchlist()
  results: list[SignalData] = []
  futures = {_executor.submit(_fetch_history, t): t for t in all_tickers}

  for future in as_completed(futures):
    ticker = futures[future]
    try:
      df, yf_ticker = future.result()
      if df is not None:
        s = _build_signal(ticker, df, yf_ticker)
        if s:
          results.append(s)
    except Exception as e:
      logger.error(f'[fetch_all_signals] {ticker}: {e}')

  results.sort(key=lambda x: x.score, reverse=True)
  logger.info(f'[fetch_all_signals] {len(results)}/{len(all_tickers)} 銘柄を取得')
  return results


def fetch_all_signals() -> list[SignalData]:
  """全ウォッチリストのシグナルを並列取得（スタンピード防止キャッシュ付き）。"""
  def _compute():
    results = _compute_signals()
    return results if results else []

  results = cache.get_or_compute('signals', _compute, ttl=60)
  return results or []


def fetch_indices() -> list[IndexData]:
  """主要インデックスを取得（スタンピード防止キャッシュ付き）。"""
  def _compute():
    return _compute_indices()

  result = cache.get_or_compute('indices', _compute, ttl=60)
  return result or []


def _compute_indices() -> list[IndexData]:
  indices: list[IndexData] = []
  for symbol, yticker in INDEX_TICKERS.items():
    # インデックスは配当・分割調整不要。auto_adjust=False で実際の指数値を取得する。
    # fast_info は指数で信頼できないため、常に history の最終行を使う。
    df, _ = _fetch_history(yticker, period='3mo', auto_adjust=False)
    if df is None:
      logger.warning(f'[indices] Failed to fetch {symbol} ({yticker})')
      continue
    closes   = df['Close']
    current  = float(closes.iloc[-1])
    prev     = float(closes.iloc[-2])
    change   = current - prev
    sparkline = [round(v, 2) for v in closes.tail(20).tolist()]
    display  = INDEX_DISPLAY[symbol]
    indices.append(IndexData(
      symbol=symbol,
      name=display['name'],
      value=round(current, 2),
      change=round(change, 2),
      change_pct=round(change / prev * 100, 2),
      sparkline=sparkline,
      market=display['market'],
    ))
    logger.info(f'[indices] {symbol}: {current:,.2f} ({change:+.2f})')

  if not indices:
    logger.error('[indices] すべての取得に失敗しました (Yahoo Finance 側の問題の可能性)')

  return indices


def derive_sectors(signals: list[SignalData]) -> list[SectorData]:
  """シグナルリストからセクター別集計を導出（キャッシュなし）。"""
  from collections import defaultdict
  bucket: dict[str, list[SignalData]] = defaultdict(list)
  for s in signals:
    bucket[s.sector].append(s)

  result: list[SectorData] = []
  for sector, stocks in bucket.items():
    avg_chg   = sum(s.change_pct for s in stocks) / len(stocks)
    avg_score = sum(s.score for s in stocks) / len(stocks)

    if avg_score >= 72:   sig = 'strong_buy'
    elif avg_score >= 58: sig = 'buy'
    elif avg_score >= 42: sig = 'hold'
    elif avg_score >= 28: sig = 'sell'
    else:                 sig = 'strong_sell'

    # スコアが平均から最も離れた2銘柄をトップとして表示
    top = sorted(stocks, key=lambda x: abs(x.score - 50), reverse=True)[:2]
    result.append(SectorData(
      name=sector,
      code=SECTOR_CODE.get(sector, sector.replace('・', '_')),
      change_pct=round(avg_chg, 2),
      signal=sig,
      top_tickers=[s.ticker for s in top],
    ))

  result.sort(key=lambda x: x.change_pct, reverse=True)
  return result


def fetch_stock_detail(ticker: str) -> StockDetail | None:
  """個別銘柄の詳細データを取得（キャッシュ付き）。"""
  key = f'stock_{ticker}'
  cached = cache.get(key)
  if cached is not None:
    return cached

  df, yf_t = _fetch_history(ticker, period='6mo')
  if df is None:
    return None

  try:
    closes = df['Close']
    current, change_pct = _get_current_price(yf_t, df)

    rsi               = calc_rsi(closes)
    macd_val, macd_sig, _ = calc_macd(closes)
    vwap              = calc_vwap(df)
    vwap_dev          = (current - vwap) / vwap * 100
    ma5               = calc_ma(closes, 5)
    ma25              = calc_ma(closes, 25)
    ma75              = calc_ma(closes, 75)

    score         = calc_score(rsi, macd_val, macd_sig, vwap_dev, current, ma5, ma25, ma75)
    signal        = get_signal_label(score)
    macd_positive = macd_val > 0
    market        = _market_of(ticker)

    ohlcv = [
      OHLCVData(
        date=str(ts.date()),
        open=round(float(row['Open']), 2),
        high=round(float(row['High']), 2),
        low=round(float(row['Low']), 2),
        close=round(float(row['Close']), 2),
        volume=int(row['Volume']),
      )
      for ts, row in df.tail(60).iterrows()
    ]

    timing_advice = build_timing_advice(
      ticker, signal, score, rsi, macd_positive,
      vwap_dev, current, ma5, ma25, ma75, market,
    )

    detail = StockDetail(
      ticker=ticker,
      name=symbol_store.get_ticker_name(ticker),
      sector=symbol_store.get_ticker_sector(ticker),
      price=round(current, 2),
      change_pct=round(change_pct, 2),
      signal=signal,
      score=score,
      rsi=round(rsi, 1),
      macd_value=round(macd_val, 4),
      macd_signal_line=round(macd_sig, 4),
      vwap=round(vwap, 2),
      vwap_dev=round(vwap_dev, 2),
      ma5=round(ma5, 2),
      ma25=round(ma25, 2),
      ma75=round(ma75, 2),
      timing_advice=timing_advice,
      ohlcv=ohlcv,
      news=fetch_ticker_news(ticker),
    )
    cache.set(key, detail, ttl=30)
    return detail

  except Exception as e:
    logger.error(f'[fetch_stock_detail] {ticker}: {e}')
    return None


def fetch_ticker_news(ticker: str):
  from services.news import fetch_ticker_news as _fetch
  return _fetch(ticker)


# ------------------- バックグラウンドリフレッシュ -------------------

async def start_background_refresh() -> None:
  """起動時に即時フェッチ → 以降 60 秒ごとにバックグラウンド更新。"""
  loop = asyncio.get_event_loop()

  async def _refresh() -> None:
    # インデックス (4件) を先に取得してレート制限の影響を最小化
    await loop.run_in_executor(_executor, fetch_indices)
    await loop.run_in_executor(_executor, fetch_all_signals)

  logger.info('[startup] 初回データ取得を開始')
  await _refresh()
  logger.info('[startup] 初回データ取得が完了')

  async def _loop() -> None:
    while True:
      interval = app_settings.get()['refresh_interval']
      await asyncio.sleep(interval)
      try:
        cache.invalidate('indices')
        cache.invalidate('signals')
        await _refresh()
      except Exception as e:
        logger.error(f'[refresh_loop] {e}')

  asyncio.create_task(_loop())
