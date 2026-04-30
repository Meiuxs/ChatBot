import json
import httpx
from typing import AsyncIterable
from app.providers.base import AIProvider, ChatMessage


class OpenAIProvider(AIProvider):
    async def chat(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterable[str]:
        async with httpx.AsyncClient() as client:
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
                timeout=60.0,
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            return
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta

    async def validate_api_key(self, api_key: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            return response.status_code == 200
