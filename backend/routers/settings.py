"""アプリ設定 REST API (Step 2 - Phase 2)。

GET   /api/v1/settings   現在の設定を取得
PATCH /api/v1/settings   設定を部分更新
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import app_settings

router = APIRouter()

_VALID_REFRESH    = {10, 30, 60, 120, 300}
_VALID_BROADCAST  = {1, 5, 10, 30, 60}


class SettingsPatch(BaseModel):
  refresh_interval:        int | None = None
  broadcast_interval:      int | None = None
  discord_webhook:         str | None = None
  slack_webhook:           str | None = None
  webhook_enabled:         bool | None = None
  webhook_score_threshold: int | None = None


@router.get('')
def get_settings():
  return app_settings.get()


@router.patch('')
def patch_settings(req: SettingsPatch):
  patch = req.model_dump(exclude_none=True)

  if 'refresh_interval' in patch and patch['refresh_interval'] not in _VALID_REFRESH:
    raise HTTPException(400, f'refresh_interval must be one of {sorted(_VALID_REFRESH)}')
  if 'broadcast_interval' in patch and patch['broadcast_interval'] not in _VALID_BROADCAST:
    raise HTTPException(400, f'broadcast_interval must be one of {sorted(_VALID_BROADCAST)}')
  if 'webhook_score_threshold' in patch:
    t = patch['webhook_score_threshold']
    if not (0 <= t <= 100):
      raise HTTPException(400, 'webhook_score_threshold must be 0–100')

  return app_settings.update(patch)
