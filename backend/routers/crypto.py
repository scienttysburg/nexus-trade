import asyncio
from fastapi import APIRouter
from schemas import SignalData
from services.crypto import fetch_crypto_signals

router = APIRouter()


@router.get('', response_model=list[SignalData])
async def get_crypto_signals():
  loop = asyncio.get_event_loop()
  return await loop.run_in_executor(None, fetch_crypto_signals)
