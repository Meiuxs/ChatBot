import logging
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


def _handle_auth_error(e: Exception, default_status: int, default_msg: str) -> HTTPException:
    """将 Supabase AuthApiError 转为 HTTPException，未识别的错误记录日志并返回兜底提示。"""
    if isinstance(e, AuthApiError):
        code = e.code or ""
        if code in _AUTH_ERROR_MAP:
            status, detail = _AUTH_ERROR_MAP[code]
            return HTTPException(status_code=status, detail=detail)
        logger.warning("Unhandled AuthApiError: code=%s message=%s", code, e.message)

    logger.error("Auth unexpected error: %s", e)
    return HTTPException(status_code=default_status, detail=default_msg)


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, supabase: Client = Depends(get_supabase)):
    try:
        result = supabase.auth.sign_up(
            {"email": request.email, "password": request.password}
        )
        return AuthResponse(
            user={"id": result.user.id, "email": result.user.email},
            session={
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
            },
        )
    except Exception as e:
        raise _handle_auth_error(e, 400, "注册失败，请稍后重试")


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, supabase: Client = Depends(get_supabase)):
    try:
        result = supabase.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
        return AuthResponse(
            user={"id": result.user.id, "email": result.user.email},
            session={
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
            },
        )
    except Exception as e:
        raise _handle_auth_error(e, 401, "邮箱或密码错误")


@router.post("/logout")
async def logout():
    return {"success": True}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"email": current_user.get("email", "")}
