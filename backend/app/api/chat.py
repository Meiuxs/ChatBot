import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from supabase import Client
from app.core.database import get_supabase
from app.schemas.chat import SendMessageRequest
from app.providers.factory import get_provider
from app.providers.base import ChatMessage
from app.api.deps import get_current_user, get_user_settings

router = APIRouter()


@router.get("/sessions")
async def get_sessions(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase.table("sessions")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    return {"sessions": response.data}


@router.post("/sessions")
async def create_session(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase.table("sessions")
        .insert({"user_id": current_user["id"]})
        .execute()
    )
    return response.data[0]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    supabase.table("sessions").delete().eq("id", session_id).eq(
        "user_id", current_user["id"]
    ).execute()
    return {"success": True}


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    response = (
        supabase.table("messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return {"messages": response.data}


@router.post("/stream")
async def stream_chat(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    user_settings: dict = Depends(get_user_settings),
    supabase: Client = Depends(get_supabase),
):
    api_key = user_settings.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="请先在设置中配置 API Key")

    # 保存用户消息
    supabase.table("messages").insert({
        "session_id": request.sessionId,
        "role": "user",
        "content": request.messages[-1]["content"] if request.messages else "",
    }).execute()

    messages = [
        ChatMessage(role=m["role"], content=m["content"])
        for m in request.messages
    ]

    provider = get_provider("openai")
    provider.set_api_key(api_key)

    async def event_generator():
        full_content = ""
        async for delta in provider.chat(
            messages=messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.maxTokens,
        ):
            full_content += delta
            yield {"data": json.dumps({"delta": delta})}

        yield {"data": "[DONE]"}

        # 保存 assistant 回复
        supabase.table("messages").insert({
            "session_id": request.sessionId,
            "role": "assistant",
            "content": full_content,
            "model": request.model,
        }).execute()

    return EventSourceResponse(event_generator())
