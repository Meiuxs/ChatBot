import json
import time
import httpx
import logging
from typing import AsyncIterable
from app.providers.base import AIProvider, ChatMessage

logger = logging.getLogger(__name__)

# 旧模型名兼容映射（deepseek-chat/reasoner 将于 2026/07/24 弃用）
_MODEL_MAP = {
    "deepseek-chat": "deepseek-v4-flash",
    "deepseek-reasoner": "deepseek-v4-flash",
}
# 旧名中需要启用思考模式的模型
_REASONER_NAMES = {"deepseek-reasoner"}

# 复用 httpx 客户端（连接池，避免每次 TCP+TLS 握手）
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0))
    return _client


async def close_client() -> None:
    """Close the shared httpx client on application shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        logger.info("DeepSeek httpx client closed")


class DeepSeekProvider(AIProvider):
    BASE_URL = "https://api.deepseek.com"

    async def chat(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        reasoning_effort: str | None = None,
    ) -> AsyncIterable[str]:
        api_model = _MODEL_MAP.get(model, model)

        # 是否真正启用了思考模式（用于判断是否忽略 API 返回的 reasoning_content）
        thinking_requested = False

        # DeepSeek max_tokens 默认仅 4096，必须显式设置才能获得长输出
        payload: dict = {
            "model": api_model,
            "messages": [m.model_dump() for m in messages],
            "stream": True,
            "temperature": temperature,
            "max_tokens": 393_216,
        }

        # 思考模式：由前端 reasoning_effort 参数控制
        if model in _REASONER_NAMES:
            payload["thinking"] = {"type": "enabled"}
            payload["reasoning_effort"] = reasoning_effort or "high"
            thinking_requested = True
        elif reasoning_effort:
            payload["thinking"] = {"type": "enabled"}
            payload["reasoning_effort"] = reasoning_effort
            thinking_requested = True

        input_chars = sum(len(m.content) for m in messages)
        logger.info(
            "DEEPSEEK REQ model=%s api_model=%s msgs=%d input_chars=%d temperature=%.2f thinking=%s",
            model,
            api_model,
            len(messages),
            input_chars,
            temperature,
            "yes" if thinking_requested else "no",
        )

        client = _get_client()
        t_start = time.perf_counter()
        chunk_count = 0
        content_chars = 0
        reasoning_chars = 0
        finish_reason = None
        try:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(
                        "DEEPSEEK ERR status=%d body=%s", response.status_code, body.decode(errors="replace")
                    )
                    yield f"API 错误 ({response.status_code})，请检查 API Key 和模型名称"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            logger.info(
                                "DEEPSEEK DONE model=%s chunks=%d content_chars=%d reasoning_chars=%d "
                                "finish_reason=%s elapsed_ms=%.0f",
                                api_model,
                                chunk_count,
                                content_chars,
                                reasoning_chars,
                                finish_reason,
                                (time.perf_counter() - t_start) * 1000,
                            )
                            return
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"]
                        # 记录 finish_reason（仅在最后一个 chunk 出现）
                        fr = chunk["choices"][0].get("finish_reason")
                        if fr:
                            finish_reason = fr
                            if fr == "length":
                                logger.warning(
                                    "DEEPSEEK TRUNCATED model=%s finish_reason=length — 输出被 token 限制截断",
                                    api_model,
                                )
                        # 思考模式的推理内容（reasoning_content）
                        reasoning = delta.get("reasoning_content", "")
                        if reasoning and thinking_requested:
                            reasoning_chars += len(reasoning)
                            yield json.dumps({"__event__": True, "type": "reasoning", "content": reasoning})
                        # 正式回答内容
                        content = delta.get("content", "")
                        if content:
                            content_chars += len(content)
                            chunk_count += 1
                            yield json.dumps({"__event__": True, "type": "content", "content": content})

                # 流正常结束但未收到 [DONE]
                logger.warning(
                    "DEEPSEEK STREAM_END model=%s chunks=%d content_chars=%d finish_reason=%s elapsed_ms=%.0f",
                    api_model,
                    chunk_count,
                    content_chars,
                    finish_reason,
                    (time.perf_counter() - t_start) * 1000,
                )
        except httpx.TimeoutException:
            logger.error(
                "DEEPSEEK TIMEOUT model=%s chunks=%d content_chars=%d elapsed_ms=%.0f",
                api_model,
                chunk_count,
                content_chars,
                (time.perf_counter() - t_start) * 1000,
            )
            yield "请求超时，请稍后重试"
        except httpx.ConnectError:
            logger.error("DEEPSEEK CONNECT_ERR model=%s", api_model)
            yield "无法连接到 DeepSeek API，请检查网络"
        except Exception:
            logger.exception(
                "DEEPSEEK UNHANDLED model=%s chunks=%d content_chars=%d elapsed_ms=%.0f",
                api_model,
                chunk_count,
                content_chars,
                (time.perf_counter() - t_start) * 1000,
            )
            yield "请求发生未知错误，请稍后重试"

    async def validate_api_key(self, api_key: str) -> bool:
        client = _get_client()
        try:
            response = await client.get(
                f"{self.BASE_URL}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False
