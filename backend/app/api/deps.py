import asyncio
import time
import logging
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, HTTPException, Header
from supabase import Client
from app.core.database import get_supabase
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_settings_cache: dict[str, tuple[dict, float]] = {}
_SETTINGS_CACHE_TTL = 300
_session_ownership_cache: dict[tuple[str, str], tuple[bool, float, int]] = {}
_SESSION_OWNERSHIP_TTL = 300
_user_data_version: dict[str, int] = {}

# 从 JWKS 提取的 EC 公钥（首次请求时初始化，之后缓存）
_ec_public_key: ec.EllipticCurvePublicKey | None = None


async def init_jwks():
    """启动时预热：从 Supabase JWKS 端点获取并缓存 EC 公钥。"""
    global _ec_public_key
    if _ec_public_key is not None:
        return
    if not get_settings().supabase_jwt_secret:
        logger.warning("JWT: SUPABASE_JWT_SECRET not configured, will use remote auth")
        return
    url = f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            for key in data.get("keys", []):
                if key.get("kty") == "EC" and key.get("crv") == "P-256":
                    import base64
                    x = int.from_bytes(base64.urlsafe_b64decode(key["x"] + "=="), "big")
                    y = int.from_bytes(base64.urlsafe_b64decode(key["y"] + "=="), "big")
                    _ec_public_key = ec.EllipticCurvePublicKey.from_encoded_point(
                        ec.SECP256R1(), b"\x04" + x.to_bytes(32, "big") + y.to_bytes(32, "big")
                    )
                    logger.info("JWT: EC public key cached from JWKS (kid=%s)", key.get("kid"))
                    return
            logger.warning("JWT: no suitable EC key found in JWKS")
    except Exception as e:
        logger.warning("JWT: failed to fetch JWKS: %s", e)


def _verify_token_locally(token: str) -> dict | None:
    global _ec_public_key
    if _ec_public_key is None:
        return None
    try:
        payload = jwt.decode(
            token,
            _ec_public_key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return payload
    except jwt.PyJWTError:
        return None
    except Exception:
        return None


async def get_current_user(
    authorization: str = Header(None),
    supabase: Client = Depends(get_supabase),
) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证令牌")

    token = authorization.replace("Bearer ", "")

    # 本地 JWT 验证（首次请求会缓存 JWKS，之后 0 网络开销）
    payload = _verify_token_locally(token)
    if payload is not None:
        return {
            "id": payload.get("sub", ""),
            "email": payload.get("email", ""),
        }

    # 回退：通过 Supabase Auth API 验证（约 300-500ms）
    try:
        user = await asyncio.to_thread(supabase.auth.get_user, token)
        return user.user.model_dump() if hasattr(user.user, "model_dump") else dict(user.user)
    except Exception:
        raise HTTPException(status_code=401, detail="认证令牌无效或已过期")


async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    user_id = current_user["id"]

    now = time.time()
    cached = _settings_cache.get(user_id)
    if cached and (now - cached[1]) < _SETTINGS_CACHE_TTL:
        logger.info("METRIC settings_cache_hit user=%s", user_id)
        return cached[0]

    response = await asyncio.to_thread(
        lambda: supabase.table("settings").select("*").eq("user_id", user_id).execute()
    )
    logger.info("METRIC settings_cache_miss user=%s", user_id)
    defaults = {"api_key": "", "model": "gpt-4o", "provider": "openai", "temperature": 0.7, "max_tokens": 2000}
    if not response.data:
        _settings_cache[user_id] = (defaults, now)
        return defaults

    row = response.data[0]
    from app.core.security import decrypt_api_key

    result = {
        "api_key": decrypt_api_key(row.get("api_key", "")),
        "model": row.get("model", "gpt-4o"),
        "provider": row.get("provider", "openai"),
        "temperature": row.get("temperature", 0.7),
        "max_tokens": row.get("max_tokens", 2000),
        "theme": row.get("theme", "light"),
    }
    _settings_cache[user_id] = (result, now)
    return result


async def ensure_session_owned(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    response = await asyncio.to_thread(
        lambda: (
            supabase.table("sessions")
            .select("id,user_id")
            .eq("id", session_id)
            .eq("user_id", current_user["id"])
            .limit(1)
            .execute()
        )
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="会话不存在或无访问权限")
    return response.data[0]


async def check_session_owned_cached(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> bool:
    """检查会话所有权，结果缓存 _SESSION_OWNERSHIP_TTL 秒（随 data_version 自动失效）"""
    key = (current_user["id"], session_id)
    now = time.time()
    version = get_user_data_version(current_user["id"])
    cached = _session_ownership_cache.get(key)
    if cached and (now - cached[1]) < _SESSION_OWNERSHIP_TTL and cached[2] == version:
        return cached[0]

    response = await asyncio.to_thread(
        lambda: (
            supabase.table("sessions")
            .select("id")
            .eq("id", session_id)
            .eq("user_id", current_user["id"])
            .limit(1)
            .execute()
        )
    )
    ok = bool(response.data)
    _session_ownership_cache[key] = (ok, now, version)
    return ok


def bump_user_data_version(user_id: str) -> int:
    curr = _user_data_version.get(user_id, 0) + 1
    _user_data_version[user_id] = curr
    return curr


def get_user_data_version(user_id: str) -> int:
    return _user_data_version.get(user_id, 0)
