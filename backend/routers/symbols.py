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

# yfinance の英語業種 / 産業 → 東証33業種 日本語マッピング
_SECTOR_JP: dict[str, str] = {
  'Technology':              '電気機器',
  'Financial Services':      'その他金融業',
  'Healthcare':              '医薬品',
  'Consumer Cyclical':       '小売業',
  'Consumer Defensive':      '食料品',
  'Energy':                  '石油・石炭製品',
  'Industrials':             '機械',
  'Real Estate':             '不動産業',
  'Communication Services':  '情報・通信業',
  'Basic Materials':         '化学',
  'Utilities':               '電気・ガス業',
}
_INDUSTRY_JP: dict[str, str] = {
  'Semiconductors':                         '電気機器',
  'Semiconductor Equipment & Materials':    '電気機器',
  'Consumer Electronics':                   '電気機器',
  'Electronic Components':                  '電気機器',
  'Electrical Equipment & Parts':           '電気機器',
  'Auto Manufacturers':                     '輸送用機器',
  'Auto Parts':                             '輸送用機器',
  'Aerospace & Defense':                    '輸送用機器',
  'Banks—Diversified':                      '銀行業',
  'Banks—Regional':                         '銀行業',
  'Insurance—Life':                         '保険業',
  'Insurance—Diversified':                  '保険業',
  'Insurance—Property & Casualty':          '保険業',
  'Capital Markets':                        '証券・商品先物取引業',
  'Financial Data & Stock Exchanges':       '証券・商品先物取引業',
  'Credit Services':                        'その他金融業',
  'Drug Manufacturers—General':             '医薬品',
  'Drug Manufacturers—Specialty & Generic': '医薬品',
  'Biotechnology':                          '医薬品',
  'Health Care Plans':                      'サービス業',
  'Medical Instruments & Supplies':         '精密機器',
  'Medical Devices':                        '精密機器',
  'Specialty Retail':                       '小売業',
  'Discount Stores':                        '小売業',
  'Grocery Stores':                         '小売業',
  'Apparel Retail':                         '小売業',
  'Restaurants':                            '小売業',
  'Luxury Goods':                           'その他製品',
  'Apparel Manufacturing':                  '繊維製品',
  'Internet Retail':                        '小売業',
  'Internet Content & Information':         '情報・通信業',
  'Software—Application':                   '情報・通信業',
  'Software—Infrastructure':                '情報・通信業',
  'Information Technology Services':        '情報・通信業',
  'Telecom Services':                       '情報・通信業',
  'Broadcasting':                           '情報・通信業',
  'Entertainment':                          'その他製品',
  'Electronic Gaming & Multimedia':         'その他製品',
  'Staffing & Employment Services':         'サービス業',
  'Oil & Gas Integrated':                   '石油・石炭製品',
  'Oil & Gas E&P':                          '鉱業',
  'Oil & Gas Refining & Marketing':         '石油・石炭製品',
  'Specialty Chemicals':                    '化学',
  'Chemicals':                              '化学',
  'Farm & Heavy Construction Machinery':    '機械',
  'Industrial Machinery':                   '機械',
  'Steel':                                  '鉄鋼',
  'Copper':                                 '非鉄金属',
  'Aluminum':                               '非鉄金属',
  'Marine Shipping':                        '海運業',
  'Trucking':                               '陸運業',
  'Airlines':                               '空運業',
  'Real Estate—Diversified':                '不動産業',
  'Real Estate Services':                   '不動産業',
  'REIT—Diversified':                       '不動産業',
  'Farm Products':                          '食料品',
  'Beverages—Non-Alcoholic':               '食料品',
  'Tobacco':                                '食料品',
  'Household & Personal Products':          '化学',
  'Paper & Paper Products':                 'パルプ・紙',
  'Rubber & Plastics':                      'ゴム製品',
  'Glass, Ceramics & Concrete':             'ガラス・土石製品',
  'Metal Fabrication':                      '金属製品',
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
