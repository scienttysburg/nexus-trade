from schemas import (
  IndexData, SectorData, SignalData, OHLCVData, NewsItem, StockDetail
)

# --- 市場インデックス ---
INDICES: list[IndexData] = [
  IndexData(
    symbol='N225', name='日経225', value=38542.10, change=125.30, change_pct=0.33,
    market='JP',
    sparkline=[
      38100, 38050, 38220, 38180, 38310, 38290, 38420, 38380, 38450,
      38400, 38510, 38480, 38530, 38490, 38560, 38520, 38580, 38510, 38542, 38542,
    ],
  ),
  IndexData(
    symbol='TOPIX', name='TOPIX', value=2721.50, change=8.90, change_pct=0.33,
    market='JP',
    sparkline=[
      2685, 2680, 2692, 2688, 2700, 2698, 2710, 2705, 2714,
      2708, 2716, 2711, 2718, 2713, 2722, 2718, 2724, 2719, 2721, 2721,
    ],
  ),
  IndexData(
    symbol='SPX', name='S&P 500', value=5248.80, change=18.50, change_pct=0.35,
    market='US',
    sparkline=[
      5180, 5170, 5195, 5185, 5210, 5200, 5220, 5210, 5230,
      5215, 5235, 5225, 5240, 5230, 5248, 5238, 5252, 5242, 5248, 5248,
    ],
  ),
  IndexData(
    symbol='NDX', name='NASDAQ 100', value=18326.40, change=95.20, change_pct=0.52,
    market='US',
    sparkline=[
      18050, 18020, 18100, 18070, 18150, 18120, 18200, 18170, 18240,
      18200, 18270, 18230, 18290, 18250, 18310, 18280, 18330, 18300, 18326, 18326,
    ],
  ),
]

# --- セクターヒートマップ ---
SECTORS: list[SectorData] = [
  SectorData(name='半導体・電子部品', code='semiconductor', change_pct=2.51,  signal='strong_buy',  top_tickers=['8035.T', '6857.T']),
  SectorData(name='銀行・金融',       code='banking',       change_pct=1.82,  signal='buy',         top_tickers=['8306.T', '8316.T']),
  SectorData(name='自動車・輸送機器', code='automotive',    change_pct=1.24,  signal='buy',         top_tickers=['7203.T', '7267.T']),
  SectorData(name='医薬品・ヘルスケア', code='pharma',      change_pct=0.53,  signal='buy',         top_tickers=['4519.T', '4568.T']),
  SectorData(name='情報通信',         code='telecom',       change_pct=0.21,  signal='hold',        top_tickers=['9432.T', '9984.T']),
  SectorData(name='食品・飲料',       code='food',          change_pct=-0.18, signal='hold',        top_tickers=['2802.T', '2914.T']),
  SectorData(name='不動産',           code='realestate',    change_pct=-0.62, signal='hold',        top_tickers=['8801.T', '8802.T']),
  SectorData(name='エネルギー・資源', code='energy',        change_pct=-1.15, signal='sell',        top_tickers=['5020.T', '1605.T']),
  SectorData(name='化学',             code='chemicals',     change_pct=-1.74, signal='sell',        top_tickers=['4063.T', '4188.T']),
  SectorData(name='小売・消費財',     code='retail',        change_pct=-2.48, signal='strong_sell', top_tickers=['3382.T', '7453.T']),
]

