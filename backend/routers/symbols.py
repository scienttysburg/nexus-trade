"""動的銘柄管理 REST API (Step 1 - Phase 2)。

GET    /api/v1/symbols            全銘柄一覧 (enabled 状態含む)
POST   /api/v1/symbols            銘柄追加
DELETE /api/v1/symbols/{ticker}   銘柄削除
PATCH  /api/v1/symbols/{ticker}   有効/無効切り替え
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import cache
import symbol_store

router = APIRouter()


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
