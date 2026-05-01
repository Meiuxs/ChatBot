from pydantic import BaseModel


PROVIDER_OPTIONS = ["openai", "deepseek"]


class SettingsResponse(BaseModel):
    apiKey: str
    model: str
    provider: str = "openai"
    temperature: float
    maxTokens: int
    theme: str = "light"


class UpdateSettingsRequest(BaseModel):
    apiKey: str = ""
    model: str = "gpt-4o"
    provider: str = "openai"
    temperature: float = 0.7
    maxTokens: int = 2000
    theme: str = "light"
