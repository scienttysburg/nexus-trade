from fastapi import APIRouter
from schemas import IndexData
from services.market_data import fetch_indices

router = APIRouter()


@router.get('', response_model=list[IndexData])
async def get_indices():
  import asyncio
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, fetch_indices)
