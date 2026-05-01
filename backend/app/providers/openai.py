import json
import httpx
import logging
from typing import AsyncIterable
from app.providers.base import AIProvider, ChatMessage

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=60.0)
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
        try:
            async with client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [m.model_dump() for m in messages],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                },
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(
                        "OpenAI API error: %d %s", response.status_code, body.decode(errors="replace")
                    )
                    yield f"API 错误 ({response.status_code})，请检查 API Key"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            return
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
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
