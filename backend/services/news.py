"""ニュース取得 & センチメント分析 (Step 5)。

データソース:
  - 個別銘柄: yfinance の .news プロパティ（英語ニュース）
  - 市場全般: Reuters JP / Yahoo Finance JP の RSS フィード
センチメント: 金融特化キーワード辞書ベースのスコアリング（日英対応）。
外部 ML ライブラリ不要。
"""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import feedparser
import yfinance as yf

import cache
from schemas import NewsItem

_executor = ThreadPoolExecutor(max_workers=4)

# ───────────────────────── センチメント辞書 ─────────────────────────

_POSITIVE: list[str] = [
  # 日本語
  '増収', '増益', '最高益', '過去最高', '上方修正', '増配', '自社株買い',
  '好調', '黒字', '上昇', '急騰', '買い', '強気', '回復', '成長',
  '拡大', '好業績', '新高値', '反発', '底打ち', '改善', '躍進',
  '提携', '受注', '新製品', '量産', '承認', '特許', '増産',
  # English
  'beat', 'exceed', 'record high', 'upgrade', 'outperform', 'buy',
  'strong', 'growth', 'surge', 'rally', 'profit', 'revenue growth',
  'bullish', 'positive', 'improve', 'expand', 'partnership', 'approval',
  'raised guidance', 'above expectations', 'dividend increase',
]

_NEGATIVE: list[str] = [
  # 日本語
  '減収', '減益', '赤字', '下方修正', '減配', '損失', 'リストラ',
  '不正', 'リコール', '訴訟', '規制', '制裁', '懸念', '売り',
  '弱気', '急落', '下落', '低迷', '悪化', '縮小', '撤退',
  '破綻', '倒産', 'デフォルト', '警告', '調査', '違反',
  # English
  'miss', 'below expectations', 'downgrade', 'underperform', 'sell',
  'loss', 'decline', 'fall', 'drop', 'weak', 'cut guidance',
  'layoff', 'recall', 'lawsuit', 'penalty', 'investigation',
  'bearish', 'negative', 'concern', 'warning', 'risk',
]

_STRONG_POSITIVE = {'最高益', '過去最高', '上方修正', '急騰', 'record high', 'beat', 'surge', 'raised guidance'}
_STRONG_NEGATIVE = {'下方修正', '赤字', '不正', 'リコール', '急落', 'miss', 'loss', 'downgrade', 'lawsuit'}


def calc_sentiment(text: str) -> tuple[str, float]:
  """(label, score) を返す。score は -1.0 〜 1.0。"""
  t = text.lower()
  pos = sum(2 if w in _STRONG_POSITIVE else 1 for w in _POSITIVE if w.lower() in t)
  neg = sum(2 if w in _STRONG_NEGATIVE else 1 for w in _NEGATIVE if w.lower() in t)
  total = pos + neg
  if total == 0:
    return 'neutral', 0.0
  raw = (pos - neg) / total
  score = round(max(-1.0, min(1.0, raw)), 2)
  if score >= 0.15:
    label = 'positive'
  elif score <= -0.15:
    label = 'negative'
  else:
    label = 'neutral'
  return label, score


# ───────────────────────── RSS フィード ─────────────────────────

_RSS_FEEDS: list[dict] = [
  {'url': 'https://feeds.reuters.com/reuters/JPBusinessNews', 'source': 'Reuters JP'},
  {'url': 'https://feeds.reuters.com/reuters/businessNews',   'source': 'Reuters'},
  {'url': 'https://rss.nikkei.com/n/cmt/content/rss1.rdf',    'source': '日経新聞'},
  {'url': 'https://news.yahoo.co.jp/rss/topics/business.xml', 'source': 'Yahoo Finance JP'},
]


def _parse_date(entry) -> str:
  for attr in ('published_parsed', 'updated_parsed'):
    val = getattr(entry, attr, None)
    if val:
      try:
        return datetime(*val[:6], tzinfo=timezone.utc).strftime('%Y-%m-%d %H:%M')
      except Exception:
        pass
  return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')


def _fetch_rss(feed: dict) -> list[NewsItem]:
  try:
    parsed = feedparser.parse(feed['url'])
    items: list[NewsItem] = []
    for i, entry in enumerate(parsed.entries[:8]):
      title = getattr(entry, 'title', '') or ''
      summary = getattr(entry, 'summary', '') or ''
      text = title + ' ' + summary
      label, score = calc_sentiment(text)
      items.append(NewsItem(
        id=i,
        title=title.strip(),
        sentiment=label,
        sentiment_score=score,
        published_at=_parse_date(entry),
        source=feed['source'],
      ))
    return items
  except Exception as e:
    print(f'[RSS] {feed["source"]}: {e}')
    return []


def fetch_market_news() -> list[NewsItem]:
  """全 RSS フィードから市場ニュースを取得（キャッシュ 5 分）。"""
  cached = cache.get('market_news')
  if cached is not None:
    return cached

  all_items: list[NewsItem] = []
  futures = {_executor.submit(_fetch_rss, f): f for f in _RSS_FEEDS}
  for future in as_completed(futures):
    try:
      all_items.extend(future.result())
    except Exception:
      pass

  # published_at 降順でソート、重複タイトルを除去
  seen: set[str] = set()
  deduped: list[NewsItem] = []
  for item in sorted(all_items, key=lambda x: x.published_at, reverse=True):
    key = item.title[:40]
    if key not in seen:
      seen.add(key)
      deduped.append(item)

  # id を振り直す
  result = [NewsItem(**{**item.model_dump(), 'id': i}) for i, item in enumerate(deduped[:30])]
  cache.set('market_news', result, ttl=300)
  return result


def fetch_ticker_news(ticker: str) -> list[NewsItem]:
  """yfinance の news プロパティから個別銘柄ニュースを取得（キャッシュ 5 分）。"""
  key = f'news_{ticker}'
  cached = cache.get(key)
  if cached is not None:
    return cached

  try:
    raw = yf.Ticker(ticker).news or []
  except Exception:
    raw = []

  items: list[NewsItem] = []
  for i, n in enumerate(raw[:10]):
    title = n.get('title', '')
    if not title:
      continue
    label, score = calc_sentiment(title)
    ts = n.get('providerPublishTime', 0)
    try:
      pub = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M')
    except Exception:
      pub = '—'
    items.append(NewsItem(
      id=i,
      title=title,
      sentiment=label,
      sentiment_score=score,
      published_at=pub,
      source=n.get('publisher', '—'),
    ))

  if not items:
    items = [NewsItem(
      id=0,
      title=f'ニュースデータが見つかりませんでした ({ticker})',
      sentiment='neutral',
      sentiment_score=0.0,
      published_at='—',
      source='—',
    )]

  cache.set(key, items, ttl=300)
  return items


def build_news_ticker(news: list[NewsItem]) -> list[str]:
  """ティッカー表示用の文字列リストを生成。"""
  labels = {'positive': '▲', 'negative': '▼', 'neutral': '●'}
  return [f'{labels[n.sentiment]} {n.title}' for n in news[:15]]
