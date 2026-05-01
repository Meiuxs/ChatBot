from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str = ""  # 可选，用于本地 JWT 验证（避免每次请求调用 Supabase Auth API）
    api_key_secret: str = ""  # API Key 加密密钥（未配置时回退到 supabase_key）
    openai_api_key: str = ""
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://chatbot-meiux.vercel.app",
        "https://frontend-meiux.vercel.app",
    ]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
