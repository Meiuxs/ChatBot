import logging
from pydantic_settings import BaseSettings
from functools import lru_cache

logger = logging.getLogger(__name__)


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

    def model_post_init(self, _ctx):
        """确保已知的生产环境域名始终在 CORS 列表中，不受环境变量覆盖影响"""
        known_production = {
            "https://chatbot-meiux.vercel.app",
            "https://frontend-meiux.vercel.app",
            "https://frontend-ochre-six-97.vercel.app",
        }
        existing = set(self.cors_origins or [])
        missing = known_production - existing
        if missing:
            self.cors_origins = self.cors_origins + list(missing)

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    logger.info(
        "CONFIG loaded supabase_url=%s has_jwt_secret=%s has_api_key_secret=%s cors_origins=%s",
        settings.supabase_url,
        "yes" if settings.supabase_jwt_secret else "no",
        "yes" if settings.api_key_secret else "no",
        settings.cors_origins,
    )
    return settings
