import asyncio
import logging
import time
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client, create_client
from app.core.database import get_supabase
from app.core.config import get_settings
from app.api.deps import (
    get_current_user,
    ensure_session_owned,
    get_user_data_version,
    bump_user_data_version,
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
):
    start = time.perf_counter()
    user_id = current_user["id"]
    version = get_user_data_version(user_id)
    cached = _sessions_cache.get(user_id)
    now = time.time()
    if cached and (now - cached[1]) < _SESSIONS_CACHE_TTL and cached[2] == version:
        logger.info(
            "METRIC sessions_get user=%s cache=hit total_ms=%.2f",
            user_id,
            (time.perf_counter() - start) * 1000,
        )
        return {"sessions": cached[0]}

    response = await asyncio.to_thread(
        lambda: (
            supabase.table("sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
    )
    _sessions_cache[user_id] = (response.data, now, version)
    logger.info(
        "METRIC sessions_get user=%s cache=miss total_ms=%.2f size=%d",
        user_id,
        (time.perf_counter() - start) * 1000,
        len(response.data or []),
    )
    return {"sessions": response.data}


@router.post("")
async def create_session(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    body: dict | None = None,
):
    start = time.perf_counter()
    payload = {"user_id": current_user["id"]}
    if body and body.get("title"):
        payload["title"] = body["title"]

    response = await asyncio.to_thread(lambda: supabase.table("sessions").insert(payload).execute())
    bump_user_data_version(current_user["id"])
    logger.info(
        "METRIC sessions_create user=%s total_ms=%.2f",
        current_user["id"],
        (time.perf_counter() - start) * 1000,
    )
    return response.data[0]


@router.put("/sync")
async def sync_sessions(
    request: SyncSessionsRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    sessions_to_insert = []
    messages_to_insert = []
    session_ids_with_messages: list[str] = []

    for session_data in request.sessions:
        sessions_to_insert.append({
            "id": session_data.id,
            "user_id": current_user["id"],
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

    tasks = []

    # 方案 5: upsert 替代 delete+insert，只操作有变更的 session
    if sessions_to_insert:
        tasks.append(asyncio.to_thread(
            lambda: supabase.table("sessions").upsert(sessions_to_insert, on_conflict="id").execute()
        ))

    # 方案 4 + 方案 5: 并行删除旧消息（只删有消息的 session）
    valid_uuids = [sid for sid in session_ids_with_messages if _is_valid_uuid(sid)]
    if valid_uuids:
        write_client = _get_write_client()
        tasks.append(asyncio.to_thread(
            lambda: write_client.table("messages").delete().in_("session_id", valid_uuids).execute()
        ))

    # 方案 4: 并行执行 sessions upsert + messages delete
    if tasks:
        await asyncio.gather(*tasks)

    # 插入新消息（FK 依赖 sessions 已存在，upsert 已确保）
    if messages_to_insert:
        await asyncio.to_thread(
            lambda: supabase.table("messages").insert(messages_to_insert).execute()
        )

    bump_user_data_version(current_user["id"])
    logger.info(
        "METRIC sessions_sync user=%s total_ms=%.2f sessions=%d messages=%d",
        current_user["id"],
        (time.perf_counter() - start) * 1000,
        len(request.sessions),
        len(messages_to_insert),
    )
    return {"success": True}


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    await asyncio.to_thread(
        lambda: supabase.table("sessions").delete().eq("id", session_id).eq(
            "user_id", current_user["id"]
        ).execute()
    )
    bump_user_data_version(current_user["id"])
    logger.info(
        "METRIC sessions_delete user=%s session=%s total_ms=%.2f",
        current_user["id"],
        session_id,
        (time.perf_counter() - start) * 1000,
    )
    return {"success": True}


@router.put("/{session_id}")
async def update_session(
    session_id: str,
    request: UpdateSessionRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    await asyncio.to_thread(
        lambda: supabase.table("sessions").update(
            {
                "title": request.title or "新对话",
                "updated_at": "now()",
            }
        ).eq("id", session_id).eq("user_id", current_user["id"]).execute()
    )
    bump_user_data_version(current_user["id"])
    logger.info(
        "METRIC sessions_update user=%s session=%s total_ms=%.2f",
        current_user["id"],
        session_id,
        (time.perf_counter() - start) * 1000,
    )
    return {"success": True}


@router.get("/{session_id}/messages")
async def get_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    _session: dict = Depends(ensure_session_owned),
    supabase: Client = Depends(get_supabase),
):
    start = time.perf_counter()
    user_id = current_user["id"]
    version = get_user_data_version(user_id)
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
    return {"messages": response.data}
