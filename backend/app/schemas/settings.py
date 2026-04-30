from pydantic import BaseModel


class SettingsResponse(BaseModel):
    apiKey: str
    model: str
    temperature: float
    maxTokens: int


class UpdateSettingsRequest(BaseModel):
    apiKey: str = ""
    model: str = "gpt-4o"
    temperature: float = 0.7
    maxTokens: int = 2000
