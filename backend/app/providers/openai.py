import json
import time
import httpx
import logging
from typing import AsyncIterable
from app.providers.base import AIProvider, ChatMessage

logger = logging.getLogger(__name__)

# 推理模型（o 系列）：不支持 temperature，必须用 reasoning_effort + max_completion_tokens
_REASONING_MODELS = frozenset({"o1", "o3", "o3-mini", "o4-mini"})

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0))
    return _client


async def close_client() -> None:
    """Close the shared httpx client on application shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        logger.info("OpenAI httpx client closed")


class OpenAIProvider(AIProvider):
    async def chat(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        reasoning_effort: str | None = None,
    ) -> AsyncIterable[str]:
        client = _get_client()

        body: dict = {
            "model": model,
            "messages": [m.model_dump() for m in messages],
            "stream": True,
        }

        is_reasoning = model in _REASONING_MODELS

        # 推理模型参数适配：不支持 temperature，改用 reasoning_effort
        # max_completion_tokens 为推理模型必传参数
        if is_reasoning:
            body["reasoning_effort"] = reasoning_effort or "medium"
            body["max_completion_tokens"] = 100_000
        else:
            body["temperature"] = temperature
            body["max_tokens"] = 100_000

        input_chars = sum(len(m.content) for m in messages)
        logger.info(
            "OPENAI REQ model=%s msgs=%d input_chars=%d temperature=%.2f reasoning=%s",
            model,
            len(messages),
            input_chars,
            temperature,
            "yes" if is_reasoning else "no",
        )

        t_start = time.perf_counter()
        chunk_count = 0
        content_chars = 0
        finish_reason = None
        try:
            async with client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            ) as response:
                if response.status_code != 200:
                    body_bytes = await response.aread()
                    logger.error(
                        "OPENAI ERR status=%d body=%s", response.status_code,
                        body_bytes.decode(errors="replace")
                    )
                    yield f"API 错误 ({response.status_code})，请检查 API Key 和模型名称"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            logger.info(
                                "OPENAI DONE model=%s chunks=%d content_chars=%d "
                                "finish_reason=%s elapsed_ms=%.0f",
                                model,
                                chunk_count,
                                content_chars,
                                finish_reason,
                                (time.perf_counter() - t_start) * 1000,
                            )
                            return
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"]

                        fr = chunk["choices"][0].get("finish_reason")
                        if fr:
                            finish_reason = fr
                            if fr == "length":
                                logger.warning(
                                    "OPENAI TRUNCATED model=%s finish_reason=length — 输出被 token 限制截断",
                                    model,
                                )

                        content = delta.get("content", "")
                        if content:
                            content_chars += len(content)
                            chunk_count += 1
                            yield content

                logger.warning(
                    "OPENAI STREAM_END model=%s chunks=%d content_chars=%d finish_reason=%s elapsed_ms=%.0f",
                    model,
                    chunk_count,
                    content_chars,
                    finish_reason,
                    (time.perf_counter() - t_start) * 1000,
                )
        except httpx.TimeoutException:
            logger.error(
                "OPENAI TIMEOUT model=%s chunks=%d content_chars=%d elapsed_ms=%.0f",
                model,
                chunk_count,
                content_chars,
                (time.perf_counter() - t_start) * 1000,
            )
            yield "请求超时，请稍后重试"
        except httpx.ConnectError:
            logger.error("OPENAI CONNECT_ERR model=%s", model)
            yield "无法连接到 OpenAI API，请检查网络"
        except Exception:
            logger.exception(
                "OPENAI UNHANDLED model=%s chunks=%d content_chars=%d elapsed_ms=%.0f",
                model,
                chunk_count,
                content_chars,
                (time.perf_counter() - t_start) * 1000,
            )
            yield "请求发生未知错误，请稍后重试"

    async def validate_api_key(self, api_key: str) -> bool:
        client = _get_client()
        try:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False
