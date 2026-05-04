from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import auth, chat, sessions, settings as settings_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.api.deps import init_jwks
from app.core.database import get_supabase
from app.providers import openai as openai_provider, deepseek as deepseek_provider
import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

app_settings = get_settings()

# 速率限制：{key: [(timestamp, count), ...]}
_rate_limit_store: dict[str, list[tuple[float, int]]] = defaultdict(list)
RATE_LIMITS = {
    "/api/auth/register": {"max_requests": 10, "window_seconds": 300},  # 10次/5分钟
    "/api/auth/login": {"max_requests": 10, "window_seconds": 300},
    "/api/chat/stream": {"max_requests": 20, "window_seconds": 60},  # 20次/分钟
}
DEFAULT_RATE_LIMIT = {"max_requests": 60, "window_seconds": 60}  # 默认60次/分钟


def _get_client_ip(request: Request) -> str:
    """尝试从代理头获取真实 IP，回退到 client.host"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(request: Request) -> None:
    """检查速率限制，超限则抛出 HTTPException。"""
    path = request.url.path
    limits = RATE_LIMITS.get(path, DEFAULT_RATE_LIMIT)
    client_ip = _get_client_ip(request)
    key = f"{client_ip}:{path}"
    now = time.time()
    window = limits["window_seconds"]
    max_req = limits["max_requests"]

    # 清理过期记录
    entries = _rate_limit_store[key]
    _rate_limit_store[key] = [(t, c) for t, c in entries if now - t < window]

    # 统计窗口内请求数
    total = sum(c for t, c in _rate_limit_store[key])
    if total >= max_req:
        raise HTTPException(
            status_code=429,
            detail=f"请求过于频繁，请在 {int(window)} 秒后重试",
            headers={"Retry-After": str(window)},
        )
    # 记录本次请求
    _rate_limit_store[key].append((now, 1))

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


@app.on_event("shutdown")
async def _shutdown():
    """关闭应用时的清理工作"""
    await openai_provider.close_client()
    await deepseek_provider.close_client()
    logger.info("Application shutdown")


app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    rid = getattr(request.state, "request_id", "???")
    logger.exception("Unhandled exception [%s] on %s %s", rid, request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "服务器内部错误"})


@app.middleware("http")
async def rate_limit_and_timing_middleware(request: Request, call_next):
    # 速率限制检查
    try:
        _check_rate_limit(request)
    except HTTPException:
        raise

    # 生成请求追踪 ID 并注入 request.state
    request_id = uuid.uuid4().hex[:12]
    request.state.request_id = request_id

    start = time.time()
    response = await call_next(request)
    duration = time.time() - start

    # 记录详细请求日志
    client_ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "")[:80]
    qs = str(request.url.query_string, "utf-8") if request.url.query_string else ""
    logger.info(
        "REQ [%s] %s %s → %d (%.2fs) ip=%s ua=%s qs=%s",
        request_id, request.method, request.url.path,
        response.status_code, duration, client_ip, ua, qs,
    )
    response.headers["X-Request-ID"] = request_id
    return response


app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["聊天"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["会话"])
app.include_router(settings_router.router, prefix="/api/v1/settings", tags=["设置"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
