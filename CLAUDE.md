# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

短期トレード特化型の分析・シグナル配信 Web アプリケーション（**Phase 1 + Phase 2 全 Step 完了済み**）。
日米株のテクニカル指標（MACD・RSI・VWAP・MA）を自動計算し、買い/売りシグナルをリアルタイム配信する。

- **バックエンド**: FastAPI + yfinance (Python 3.12, conda env: `nexus-trade`)
- **フロントエンド**: Next.js 14 App Router + Tailwind CSS + Recharts + PWA
- **リアルタイム**: WebSocket (`ws://localhost:8000/ws`) で broadcast_interval 秒ごとにプッシュ (デフォルト 30s)

---

## 開発コマンド

### バックエンド起動
```bash
conda activate nexus-trade
cd backend
uvicorn main:app --reload --port 8000
```
- API ドキュメント: http://localhost:8000/docs
- ヘルスチェック: http://localhost:8000/health

### フロントエンド起動
```bash
cd frontend
npm run dev   # http://localhost:3000
```

---

## アーキテクチャ

```
nexus-trade/
├── backend/
│   ├── main.py                   # FastAPI + CORS + lifespan (起動時データ取得)
│   ├── schemas.py                # Pydantic v2 モデル (全レスポンス型定義)
│   ├── config.py                 # インデックス定数・SECTOR_CODE (東証33業種)
│   ├── symbol_store.py           # JSON ベース動的銘柄管理 (threading.Lock)
│   ├── app_settings.py           # アプリ設定永続化 (app_config.json)
│   ├── cache.py                  # インメモリ TTL キャッシュ + スタンピード防止
│   ├── requirements.txt
│   ├── symbols.json              # 銘柄マスター (JP 49社 + US 28社)
│   ├── routers/
│   │   ├── indices.py            GET /api/v1/indices
│   │   ├── sectors.py            GET /api/v1/sectors
│   │   ├── signals.py            GET /api/v1/signals?sort_by=score&market=JP
│   │   ├── stocks.py             GET /api/v1/stocks/{ticker}
│   │   ├── news.py               GET /api/v1/news/ticker | /news/market | /news/stock/{ticker}
│   │   ├── symbols.py            CRUD /api/v1/symbols + GET /lookup
│   │   ├── settings.py           GET/PATCH /api/v1/settings
│   │   ├── backtest.py           GET /api/v1/backtest/{ticker}
│   │   └── ws.py                 WS  /ws (ConnectionManager + broadcast_loop)
│   └── services/
│       ├── market_data.py        yfinance データ取得・整形・バックグラウンド更新
│       ├── indicators.py         RSI / MACD / VWAP / MA 計算 (Numba JIT + fallback)
│       ├── scoring.py            スコアリング・シグナルラベル・タイミング判定
│       ├── news.py               RSS フィード取得・センチメント分析
│       ├── notifier.py           Discord / Slack Webhook 通知 (httpx async)
│       └── backtest.py           ベクトル化バックテスト (pandas EWM/rolling)
└── frontend/src/
    ├── app/
    │   ├── page.tsx              ダッシュボード (Server Component)
    │   ├── screener/page.tsx     シグナルスクリーナー (Server Component)
    │   ├── symbol/[ticker]/page.tsx  銘柄詳細 (Server Component)
    │   ├── settings/page.tsx     設定ページ (Server Component)
    │   ├── layout.tsx            Sidebar + Header + PWA metadata
    │   └── globals.css           ダークモード CSS + .input/.label/.btn-primary
    ├── components/
    │   ├── layout/Sidebar.tsx    ナビゲーション (use client)
    │   ├── layout/Header.tsx     市場開閉バッジ + 時計 (use client)
    │   ├── dashboard/
    │   │   ├── LiveDashboard.tsx WebSocket 統合ダッシュボード (use client)
    │   │   ├── IndexCard.tsx     指数カード + スパークライン (Recharts)
    │   │   ├── SectorHeatmap.tsx セクターヒートマップ
    │   │   └── NewsTicker.tsx    横スクロールティッカー
    │   ├── screener/
    │   │   ├── LiveScreener.tsx  WebSocket 統合スクリーナー (use client)
    │   │   └── SignalTable.tsx   フィルター・ソート付きテーブル (use client)
    │   ├── symbol/
    │   │   ├── StockChart.tsx    ローソク足チャート + 出来高 (Recharts, use client)
    │   │   └── BacktestCard.tsx  バックテスト結果カード (use client)
    │   └── settings/
    │       └── SettingsClient.tsx  銘柄管理 + アプリ設定 + Webhook 設定 (use client)
    ├── hooks/useWebSocket.ts     WS 接続・再接続・ping 管理カスタムフック
    ├── lib/
    │   ├── api.ts                バックエンド API クライアント (型定義込み)
    │   └── sectors.ts            signals → sectors 変換 (クライアントサイド)
    └── public/
        ├── manifest.json         PWA マニフェスト
        └── sw.js                 Service Worker (cache-first static / network-first pages)
```

