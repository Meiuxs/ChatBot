import asyncio
import logging
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client
from app.core.database import get_supabase
from app.core.config import get_settings
from app.api.deps import (
    get_current_user,
    check_session_owned_cached,
    get_user_data_version,
    bump_user_data_version,
    CacheDomain,
)

# 方案 4: 独立的写入客户端，与 Depends(get_supabase) 返回的客户端隔离，支持并行 asyncio.to_thread
_settings_for_write = get_settings()
_write_supabase: Client = create_client(_settings_for_write.supabase_url, _settings_for_write.supabase_key)


def _get_write_client() -> Client:
    return _write_supabase


def _is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False

router = APIRouter()
logger = logging.getLogger(__name__)
_SESSIONS_CACHE_TTL = 300
_MESSAGES_CACHE_TTL = 300
_sessions_cache: dict[str, tuple[list[dict], float, int]] = {}
_messages_cache: dict[tuple[str, str], tuple[list[dict], float, int]] = {}


class SyncSessionItem(BaseModel):
    id: str
    title: str = "新对话"
    messages: list[dict] = []
    createdAt: str = ""
    updatedAt: str = ""

    model_config = {"extra": "ignore"}


class SyncSessionsRequest(BaseModel):
    sessions: list[SyncSessionItem]


class UpdateSessionRequest(BaseModel):
    title: str


