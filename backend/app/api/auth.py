import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.core.database import get_supabase
from app.api.deps import get_current_user
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse
from gotrue.errors import AuthApiError

logger = logging.getLogger(__name__)
router = APIRouter()

# 已知的错误码 → HTTP 状态码 + 用户友好提示
_AUTH_ERROR_MAP = {
    "email_exists": (409, "该邮箱已被注册"),
    "user_already_exists": (409, "该邮箱已被注册"),
    "email_address_invalid": (400, "邮箱格式不正确"),
    "weak_password": (400, "密码强度不足，请使用至少 6 位字符"),
    "over_request_rate_limit": (429, "注册过于频繁，请稍后再试"),
    "over_email_send_rate_limit": (429, "注册过于频繁，请稍后再试"),
    "signup_disabled": (403, "当前不允许注册新用户"),
    "user_not_found": (401, "邮箱或密码错误"),
    "invalid_credentials": (401, "邮箱或密码错误"),
}


def _mask_email(email: str) -> str:
    """脱敏邮箱：test@example.com → tes***@example.com"""
    if "@" not in email:
        return email[:3] + "***"
    local, domain = email.split("@", 1)
    if len(local) <= 3:
        return local[:1] + "***@" + domain
    return local[:3] + "***@" + domain


def _extract_error(e: Exception) -> str:
    """从各种异常类型中提取错误描述字符串，优先取 AuthApiError.code。"""
    if isinstance(e, AuthApiError):
        return (e.code or "").lower()
    return str(e).lower()


def _handle_auth_error(e: Exception, default_status: int, default_msg: str) -> HTTPException:
    """将 Supabase AuthApiError / 普通 Exception 转为 HTTPException。"""
    # 1) 优先精确匹配 AuthApiError.code
    if isinstance(e, AuthApiError) and e.code:
        code = e.code
        if code in _AUTH_ERROR_MAP:
            status, detail = _AUTH_ERROR_MAP[code]
            return HTTPException(status_code=status, detail=detail)
        logger.warning("Unhandled AuthApiError: code=%s message=%s", code, e.message)

    # 2) 兜底：字符串模糊匹配（覆盖非 AuthApiError 异常和未知 code）
    msg = _extract_error(e)
    if "rate limit" in msg or "too many" in msg:
        return HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
    if "already registered" in msg or "already been registered" in msg:
        return HTTPException(status_code=409, detail="该邮箱已被注册")
    if "invalid email" in msg or "email_address_invalid" in msg:
        return HTTPException(status_code=400, detail="邮箱格式不正确")
    if ("password" in msg and ("characters" in msg or "character" in msg or "length" in msg)) or "weak_password" in msg:
        return HTTPException(status_code=400, detail="密码强度不足，请使用至少 6 位字符")
    if "invalid login credentials" in msg or "invalid_credentials" in msg:
        return HTTPException(status_code=401, detail="邮箱或密码错误")
    if "user not found" in msg or "user_not_found" in msg:
        return HTTPException(status_code=401, detail="邮箱或密码错误")

    logger.exception("Auth unexpected error (type=%s, msg=%s)", type(e).__name__, msg)
    return HTTPException(status_code=default_status, detail=default_msg)


@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    supabase: Client = Depends(get_supabase),
):
    email_masked = _mask_email(request.email)
    logger.info("AUTH register attempt email=%s", email_masked)
    start = time.perf_counter()
    try:
        result = supabase.auth.sign_up(
            {"email": request.email, "password": request.password}
        )
        user_id = result.user.id
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "AUTH register success user=%s email=%s elapsed_ms=%.0f",
            user_id, email_masked, elapsed,
        )
        return AuthResponse(
            user={"id": result.user.id, "email": result.user.email},
            session={
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
            },
        )
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        logger.info("AUTH register failed email=%s elapsed_ms=%.0f exc=%s", email_masked, elapsed, type(e).__name__)
        raise _handle_auth_error(e, 400, "注册失败，请稍后重试")


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    supabase: Client = Depends(get_supabase),
):
    email_masked = _mask_email(request.email)
    logger.info("AUTH login attempt email=%s", email_masked)
    start = time.perf_counter()
    try:
        result = supabase.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
        user_id = result.user.id
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "AUTH login success user=%s email=%s elapsed_ms=%.0f",
            user_id, email_masked, elapsed,
        )
        return AuthResponse(
            user={"id": result.user.id, "email": result.user.email},
            session={
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
            },
        )
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        logger.info("AUTH login failed email=%s elapsed_ms=%.0f exc=%s", email_masked, elapsed, type(e).__name__)
        raise _handle_auth_error(e, 401, "邮箱或密码错误")


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    logger.info("AUTH logout user=%s", current_user.get("id", "?"))
    return {"success": True}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    logger.info("AUTH get_me user=%s email=%s", current_user.get("id", "?"), current_user.get("email", ""))
    return {"email": current_user.get("email", "")}
