from pydantic import BaseModel


class SymbolEntry(BaseModel):
  ticker: str
  name: str
  sector: str
  market: str   # 'JP' | 'US'
  enabled: bool


class AppSettings(BaseModel):
  refresh_interval: int    # バックグラウンドリフレッシュ間隔(秒)
  broadcast_interval: int  # WebSocketブロードキャスト間隔(秒)
  discord_webhook: str
  slack_webhook: str
  webhook_enabled: bool
  webhook_score_threshold: int


class IndexData(BaseModel):
  symbol: str
  name: str
  value: float
  change: float
  change_pct: float
  sparkline: list[float]
  market: str  # 'JP' | 'US'


class SectorData(BaseModel):
  name: str
  code: str
  change_pct: float
  signal: str  # 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  top_tickers: list[str]


class SignalData(BaseModel):
  ticker: str
  name: str
  sector: str
  price: float
  change_pct: float
  signal: str  # 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
  score: int   # 0-100
  rsi: float
  macd_positive: bool
  vwap_dev: float  # VWAP乖離率(%)
  timing: str
  market: str  # 'JP' | 'US'


class OHLCVData(BaseModel):
  date: str
  open: float
  high: float
  low: float
  close: float
  volume: int


class NewsItem(BaseModel):
  id: int
  title: str
  sentiment: str  # 'positive' | 'neutral' | 'negative'
  sentiment_score: float  # -1.0 to 1.0
  published_at: str
  source: str


class StockDetail(BaseModel):
  ticker: str
  name: str
  sector: str
  price: float
  change_pct: float
  signal: str
  score: int
  rsi: float
  macd_value: float
  macd_signal_line: float
  vwap: float
  vwap_dev: float
  ma5: float
  ma25: float
  ma75: float
  timing_advice: str
  ohlcv: list[OHLCVData]
  news: list[NewsItem]
