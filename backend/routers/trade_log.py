from fastapi import APIRouter, HTTPException, Query
from schemas import TradePosition, TradePositionCreate, TradePositionUpdate
from services import trade_log as tl

router = APIRouter()

_VALID_STATUSES = {'open', 'closed'}


@router.get('', response_model=list[TradePosition])
def list_positions(status: str | None = Query(None, description='open | closed')):
  if status is not None and status not in _VALID_STATUSES:
    raise HTTPException(400, f'status must be one of: {_VALID_STATUSES}')
  return tl.get_positions(status)


@router.post('', response_model=TradePosition, status_code=201)
def add_position(body: TradePositionCreate):
  return tl.create_position(body)


@router.get('/{pos_id}', response_model=TradePosition)
def get_position(pos_id: int):
  pos = tl.get_position(pos_id)
  if pos is None:
    raise HTTPException(404, 'position not found')
  return pos


@router.patch('/{pos_id}', response_model=TradePosition)
def update_position(pos_id: int, body: TradePositionUpdate):
  pos = tl.update_position(pos_id, body)
  if pos is None:
    raise HTTPException(404, 'position not found')
  return pos


@router.delete('/{pos_id}')
def delete_position(pos_id: int):
  if not tl.delete_position(pos_id):
    raise HTTPException(404, 'position not found')
  return {'id': pos_id, 'status': 'deleted'}
