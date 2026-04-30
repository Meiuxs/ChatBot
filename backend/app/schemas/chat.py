from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    sessionId: str
    messages: list[dict]
    model: str
    temperature: float = 0.7
    maxTokens: int = 2000
