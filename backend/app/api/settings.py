import time
import logging
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from supabase import Client
from app.core.database import get_supabase
from app.core.security import encrypt_api_key
from app.schemas.settings import SettingsResponse, UpdateSettingsRequest
from app.api.deps import get_current_user, get_user_settings, bump_user_data_version
from app.api import deps

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    user_settings: dict = Depends(get_user_settings),
):
    start = time.perf_counter()
    response = SettingsResponse(
        apiKey=user_settings.get("api_key", ""),
        model=user_settings.get("model", "gpt-4o"),
        provider=user_settings.get("provider", "openai"),
        temperature=user_settings.get("temperature", 0.7),
        maxTokens=user_settings.get("max_tokens", 2000),
        theme=user_settings.get("theme", "light"),
    )
    logger.info(
        "METRIC settings_get user=%s total_ms=%.2f",
        current_user["id"],
        (time.perf_counter() - start) * 1000,
    )
    return response


@router.put("")
async def update_settings(
    request: UpdateSettingsRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    data = {
        "user_id": current_user["id"],
        "api_key": encrypt_api_key(request.apiKey),
        "model": request.model,
        "provider": request.provider,
        "temperature": request.temperature,
        "max_tokens": request.maxTokens,
        "theme": request.theme,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # 使用 upsert 替代 SELECT + UPDATE/INSERT，省掉一次 HTTP 往返
    await asyncio.to_thread(
        lambda: supabase.table("settings").upsert(data, on_conflict="user_id").execute()
    )

    # 立即失效缓存，避免更新后短时间读取到旧值
    deps._settings_cache.pop(current_user["id"], None)
    bump_user_data_version(current_user["id"])
    logger.info(
        "METRIC settings_update user=%s total_ms=%.2f",
        current_user["id"],
        (time.perf_counter() - start) * 1000,
    )
    return {"success": True}