---

## データフロー

```
[symbols.json] → symbol_store.py → get_watchlist() / get_ticker_name() / get_ticker_sector()
                                         ↓
[yfinance] → market_data.py → cache.get_or_compute() (スタンピード防止)
                ↓
          バックグラウンドリフレッシュ (app_settings.refresh_interval 秒ごと)
                ↓
          broadcast_loop (app_settings.broadcast_interval 秒ごと)
                ↓ (WebSocket broadcast)          ↓ (通知)
          useWebSocket hook              notifier.notify_batch()
                ↓                              ↓
          React state 更新        Discord / Slack Webhook

[Server Component (SSR)] → api.ts (http://localhost:8000) → 初期 props
[Client Component]       → /api/* (Next.js proxy) → localhost:8000
```

**重要**: `api.ts` のベース URL は SSR/CSR で分岐する:
```ts
const BASE = typeof window === 'undefined'
  ? 'http://localhost:8000/api/v1'   // Server Component
  : '/api/v1'                         // Client (Next.js proxy)
```

---

## 実装ステップ (全完了)

### Phase 1

| Step | 状態    | 内容 |
|------|---------|------|
| 1    | ✅ 完了 | FastAPI + REST API 基盤 |
| 2    | ✅ 完了 | Next.js ダッシュボード UI |
| 3    | ✅ 完了 | yfinance による実データ取得 |
| 4    | ✅ 完了 | テクニカル指標 + スコアリング |
| 5    | ✅ 完了 | RSS ニュース + センチメント分析 |
| 6    | ✅ 完了 | WebSocket リアルタイム配信 |
| 7    | ✅ 完了 | UI ブラッシュアップ (ローソク足・スケルトン・ヒートマップ改善) |

### Phase 2

| Step | 状態    | 内容 |
|------|---------|------|
| 1    | ✅ 完了 | 動的銘柄管理 (symbol_store.py + symbols.json + CRUD API) |
| 2    | ✅ 完了 | Settings UI (SettingsClient.tsx + settings ページ) |
| 3    | ✅ 完了 | パフォーマンス最適化 (Numba JIT + スタンピード防止キャッシュ) |
| 4    | ✅ 完了 | 外部通知 (Discord/Slack Webhook + notifier.py) |
| 5    | ✅ 完了 | バックテストエンジン (backtest.py + BacktestCard.tsx) |
| +    | ✅ 完了 | PWA 対応 (manifest.json + sw.js + visibilitychange 再接続) |
| +    | ✅ 完了 | 銘柄自動補完 (/lookup API + yfinance info) |
| +    | ✅ 完了 | 銘柄拡張 (JP 49社 + US 28社) |
| +    | ✅ 完了 | セクター分類を東証33業種に統一 |

---

## 既知の設計判断・落とし穴

### yfinance 関連

**インデックスは `auto_adjust=False` で取得すること**
```python
# 株式: auto_adjust=True (デフォルト) — 配当調整済み
# インデックス (^N225, ^GSPC 等): auto_adjust=False
# → True にすると配当調整が誤適用され価格が約 2 万円ズレる (N225 で確認済み)
```

**インデックスに `fast_info` は使わないこと**
```python
# fast_info.last_price はインデックスでは信頼できない
# → df['Close'].iloc[-1] のみ使用する
```

**`^TOPIX` は Yahoo Finance で廃止済み (404)**
→ 現在は N225 / S&P500 / NASDAQ100 / NYダウ (`^DJI`) の 4 指数を使用

**yfinance は scipy を依存パッケージとして要求する (0.2.50+)**
→ `requirements.txt` に `scipy>=1.11.0` が必要

**スレッドプール数は 4 に抑える**
```python
_executor = ThreadPoolExecutor(max_workers=4)
# 14 以上にすると Yahoo Finance レート制限に引っかかる
```

### 動的銘柄管理 (symbol_store.py)

