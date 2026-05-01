import json
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
        _client = httpx.AsyncClient(timeout=120.0)
    return _client


class OpenAIProvider(AIProvider):
    async def chat(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        max_tokens: int,
        reasoning_effort: str | None = None,
    ) -> AsyncIterable[str]:
        client = _get_client()

        body: dict = {
            "model": model,
            "messages": [m.model_dump() for m in messages],
            "stream": True,
        }

        # 推理模型参数适配：不支持 temperature，改用 reasoning_effort
        if model in _REASONING_MODELS:
            body["reasoning_effort"] = reasoning_effort or "medium"
            if max_tokens:
                body["max_completion_tokens"] = max_tokens
        else:
            body["temperature"] = temperature
            body["max_tokens"] = max_tokens

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
                        "OpenAI API error: %d %s", response.status_code,
                        body_bytes.decode(errors="replace")
                    )
                    yield f"API 错误 ({response.status_code})，请检查 API Key 和模型名称"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            return
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"]
                        content = delta.get("content", "")
                        if content:
                            yield content
        except httpx.TimeoutException:
            logger.error("OpenAI API timeout")
            yield "请求超时，请稍后重试"
        except httpx.ConnectError:
            logger.error("OpenAI API connection error")
            yield "无法连接到 OpenAI API，请检查网络"

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