# --- シグナルリスト ---
SIGNALS: list[SignalData] = [
  SignalData(ticker='8035.T', name='東京エレクトロン',       sector='半導体・電子部品',   price=35420.0,  change_pct=2.12,  signal='Strong Buy', score=91, rsi=64.2, macd_positive=True,  vwap_dev=1.8,  timing='寄り付き直後',   market='JP'),
  SignalData(ticker='NVDA',   name='NVIDIA',                 sector='半導体・電子部品',   price=875.30,   change_pct=3.51,  signal='Strong Buy', score=92, rsi=67.5, macd_positive=True,  vwap_dev=2.3,  timing='プレマーケット', market='US'),
  SignalData(ticker='8306.T', name='三菱UFJフィナンシャル',  sector='銀行・金融',         price=1582.5,   change_pct=1.82,  signal='Strong Buy', score=83, rsi=61.8, macd_positive=True,  vwap_dev=0.9,  timing='前場中盤',       market='JP'),
  SignalData(ticker='7203.T', name='トヨタ自動車',           sector='自動車・輸送機器',   price=2850.5,   change_pct=1.24,  signal='Buy',        score=74, rsi=58.3, macd_positive=True,  vwap_dev=0.6,  timing='寄り付き直後',   market='JP'),
  SignalData(ticker='MSFT',   name='Microsoft',              sector='情報通信',           price=415.20,   change_pct=1.05,  signal='Buy',        score=68, rsi=55.9, macd_positive=True,  vwap_dev=0.4,  timing='NY寄り付き後',   market='US'),
  SignalData(ticker='4519.T', name='中外製薬',               sector='医薬品・ヘルスケア', price=5820.0,   change_pct=1.51,  signal='Buy',        score=71, rsi=57.1, macd_positive=True,  vwap_dev=0.7,  timing='前場中盤',       market='JP'),
  SignalData(ticker='6758.T', name='ソニーグループ',         sector='電機',               price=13200.0,  change_pct=0.76,  signal='Buy',        score=65, rsi=53.4, macd_positive=True,  vwap_dev=0.3,  timing='後場',           market='JP'),
  SignalData(ticker='AMZN',   name='Amazon',                 sector='eコマース',          price=185.60,   change_pct=0.91,  signal='Buy',        score=63, rsi=52.8, macd_positive=True,  vwap_dev=0.2,  timing='NY前場',         market='US'),
  SignalData(ticker='9432.T', name='日本電信電話',           sector='情報通信',           price=158.3,    change_pct=-0.50, signal='Hold',       score=48, rsi=47.2, macd_positive=False, vwap_dev=-0.2, timing='様子見',         market='JP'),
  SignalData(ticker='2802.T', name='味の素',                 sector='食品・飲料',         price=4250.0,   change_pct=-0.18, signal='Hold',       score=52, rsi=49.8, macd_positive=False, vwap_dev=-0.1, timing='様子見',         market='JP'),
  SignalData(ticker='AAPL',   name='Apple',                  sector='テクノロジー',       price=189.50,   change_pct=-0.82, signal='Hold',       score=51, rsi=48.6, macd_positive=False, vwap_dev=-0.3, timing='様子見',         market='US'),
  SignalData(ticker='4063.T', name='信越化学工業',           sector='化学',               price=6230.0,   change_pct=-0.80, signal='Hold',       score=44, rsi=44.1, macd_positive=False, vwap_dev=-0.5, timing='様子見',         market='JP'),
  SignalData(ticker='3382.T', name='セブン&アイHD',         sector='小売・消費財',       price=2180.0,   change_pct=-2.48, signal='Sell',       score=28, rsi=35.6, macd_positive=False, vwap_dev=-1.8, timing='大引け前',       market='JP'),
  SignalData(ticker='TSLA',   name='Tesla',                  sector='EV・自動車',         price=175.80,   change_pct=-2.51, signal='Sell',       score=27, rsi=34.2, macd_positive=False, vwap_dev=-2.1, timing='NY前場ショート', market='US'),
  SignalData(ticker='5020.T', name='ENEOSホールディングス', sector='エネルギー・資源',   price=785.4,    change_pct=-1.15, signal='Sell',       score=32, rsi=38.4, macd_positive=False, vwap_dev=-1.2, timing='大引け前',       market='JP'),
  SignalData(ticker='7453.T', name='良品計画',               sector='小売・消費財',       price=2480.0,   change_pct=-1.92, signal='Strong Sell',score=18, rsi=28.7, macd_positive=False, vwap_dev=-2.8, timing='売り推奨',       market='JP'),
]