@router.get("")
async def get_sessions(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    page: int = 1,
    limit: int = 100,
):
    start = time.perf_counter()
    user_id = current_user["id"]
    version = get_user_data_version(user_id, CacheDomain.SESSIONS)
    logger.info("SESSIONS list user=%s page=%d limit=%d version=%d", user_id, page, limit, version)
    now = time.time()

    # 分页参数校验
    page = max(1, page)
    limit = min(max(1, limit), 200)

    # 缓存 key 包含分页参数
    cache_key = f"{user_id}:{page}:{limit}"
    cached = _sessions_cache.get(cache_key)
    if cached and (now - cached[1]) < _SESSIONS_CACHE_TTL and cached[2] == version:
        logger.info(
            "METRIC sessions_get user=%s cache=hit total_ms=%.2f page=%d",
            user_id,
            (time.perf_counter() - start) * 1000,
            page,
        )
        return cached[0]

    offset = (page - 1) * limit
    response = await asyncio.to_thread(
        lambda: (
            supabase.table("sessions")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    )
    result = {
        "sessions": response.data,
        "meta": {
            "total": response.count or 0,
            "page": page,
            "limit": limit,
        },
    }
    _sessions_cache[cache_key] = (result, now, version)
    logger.info(
        "METRIC sessions_get user=%s cache=miss total_ms=%.2f size=%d page=%d total=%d",
        user_id,
        (time.perf_counter() - start) * 1000,
        len(response.data or []),
        page,
        response.count or 0,
    )
    return result


@router.post("")
async def create_session(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    body: dict | None = None,
):
    start = time.perf_counter()
    user_id = current_user["id"]
    has_title = bool(body and body.get("title"))
    logger.info("SESSIONS create user=%s has_title=%s", user_id, has_title)

    payload = {"user_id": user_id}
    if has_title:
        payload["title"] = body["title"]

    response = await asyncio.to_thread(lambda: supabase.table("sessions").insert(payload).execute())
    bump_user_data_version(user_id, CacheDomain.SESSIONS)
    session_id = response.data[0]["id"]
    elapsed = (time.perf_counter() - start) * 1000
    logger.info("SESSIONS create_done user=%s session=%s elapsed_ms=%.0f", user_id, session_id, elapsed)
    return response.data[0]


@router.post("/sync")
async def sync_sessions(
    request: SyncSessionsRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    user_id = current_user["id"]
    logger.info("SESSIONS sync_start user=%s sessions=%d", user_id, len(request.sessions))

    sessions_to_insert = []
    messages_to_insert = []
    session_ids_with_messages: list[str] = []

    for session_data in request.sessions:
        sessions_to_insert.append({
            "id": session_data.id,
            "user_id": user_id,
            "title": session_data.title,
            "created_at": session_data.createdAt or None,
            "updated_at": session_data.updatedAt or None,
        })
        if session_data.messages:
            session_ids_with_messages.append(session_data.id)
            for msg in session_data.messages:
                messages_to_insert.append({
                    "session_id": session_data.id,
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                    "reasoning": msg.get("reasoning"),
                })

    # 事务：按顺序执行 sessions upsert → messages delete → messages insert
    valid_uuids = [sid for sid in session_ids_with_messages if _is_valid_uuid(sid)]

    def _do_sync():
        if sessions_to_insert:
            supabase.table("sessions").upsert(sessions_to_insert, on_conflict="id").execute()
        if valid_uuids:
            _get_write_client().table("messages").delete().in_("session_id", valid_uuids).execute()
        if messages_to_insert:
            supabase.table("messages").insert(messages_to_insert).execute()

    try:
        await asyncio.to_thread(_do_sync)
    except Exception:
        logger.exception("SESSIONS sync_failed user=%s sessions=%d messages=%d elapsed_ms=%.0f",
                         user_id, len(request.sessions), len(messages_to_insert),
                         (time.perf_counter() - start) * 1000)
        raise

    bump_user_data_version(user_id, CacheDomain.SESSIONS)
    bump_user_data_version(user_id, CacheDomain.MESSAGES)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info(
        "SESSIONS sync_done user=%s sessions=%d messages=%d elapsed_ms=%.0f",
        user_id,
        len(request.sessions),
        len(messages_to_insert),
        elapsed,
    )
    return {"success": True}


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    user_id = current_user["id"]
    logger.info("SESSIONS delete user=%s session=%s", user_id, session_id)
    await asyncio.to_thread(
        lambda: supabase.table("sessions").delete().eq("id", session_id).eq(
            "user_id", user_id
        ).execute()
    )
    bump_user_data_version(user_id, CacheDomain.SESSIONS)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info("SESSIONS delete_done user=%s session=%s elapsed_ms=%.0f", user_id, session_id, elapsed)
    return {"success": True}


@router.put("/{session_id}")
async def update_session(
    session_id: str,
    request: UpdateSessionRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    user_id = current_user["id"]
    new_title = (request.title or "新对话")[:30]
    logger.info("SESSIONS update user=%s session=%s title=%s", user_id, session_id, new_title)
    await asyncio.to_thread(
        lambda: supabase.table("sessions").update(
            {
                "title": request.title or "新对话",
                "updated_at": "now()",
            }
        ).eq("id", session_id).eq("user_id", user_id).execute()
    )
    bump_user_data_version(user_id, CacheDomain.SESSIONS)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info("SESSIONS update_done user=%s session=%s elapsed_ms=%.0f", user_id, session_id, elapsed)
    return {"success": True}


@router.get("/{session_id}/messages")
async def get_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    user_id = current_user["id"]
    logger.info("SESSIONS messages_get user=%s session=%s", user_id, session_id)
    if not await check_session_owned_cached(session_id, current_user, supabase):
        raise HTTPException(status_code=404, detail="会话不存在或无访问权限")
    version = get_user_data_version(user_id, CacheDomain.MESSAGES)
    cache_key = (user_id, session_id)
    cached = _messages_cache.get(cache_key)
    now = time.time()
    if cached and (now - cached[1]) < _MESSAGES_CACHE_TTL and cached[2] == version:
        logger.info(
            "METRIC messages_get user=%s session=%s cache=hit total_ms=%.2f",
            user_id,
            session_id,
            (time.perf_counter() - start) * 1000,
        )
        return {"messages": cached[0]}

    response = await asyncio.to_thread(
        lambda: (
            supabase.table("messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
    )
    _messages_cache[cache_key] = (response.data, now, version)
    logger.info(
        "METRIC messages_get user=%s session=%s cache=miss total_ms=%.2f size=%d",
        user_id,
        session_id,
        (time.perf_counter() - start) * 1000,
        len(response.data or []),
    )
    return {"success": True, "data": {"messages": response.data}}
