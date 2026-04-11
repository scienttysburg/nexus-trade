from fastapi import APIRouter
from schemas import SectorData
from services.market_data import fetch_all_signals, derive_sectors

router = APIRouter()


@router.get('', response_model=list[SectorData])
async def get_sectors():
  import asyncio
  loop = asyncio.get_event_loop()
  signals = await loop.run_in_executor(None, fetch_all_signals)
  return derive_sectors(signals)
