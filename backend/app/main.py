from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, chat, settings
from app.core.config import get_settings
from app.core.logging import setup_logging

setup_logging()

settings = get_settings()

app = FastAPI(
    title="ChatBot API",
    description="ChatBot 后端 API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(chat.router, prefix="/api/chat", tags=["聊天"])
app.include_router(settings.router, prefix="/api/settings", tags=["设置"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
