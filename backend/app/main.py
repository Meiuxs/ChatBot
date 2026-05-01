from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import auth, chat, sessions, settings as settings_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.api.deps import init_jwks
from app.core.database import get_supabase
import logging
import time

logger = logging.getLogger(__name__)

app_settings = get_settings()

app = FastAPI(
    title="ChatBot API",
    description="ChatBot 后端 API",
    version="1.0.0",
)


@app.on_event("startup")
async def _configure_logging():
    """在 uvicorn 初始化完成后设置日志（避免被 uvicorn 的 dictConfig 覆盖）"""
    setup_logging()
    await init_jwks()  # 预热 JWKS 公钥缓存

    # 预热 Supabase HTTP 连接（避免首次请求的 TLS 握手延迟）
    try:
        client = get_supabase()
        client.table("settings").select("id").limit(1).execute()
        logger.info("Supabase connection warmed up")
    except Exception:
        logger.warning("Supabase warmup failed (non-critical)")

    logger.info("Application startup")


app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info("REQ %s %s → %d (%.2fs)", request.method, request.url.path, response.status_code, duration)
    return response


app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(chat.router, prefix="/api/chat", tags=["聊天"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["会话"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["设置"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