# --- 個別銘柄詳細 (7203.T トヨタ) ---
_TOYOTA_OHLCV = [
  OHLCVData(date='2026-03-03', open=2790.0, high=2812.0, low=2775.0, close=2805.0, volume=8420000),
  OHLCVData(date='2026-03-04', open=2805.0, high=2825.0, low=2790.0, close=2815.0, volume=7850000),
  OHLCVData(date='2026-03-05', open=2815.0, high=2830.0, low=2800.0, close=2808.0, volume=6920000),
  OHLCVData(date='2026-03-06', open=2808.0, high=2820.0, low=2795.0, close=2812.0, volume=7340000),
  OHLCVData(date='2026-03-07', open=2812.0, high=2835.0, low=2805.0, close=2830.0, volume=9120000),
  OHLCVData(date='2026-03-10', open=2830.0, high=2848.0, low=2818.0, close=2840.0, volume=8680000),
  OHLCVData(date='2026-03-11', open=2840.0, high=2855.0, low=2828.0, close=2848.0, volume=7920000),
  OHLCVData(date='2026-03-12', open=2848.0, high=2862.0, low=2835.0, close=2858.0, volume=8340000),
  OHLCVData(date='2026-03-13', open=2858.0, high=2870.0, low=2840.0, close=2845.0, volume=9580000),
  OHLCVData(date='2026-03-14', open=2845.0, high=2860.0, low=2830.0, close=2852.0, volume=8150000),
  OHLCVData(date='2026-03-17', open=2852.0, high=2868.0, low=2838.0, close=2860.0, volume=7740000),
  OHLCVData(date='2026-03-18', open=2860.0, high=2872.0, low=2845.0, close=2855.0, volume=8920000),
  OHLCVData(date='2026-03-19', open=2855.0, high=2865.0, low=2838.0, close=2842.0, volume=7180000),
  OHLCVData(date='2026-03-20', open=2842.0, high=2855.0, low=2828.0, close=2850.0, volume=8460000),
  OHLCVData(date='2026-03-24', open=2850.0, high=2862.0, low=2835.0, close=2856.0, volume=9240000),
  OHLCVData(date='2026-03-25', open=2856.0, high=2868.0, low=2842.0, close=2862.0, volume=8720000),
  OHLCVData(date='2026-03-26', open=2862.0, high=2875.0, low=2848.0, close=2870.0, volume=9580000),
  OHLCVData(date='2026-03-27', open=2870.0, high=2882.0, low=2855.0, close=2865.0, volume=8340000),
  OHLCVData(date='2026-03-28', open=2865.0, high=2878.0, low=2850.0, close=2872.0, volume=7920000),
  OHLCVData(date='2026-03-31', open=2872.0, high=2885.0, low=2855.0, close=2848.0, volume=10240000),
  OHLCVData(date='2026-04-01', open=2848.0, high=2862.0, low=2835.0, close=2856.0, volume=9120000),
  OHLCVData(date='2026-04-02', open=2856.0, high=2870.0, low=2840.0, close=2845.0, volume=8650000),
  OHLCVData(date='2026-04-03', open=2845.0, high=2858.0, low=2830.0, close=2852.0, volume=7840000),
  OHLCVData(date='2026-04-04', open=2852.0, high=2865.0, low=2838.0, close=2858.0, volume=8960000),
  OHLCVData(date='2026-04-07', open=2858.0, high=2875.0, low=2845.0, close=2868.0, volume=9380000),
  OHLCVData(date='2026-04-08', open=2868.0, high=2882.0, low=2852.0, close=2862.0, volume=8540000),
  OHLCVData(date='2026-04-09', open=2862.0, high=2872.0, low=2842.0, close=2848.0, volume=7920000),
  OHLCVData(date='2026-04-10', open=2848.0, high=2865.0, low=2835.0, close=2856.0, volume=9240000),
  OHLCVData(date='2026-04-11', open=2816.5, high=2858.0, low=2810.0, close=2850.5, volume=10580000),
]

_TOYOTA_NEWS = [
  NewsItem(id=1, title='トヨタ、2026年度EV販売目標を100万台に上方修正', sentiment='positive', sentiment_score=0.72, published_at='2026-04-11 09:15', source='日経新聞'),
  NewsItem(id=2, title='トヨタとNVIDIA、自動運転AI開発で提携強化', sentiment='positive', sentiment_score=0.65, published_at='2026-04-10 14:30', source='ロイター'),
  NewsItem(id=3, title='トヨタ3月国内販売台数、前年比5.2%増', sentiment='positive', sentiment_score=0.48, published_at='2026-04-09 10:00', source='トヨタIR'),
  NewsItem(id=4, title='円高進行でトヨタ業績への影響懸念、1円の変動で営業利益±400億円', sentiment='negative', sentiment_score=-0.38, published_at='2026-04-08 16:45', source='Bloomberg'),
  NewsItem(id=5, title='トヨタ、全固体電池の量産化を2027年に前倒し', sentiment='positive', sentiment_score=0.81, published_at='2026-04-07 11:20', source='NHK'),
]

STOCK_DETAILS: dict[str, StockDetail] = {
  '7203.T': StockDetail(
    ticker='7203.T', name='トヨタ自動車', sector='自動車・輸送機器',
    price=2850.5, change_pct=1.24, signal='Buy', score=74,
    rsi=58.3, macd_value=12.8, macd_signal_line=8.4,
    vwap=2840.0, vwap_dev=0.6,
    ma5=2854.0, ma25=2820.0, ma75=2680.0,
    timing_advice=(
      '【推奨エントリー】寄り付き直後（9:00〜9:30）\n'
      'MACDが正転しVWAPを上抜け。RSI58で過熱感なし。\n'
      '直近5日の9:00〜9:30に上昇率が集中。寄り付きの勢いを確認後、2,840円台での押し目買いが有効。\n'
      '損切りライン: 2,810円割れ / 目標: 2,920円'
    ),
    ohlcv=_TOYOTA_OHLCV,
    news=_TOYOTA_NEWS,
  ),
}

# --- ニューステッカー ---
NEWS_TICKER: list[str] = [
  '【速報】日銀、政策金利を0.25%に引き上げ — 円相場150円台に急伸',
  '東京エレクトロン (8035.T)、Q4営業利益が市場予想を15%上回る過去最高益',
  'NVIDIA (NVDA)、次世代Blackwell Ultra GPUの量産開始を発表',
  '米FRB、6月のFOMCで利下げ示唆 — 米国債利回り低下',
  'トヨタ (7203.T)、全固体電池の量産化を2027年に前倒しと発表',
  '半導体セクター全体に買い、SOX指数が年初来高値を更新',
  '三菱UFJ (8306.T)、2026年3月期の純利益が過去最高の1.5兆円超えへ',
]
