# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

短期トレード特化型の分析・シグナル配信 Web アプリケーション（**全 Step 完了済み**）。
日米株のテクニカル指標（MACD・RSI・VWAP・MA）を自動計算し、買い/売りシグナルをリアルタイム配信する。

- **バックエンド**: FastAPI + yfinance (Python 3.12, conda env: `nexus-trade`)
- **フロントエンド**: Next.js 14 App Router + Tailwind CSS + Recharts
- **リアルタイム**: WebSocket (`ws://localhost:8000/ws`) で 30 秒ごとにプッシュ

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
│   ├── config.py                 # ウォッチリスト・表示名・セクター・インデックスの定数
│   ├── cache.py                  # インメモリ TTL キャッシュ (get/set/invalidate)
│   ├── requirements.txt
│   ├── routers/
│   │   ├── indices.py            GET /api/v1/indices
│   │   ├── sectors.py            GET /api/v1/sectors
│   │   ├── signals.py            GET /api/v1/signals?sort_by=score&market=JP
│   │   ├── stocks.py             GET /api/v1/stocks/{ticker}
│   │   ├── news.py               GET /api/v1/news/ticker | /news/market | /news/stock/{ticker}
│   │   └── ws.py                 WS  /ws (ConnectionManager + broadcast_loop)
│   └── services/
│       ├── market_data.py        yfinance データ取得・整形・バックグラウンド更新
│       ├── indicators.py         RSI / MACD / VWAP / MA 計算 (純粋関数)
│       ├── scoring.py            スコアリング・シグナルラベル・タイミング判定
│       └── news.py               RSS フィード取得・センチメント分析
└── frontend/src/
    ├── app/
    │   ├── page.tsx              ダッシュボード (Server Component)
    │   ├── screener/page.tsx     シグナルスクリーナー (Server Component)
    │   ├── symbol/[ticker]/page.tsx  銘柄詳細 (Server Component)
    │   ├── layout.tsx            Sidebar + Header 共通レイアウト
    │   └── globals.css           ダークモード CSS + アニメーション
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
    │   └── symbol/
    │       └── StockChart.tsx    ローソク足チャート + 出来高 (Recharts, use client)
    ├── hooks/useWebSocket.ts     WS 接続・再接続・ping 管理カスタムフック
    └── lib/
        ├── api.ts                バックエンド API クライアント (型定義込み)
        └── sectors.ts            signals → sectors 変換 (クライアントサイド)
```

---

## データフロー

```
[yfinance] → market_data.py → cache (TTL 60s)
                ↓
          バックグラウンドリフレッシュ (60秒ごと)
                ↓
          broadcast_loop (30秒ごと) → WebSocket → useWebSocket hook
                                                        ↓
                                              React state 更新 → 再レンダリング

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

| Step | 状態    | 内容 |
|------|---------|------|
| 1    | ✅ 完了 | FastAPI + REST API 基盤 |
| 2    | ✅ 完了 | Next.js ダッシュボード UI |
| 3    | ✅ 完了 | yfinance による実データ取得 |
| 4    | ✅ 完了 | テクニカル指標 + スコアリング |
| 5    | ✅ 完了 | RSS ニュース + センチメント分析 |
| 6    | ✅ 完了 | WebSocket リアルタイム配信 |
| 7    | ✅ 完了 | UI ブラッシュアップ (ローソク足・スケルトン・ヒートマップ改善) |

---

## 既知の設計判断・落とし穴

### yfinance 関連

**インデックスは `auto_adjust=False` で取得すること**
```python
# 株式: auto_adjust=True (デフォルト) — 配当調整済み
# インデックス (^N225, ^GSPC 等): auto_adjust=False
# → True にすると配当調整が誤適用され価格が約 2 万円ズレる (N225 で確認済み)
df, _ = _fetch_history(yticker, period='3mo', auto_adjust=False)
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

### キャッシュ TTL

| キー | TTL | 備考 |
|------|-----|------|
| `indices` | 60s (失敗時 10s) | バックグラウンドで 60s ごとに invalidate |
| `signals` | 60s (失敗時 10s) | 同上 |
| `stock_{ticker}` | 30s | 銘柄詳細 |
| `market_news` | 300s | RSS ニュース |
| `news_{ticker}` | 300s | 個別ニュース |

---

## Pydantic モデル (schemas.py)

```python
IndexData:   symbol, name, value, change, change_pct, sparkline: list[float], market
SectorData:  name, code, change_pct, signal (snake_case), top_tickers: list[str]
SignalData:  ticker, name, sector, price, change_pct, signal (Title Case), score,
             rsi, macd_positive, vwap_dev, timing, market
StockDetail: ...SignalData + macd_value, macd_signal_line, vwap, ma5, ma25, ma75,
             timing_advice, ohlcv: list[OHLCVData], news: list[NewsItem]
NewsItem:    id, title, sentiment, sentiment_score, published_at, source
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

**アニメーション** (globals.css): `animate-fade-in`, `animate-shimmer`

---

## ウォッチリスト (config.py)

- **JP**: 26 銘柄 (トヨタ, ソニー, 三菱UFJ 等 東証プライム主要銘柄)
- **US**: 15 銘柄 (NVDA, AAPL, MSFT, AMZN, TSLA, GOOGL, META, AMD, AVGO, JPM, V, WMT, UNH, MA, XOM)
- **インデックス**: N225 (`^N225`), SPX (`^GSPC`), NDX (`^NDX`), DJI (`^DJI`)

---

## WebSocket プロトコル

```
クライアント → サーバー:  "ping"
サーバー → クライアント:  {"type":"pong"}
サーバー → クライアント:  {"type":"snapshot", "signals":[...], "indices":[...]}
サーバー → クライアント:  {"type":"update",   "signals":[...], "indices":[...]}
```

- 接続後即時 `snapshot` を送信
- 30 秒ごとに `broadcast_loop` が `update` をブロードキャスト
- クライアントは 25 秒ごとに `ping` を送信
- 再接続: 指数バックオフ (1s → 2s → 4s → ... → 30s 上限)

---

## 環境セットアップ (初回)

```bash
# conda 環境
conda create -n nexus-trade python=3.12
conda activate nexus-trade
cd backend
pip install -r requirements.txt

# フロントエンド
cd frontend
npm install
```
