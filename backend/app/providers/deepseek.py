import json
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
        _client = httpx.AsyncClient(timeout=60.0)
    return _client


class DeepSeekProvider(AIProvider):
    BASE_URL = "https://api.deepseek.com"

    async def chat(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        max_tokens: int,
        reasoning_effort: str | None = None,
    ) -> AsyncIterable[str]:
        api_model = _MODEL_MAP.get(model, model)

        # 是否真正启用了思考模式（用于判断是否忽略 API 返回的 reasoning_content）
        thinking_requested = False

        payload: dict = {
            "model": api_model,
            "messages": [m.model_dump() for m in messages],
            "stream": True,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # 思考模式：由前端 reasoning_effort 参数控制
        #   "high" / "max" → 启用 thinking
        #   None 或空值 → 不启用（旧名 deepseek-reasoner 兼容映射时除外）
        if model in _REASONER_NAMES:
            payload["thinking"] = {"type": "enabled"}
            payload["reasoning_effort"] = reasoning_effort or "high"
            thinking_requested = True
        elif reasoning_effort:
            payload["thinking"] = {"type": "enabled"}
            payload["reasoning_effort"] = reasoning_effort
            thinking_requested = True

        client = _get_client()
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
                        "DeepSeek API error: %d %s", response.status_code, body.decode(errors="replace")
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
                        # 思考模式的推理内容（reasoning_content）
                        # 仅当本次请求显式开启了思考模式才透传，否则忽略（避免关闭思考后仍有推理内容）
                        reasoning = delta.get("reasoning_content", "")
                        if reasoning and thinking_requested:
                            yield json.dumps({"__event__": True, "type": "reasoning", "content": reasoning})
                        # 正式回答内容
                        content = delta.get("content", "")
                        if content:
                            yield json.dumps({"__event__": True, "type": "content", "content": content})
        except httpx.TimeoutException:
            logger.error("DeepSeek API timeout")
            yield "请求超时，请稍后重试"
        except httpx.ConnectError:
            logger.error("DeepSeek API connection error")
            yield "无法连接到 DeepSeek API，请检查网络"

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
