from typing import AsyncIterable
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class AIProvider:
    def __init__(self):
        self.api_key: str = ""

    def set_api_key(self, api_key: str):
        self.api_key = api_key

    async def chat(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterable[str]:
        raise NotImplementedError

    async def validate_api_key(self, api_key: str) -> bool:
        raise NotImplementedError
