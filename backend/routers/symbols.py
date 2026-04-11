"""動的銘柄管理 REST API (Step 1 - Phase 2)。

GET    /api/v1/symbols            全銘柄一覧 (enabled 状態含む)
GET    /api/v1/symbols/lookup     ティッカーから銘柄情報を自動取得
POST   /api/v1/symbols            銘柄追加
DELETE /api/v1/symbols/{ticker}   銘柄削除
PATCH  /api/v1/symbols/{ticker}   有効/無効切り替え
"""
import asyncio
import re
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import cache
import symbol_store

router = APIRouter()

_lookup_executor = ThreadPoolExecutor(max_workers=2)

# yfinance の英語業種 / 産業 → 日本語マッピング
_SECTOR_JP: dict[str, str] = {
  'Technology':              'テクノロジー',
  'Financial Services':      '銀行・金融',
  'Healthcare':              '医薬品・ヘルスケア',
  'Consumer Cyclical':       '小売・消費財',
  'Consumer Defensive':      '食品・飲料',
  'Energy':                  'エネルギー・資源',
  'Industrials':             '機械・製造',
  'Real Estate':             '不動産',
  'Communication Services':  '情報通信',
  'Basic Materials':         '化学',
  'Utilities':               'エネルギー・資源',
}
_INDUSTRY_JP: dict[str, str] = {
  'Semiconductors':                         '半導体・電子部品',
  'Semiconductor Equipment & Materials':    '半導体・電子部品',
  'Consumer Electronics':                   '電機',
  'Electronic Components':                  '電機',
  'Electrical Equipment & Parts':           '電機',
  'Auto Manufacturers':                     '自動車・輸送機器',
  'Auto Parts':                             '自動車・輸送機器',
  'Banks—Diversified':                      '銀行・金融',
  'Banks—Regional':                         '銀行・金融',
  'Insurance—Life':                         '銀行・金融',
  'Insurance—Diversified':                  '銀行・金融',
  'Drug Manufacturers—General':             '医薬品・ヘルスケア',
  'Drug Manufacturers—Specialty & Generic': '医薬品・ヘルスケア',
  'Biotechnology':                          '医薬品・ヘルスケア',
  'Health Care Plans':                      '医薬品・ヘルスケア',
  'Medical Instruments & Supplies':         '精密機器',
  'Medical Devices':                        '精密機器',
  'Specialty Retail':                       '小売・消費財',
  'Discount Stores':                        '小売・消費財',
  'Grocery Stores':                         '小売・消費財',
  'Internet Retail':                        'eコマース',
  'Internet Content & Information':         'SNS・メディア',
  'Entertainment':                          'ゲーム・エンタメ',
  'Electronic Gaming & Multimedia':         'ゲーム・エンタメ',
  'Oil & Gas Integrated':                   'エネルギー・資源',
  'Oil & Gas E&P':                          'エネルギー・資源',
  'Credit Services':                        '決済・金融',
  'Software—Application':                   'テクノロジー',
  'Software—Infrastructure':                'テクノロジー',
  'Information Technology Services':        'テクノロジー',
  'Farm & Heavy Construction Machinery':    '機械・製造',
  'Specialty Chemicals':                    '化学',
  'Telecom Services':                       '情報通信',
  'Broadcasting':                           '情報通信',
  'Aerospace & Defense':                    '機械・製造',
  'Marine Shipping':                        '海運',
  'Staffing & Employment Services':         '情報通信',
  'Restaurants':                            '小売・消費財',
  'Luxury Goods':                           '小売・消費財',
  'Apparel Retail':                         '小売・消費財',
  'Apparel Manufacturing':                  '小売・消費財',
}


def _normalize_ticker(raw: str) -> tuple[str, str]:
  """(normalized_ticker, market) を返す。
  数字のみ → .T 付与 (東証), .T あり → JP, それ以外 → US
  """
  raw = raw.strip().upper()
  if re.fullmatch(r'\d{4}', raw):
    return raw + '.T', 'JP'
  if raw.endswith('.T'):
    return raw, 'JP'
  return raw, 'US'


def _lookup_sync(ticker_raw: str) -> dict | None:
  import yfinance as yf
  ticker, market = _normalize_ticker(ticker_raw)
  try:
    info = yf.Ticker(ticker).info
  except Exception:
    return None
  if not info or info.get('regularMarketPrice') is None and info.get('currentPrice') is None:
    # 存在しない / 取得失敗
    if not info.get('longName') and not info.get('shortName'):
      return None

  name = (info.get('longName') or info.get('shortName') or ticker).strip()
  # industry → sector の順で業種を日本語マップ
  industry_en = info.get('industry', '')
  sector_en   = info.get('sector', '')
  sector_jp = (
    _INDUSTRY_JP.get(industry_en)
    or _SECTOR_JP.get(sector_en)
    or industry_en
    or sector_en
    or 'その他'
  )
  return {'ticker': ticker, 'name': name, 'sector': sector_jp, 'market': market}


@router.get('/lookup')
async def lookup_symbol(ticker: str = Query(..., description='ティッカー (例: 7203 / NVDA / 8136.T)')):
  """ティッカーコードから銘柄名・業種・市場を自動取得する。"""
  loop = asyncio.get_event_loop()
  result = await loop.run_in_executor(_lookup_executor, _lookup_sync, ticker)
  if result is None:
    raise HTTPException(404, f'"{ticker}" の情報を取得できませんでした')
  return result


class AddSymbolRequest(BaseModel):
  ticker: str
  name: str
  sector: str
  market: str  # 'JP' | 'US'


class ToggleRequest(BaseModel):
  enabled: bool


@router.get('')
def list_symbols():
  return symbol_store.get_all()


@router.post('', status_code=201)
def add_symbol(req: AddSymbolRequest):
  ticker = req.ticker.strip().upper()
  if not ticker:
    raise HTTPException(400, 'ticker is required')
  ok = symbol_store.add_symbol(ticker, req.name.strip(), req.sector.strip(), req.market.upper())
  if not ok:
    raise HTTPException(409, f'{ticker} already exists')
  cache.invalidate('signals')
  return {'ticker': ticker, 'status': 'added'}


@router.delete('/{ticker}')
def delete_symbol(ticker: str):
  ok = symbol_store.remove_symbol(ticker.upper())
  if not ok:
    raise HTTPException(404, f'{ticker} not found')
  cache.invalidate('signals')
  return {'ticker': ticker, 'status': 'removed'}


@router.patch('/{ticker}')
def toggle_symbol(ticker: str, req: ToggleRequest):
  ok = symbol_store.toggle_symbol(ticker.upper(), req.enabled)
  if not ok:
    raise HTTPException(404, f'{ticker} not found')
  cache.invalidate('signals')
  return {'ticker': ticker, 'enabled': req.enabled}
