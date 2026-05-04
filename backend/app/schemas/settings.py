from pydantic import BaseModel, Field


PROVIDER_OPTIONS = ["openai", "deepseek"]


class SettingsResponse(BaseModel):
    apiKey: str
    model: str
    provider: str = "openai"
    temperature: float = Field(..., ge=0.0, le=2.0)
    theme: str = "light"


class UpdateSettingsRequest(BaseModel):
    apiKey: str = ""
    model: str = "gpt-4o"
    provider: str = "openai"
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    theme: str = "light"