- `symbols.json` を読み書きするモジュール。`threading.Lock` で排他制御
- `market_data.py` は `config.py` の定数ではなく `symbol_store.get_watchlist()` を使う
- 銘柄追加/削除後は必ず `cache.invalidate('signals')` を呼ぶ

### キャッシュ (cache.py)

**スタンピード防止**: `get_or_compute(key, compute_fn, ttl)` を使う
```python
# threading.Event でロック。同一キーへの並行リクエストは先行取得を wait する
# 60 秒タイムアウト後はフォールバック計算
```

**TTL 一覧**:
| キー | TTL | 備考 |
|------|-----|------|
| `indices` | 60s (失敗時 10s) | バックグラウンドで 60s ごとに invalidate |
| `signals` | 60s (失敗時 10s) | 同上 |
| `stock_{ticker}` | 30s | 銘柄詳細 |
| `market_news` | 300s | RSS ニュース |
| `news_{ticker}` | 300s | 個別ニュース |

### Numba JIT (indicators.py)

```python
try:
  from numba import njit as _njit
  _NUMBA = True
except ImportError:
  _NUMBA = False
  def _njit(**kw):
    def dec(fn): return fn
    return dec
```
- Numba 未インストールでもフォールバックで動作する
- `@_njit(cache=True)` で RSI/EMA/VWAP/MA のコアループを JIT コンパイル

### アプリ設定 (app_settings.py)

- `app_config.json`（`.gitignore` 対象）に永続化
- `get()` / `update(patch)` で読み書き。`threading.Lock` で排他制御
- 有効な値: `refresh_interval` ∈ {10,30,60,120,300}、`broadcast_interval` ∈ {1,5,10,30,60}

### バックテスト (services/backtest.py)

- TP+5% / SL-3% / 最大 5 日保有のシミュレーション
- EWM で RSI/MACD、rolling で VWAP/MA を全データで計算（ベクトル化）
- トレードのオーバーラップ禁止（`last_exit_i` で管理）
- グレード判定: `S/A/B/C/D` (期待値・勝率・プロフィットファクターの合計スコア)

### 銘柄自動補完 (routers/symbols.py)

- `/lookup?ticker=7203` → yfinance `info` から名称・業種・市場を取得
- 4桁数字のみ → `.T` 付与（東証）
- `_INDUSTRY_JP` → `_SECTOR_JP` の順で英語 → 東証33業種名に変換

### セクターヒートマップ

**セクターは SSR 時に固定せず、クライアントサイドで signals から導出する**
```ts
// LiveDashboard.tsx
const sectors = useMemo(() => deriveSectors(signals), [signals])
// WebSocket 更新に追従するため lib/sectors.ts で再計算
```
SSR で渡した `initialSectors` をそのまま使うと WebSocket 更新後も更新されない。

### ローソク足チャート (StockChart.tsx)

スタックバー方式で実装:
- `s0`: 透明フィラー (low - domainMin)
- `s1`: 下ひげ (bodyLow - low) → `WickShape`
- `s2`: ボディ (bodyHigh - bodyLow, 最小高さ保証) → `BodyShape`
- `s3`: 上ひげ (high - bodyHigh) → `WickShape`

YAxis domain は `[0, domainMax - domainMin]` でオフセット計算する。

### WebSocket / PWA

```
クライアント → サーバー:  "ping"
サーバー → クライアント:  {"type":"pong"}
サーバー → クライアント:  {"type":"snapshot", "signals":[...], "indices":[...]}
サーバー → クライアント:  {"type":"update",   "signals":[...], "indices":[...]}
```

- 接続後即時 `snapshot` を送信
- `broadcast_interval` 秒ごとに `update` をブロードキャスト (デフォルト 30s)
- クライアントは **20 秒**ごとに `ping` を送信 (Safari タイムアウト対策で 25s → 20s に変更済み)
- 再接続: 指数バックオフ (1s → 2s → 4s → ... → 30s 上限)
- `visibilitychange` でタブ復帰時に即時再接続 (Safari PWA 対策)

---

## 東証33業種分類 (SECTOR_CODE in config.py)

セクターコードは `config.SECTOR_CODE` に定義。`SectorHeatmap` の `code` フィールドに使用。

