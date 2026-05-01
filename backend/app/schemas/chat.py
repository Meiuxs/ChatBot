from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    sessionId: str
    messages: list[dict]
    model: str
    provider: str = ""
    temperature: float = 0.7
    maxTokens: int = 2000
    reasoningEffort: str | None = None
