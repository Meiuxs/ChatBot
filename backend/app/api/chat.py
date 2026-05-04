import asyncio
import json
import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from supabase import Client
from app.core.database import get_supabase
from app.schemas.chat import SendMessageRequest
from app.providers.factory import get_provider, get_provider_for_model
from app.providers.base import ChatMessage
from app.api.deps import get_current_user, get_user_settings, bump_user_data_version, check_session_owned_cached

router = APIRouter()
logger = logging.getLogger(__name__)


async def _persist_messages(
    supabase: Client,
    session_id: str,
    user_content: str,
    assistant_content: str,
    assistant_reasoning: str,
    model: str,
    user_id: str,
):
    start = time.perf_counter()
    content_len = len(assistant_content)
    logger.info(
        "CHAT persist_start user=%s session=%s content_chars=%d reasoning=%s",
        user_id, session_id, content_len,
        "yes" if assistant_reasoning else "no",
    )
    try:
        # 合并为批量插入 user + assistant，一轮 HTTP 替代两轮
        rows = [
            {"session_id": session_id, "role": "user", "content": user_content},
            {"session_id": session_id, "role": "assistant", "content": assistant_content, "model": model},
        ]
        if assistant_reasoning:
            rows[1]["reasoning"] = assistant_reasoning
        await asyncio.to_thread(
            lambda: supabase.table("messages").insert(rows).execute()
        )
        bump_user_data_version(user_id)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "CHAT persist_done user=%s session=%s total_ms=%.2f chars=%d reasoning=%s",
            user_id, session_id, elapsed, content_len,
            "yes" if assistant_reasoning else "no",
        )
    except Exception:
        logger.exception("CHAT persist_failed user=%s session=%s", user_id, session_id)


@router.post("/stream")
async def stream_chat(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    user_settings: dict = Depends(get_user_settings),
    supabase: Client = Depends(get_supabase),
):
    req_start = time.perf_counter()
    user_id = current_user["id"]
    session_id = request.sessionId

    # 请求入口日志
    msg_count = len(request.messages)
    last_msg_len = len(request.messages[-1].content) if request.messages else 0
    logger.info(
        "CHAT stream_start user=%s session=%s provider=%s model=%s msgs=%d last_chars=%d temp=%.2f reasoning=%s",
        user_id, session_id,
        request.provider or "auto", request.model,
        msg_count, last_msg_len,
        request.temperature, request.reasoningEffort or "none",
    )

    api_key = user_settings.get("api_key")
    if not api_key:
        logger.warning("CHAT no_api_key user=%s", user_id)
        raise HTTPException(status_code=400, detail="请先在设置中配置 API Key")

    messages = [
        ChatMessage(role=m.role, content=m.content)
        for m in request.messages
    ]
    user_content = request.messages[-1].content if request.messages else ""

    # 防止越权写入他人会话（带缓存，避免每次请求都走 Supabase REST）
    if not await check_session_owned_cached(session_id, current_user, supabase):
        logger.warning("CHAT session_not_found user=%s session=%s", user_id, session_id)
        raise HTTPException(status_code=404, detail="会话不存在或无访问权限")

    # 优先使用请求中指定的 provider，否则按模型名自动识别
    provider_name = request.provider or get_provider_for_model(request.model)
    provider = get_provider(provider_name)
    provider.set_api_key(api_key)

    async def event_generator():
        first_token_ms = None
        token_count = 0
        full_content = ""
        full_reasoning = ""
        try:
            async for delta in provider.chat(
                messages=messages,
                model=request.model,
                temperature=request.temperature,
                reasoning_effort=request.reasoningEffort,
            ):
                if first_token_ms is None:
                    first_token_ms = (time.perf_counter() - req_start) * 1000

                # 结构化事件（含 __event__ 标记）：透传 type 给前端
                if delta.startswith('{"__event__"'):
                    try:
                        event = json.loads(delta)
                        content = event.get("content", "")
                        event_type = event.get("type", "content")
                        if event_type == "reasoning":
                            full_reasoning += content
                        else:
                            full_content += content
                        token_count += 1
                        yield {"data": json.dumps({"delta": content, "type": event_type}, ensure_ascii=False)}
                        continue
                    except (json.JSONDecodeError, KeyError):
                        pass

                full_content += delta
                token_count += 1
                yield {"data": json.dumps({"delta": delta}, ensure_ascii=False)}

            yield {"data": "[DONE]"}
            total_ms = (time.perf_counter() - req_start) * 1000
            logger.info(
                "METRIC stream_chat user=%s session=%s provider=%s model=%s first_token_ms=%.2f total_ms=%.2f tokens=%d chars=%d reasoning=%s",
                current_user["id"],
                request.sessionId,
                provider_name,
                request.model,
                first_token_ms if first_token_ms is not None else -1,
                total_ms,
                token_count,
                len(full_content),
                "yes" if full_reasoning else "no",
            )

            # 持久化：在流结束后同步执行，失败时通知前端
            try:
                await _persist_messages(
                    supabase=supabase,
                    session_id=request.sessionId,
                    user_content=user_content,
                    assistant_content=full_content,
                    assistant_reasoning=full_reasoning,
                    model=request.model,
                    user_id=current_user["id"],
                )
            except Exception:
                logger.exception("持久化失败，将通知前端")
                yield {"data": json.dumps({"__event__": True, "type": "save_error", "content": "消息保存失败，请稍后刷新重试"})}
        except GeneratorExit:
            total_ms = (time.perf_counter() - req_start) * 1000
            logger.warning(
                "CLIENT DISCONNECT user=%s session=%s provider=%s model=%s total_ms=%.0f tokens=%d chars=%d reasoning=%s",
                current_user["id"],
                request.sessionId,
                provider_name,
                request.model,
                total_ms,
                token_count,
                len(full_content),
                "yes" if full_reasoning else "no",
            )
        except BaseException as e:
            total_ms = (time.perf_counter() - req_start) * 1000
            logger.exception(
                "CHAT stream_abort user=%s session=%s provider=%s model=%s exc=%s total_ms=%.0f tokens=%d chars=%d reasoning=%s",
                current_user["id"],
                request.sessionId,
                provider_name,
                request.model,
                type(e).__name__,
                total_ms,
                token_count,
                len(full_content),
                "yes" if full_reasoning else "no",
            )


    return EventSourceResponse(
        event_generator(),
        ping=15,
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
