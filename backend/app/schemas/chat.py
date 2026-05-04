from pydantic import BaseModel, Field


class ChatMessageSchema(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1)


class SendMessageRequest(BaseModel):
    sessionId: str
    messages: list[ChatMessageSchema]
    model: str
    provider: str = ""
    temperature: float = 0.7
    reasoningEffort: str | None = None