```
水産・農林業→fishery / 鉱業→mining / 建設業→construction / 食料品→foods
繊維製品→textiles / パルプ・紙→pulp_paper / 化学→chemicals / 医薬品→pharma
石油・石炭製品→oil_coal / ゴム製品→rubber / ガラス・土石製品→glass / 鉄鋼→steel
非鉄金属→nonferrous / 金属製品→metal_products / 機械→machinery / 電気機器→electric
輸送用機器→transport / 精密機器→precision / その他製品→misc_products
電気・ガス業→utilities / 陸運業→land_transport / 海運業→marine / 空運業→air
倉庫・運輸関連業→warehouse / 情報・通信業→it / 卸売業→wholesale / 小売業→retail
銀行業→banking / 証券・商品先物取引業→securities / 保険業→insurance
その他金融業→other_finance / 不動産業→real_estate / サービス業→services
```

---

## Pydantic モデル (schemas.py)

```python
IndexData:    symbol, name, value, change, change_pct, sparkline: list[float], market
SectorData:   name, code, change_pct, signal (snake_case), top_tickers: list[str]
SignalData:   ticker, name, sector, price, change_pct, signal (Title Case), score,
              rsi, macd_positive, vwap_dev, timing, market
StockDetail:  ...SignalData + macd_value, macd_signal_line, vwap, ma5, ma25, ma75,
              timing_advice, ohlcv: list[OHLCVData], news: list[NewsItem]
NewsItem:     id, title, sentiment, sentiment_score, published_at, source
TradeRecord:  entry_date, exit_date, entry_price, exit_price, return_pct, exit_reason
BacktestResult: ticker, period_days, total_trades, win_rate, avg_win, avg_loss,
                profit_factor, expected_value, grade, trades: list[TradeRecord]
AppSettings:  refresh_interval, broadcast_interval, discord_webhook, slack_webhook,
              webhook_enabled, webhook_score_threshold
```

**注意**: `SectorData.signal` は snake_case (`strong_buy`)、`SignalData.signal` は Title Case (`Strong Buy`)

---

## スコアリング (scoring.py)

合計 0–100 点 (各 25 点×4):

| 指標 | 条件 | 点数 |
|------|------|------|
| RSI | ≤30 | 25 |
| RSI | ≤40 | 20-25 (線形) |
| RSI | 60-70 | 0-6 |
| RSI | >70 | 0 |
| MACD | val>0 かつ hist>0 | 25 |
| MACD | val>0 かつ hist≤0 | 15 |
| MACD | val≤0 かつ hist>0 | 10 |
| VWAP乖離 | ≥+2% | 25 |
| VWAP乖離 | ≥+1% | 20 |
| VWAP乖離 | ≥0% | 15 |
| MA整列 | close>MA5>MA25>MA75 | 25 |
| MA整列 | close>MA5>MA25 | 18 |

| スコア | シグナルラベル |
|--------|---------------|
| 80–100 | Strong Buy |
| 60–79  | Buy |
| 40–59  | Hold |
| 20–39  | Sell |
| 0–19   | Strong Sell |

---

## フロントエンド デザインシステム

**カラー** (globals.css / tailwind.config.ts):
```
背景:   #0d1117 (body), #161b22 (card), #1c2128 (hover), #30363d (border)
文字:   #e6edf3 (primary), #c9d1d9 (secondary), #8b949e (muted)
買い:   #3fb950    売り: #f85149    様子見: #d29922    アクセント: #58a6ff
```

**Tailwind ユーティリティクラス**: `.text-buy`, `.text-sell`, `.text-hold`, `.text-accent`, `.bg-card`, `.border-dim`, `.bg-buy`, `.bg-sell`, `.bg-hold`

**CSS ユーティリティ** (globals.css): `.input`, `.label`, `.btn-primary`

**アニメーション** (globals.css): `animate-fade-in`, `animate-shimmer`

---

## ウォッチリスト (symbols.json)

- **JP**: 49 銘柄 (東証プライム主要銘柄、東証33業種に準拠)
- **US**: 28 銘柄 (NVDA, AAPL, MSFT, AMZN, TSLA, GOOGL 等)
- **インデックス**: N225 (`^N225`), SPX (`^GSPC`), NDX (`^NDX`), DJI (`^DJI`)
- ウォッチリストは `symbol_store.py` 経由で動的に管理。`config.py` の定数は**参照しない**

---

## 環境セットアップ (初回)

```bash
# conda 環境
conda create -n nexus-trade python=3.12
conda activate nexus-trade
cd backend
pip install -r requirements.txt
# numba, httpx も requirements.txt に含まれている

# フロントエンド
cd frontend
npm install
```
