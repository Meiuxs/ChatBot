import asyncio
import threading
import time
import logging
from enum import StrEnum
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, HTTPException, Header
from supabase import Client
from app.core.database import get_supabase
from app.core.config import get_settings

logger = logging.getLogger(__name__)

class CacheDomain(StrEnum):
    SETTINGS = "st"
    SESSIONS = "ss"
    MESSAGES = "ms"

_settings_cache: dict[str, tuple[dict, float]] = {}
_settings_cache_lock = asyncio.Lock()
_SETTINGS_CACHE_TTL = 300
_session_ownership_cache: dict[tuple[str, str], tuple[bool, float, int]] = {}
_session_ownership_lock = asyncio.Lock()
_SESSION_OWNERSHIP_TTL = 300
_cache_versions: dict[str, dict[str, int]] = {}
_cache_versions_lock = threading.Lock()

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
        logger.debug("AUTH local_verify skipped — no EC public key cached")
        return None
    try:
        payload = jwt.decode(
            token,
            _ec_public_key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        logger.debug("AUTH local_verify success sub=%s", payload.get("sub", "?")[:8])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("AUTH local_verify expired")
        return None
    except jwt.PyJWTError as e:
        logger.debug("AUTH local_verify failed: %s", e)
        return None
    except Exception as e:
        logger.warning("AUTH local_verify unexpected error: %s", e)
        return None


async def get_current_user(
    authorization: str = Header(None),
    supabase: Client = Depends(get_supabase),
) -> dict:
    if not authorization:
        logger.warning("AUTH no_token_provided")
        raise HTTPException(status_code=401, detail="未提供认证令牌")

    token = authorization.replace("Bearer ", "")

    # 本地 JWT 验证（首次请求会缓存 JWKS，之后 0 网络开销）
    payload = _verify_token_locally(token)
    if payload is not None:
        user_id = payload.get("sub", "")
        email = payload.get("email", "")
        logger.info("AUTH verify_local user=%s email=%s", user_id, email)
        return {
            "id": user_id,
            "email": email,
        }

    # 回退：通过 Supabase Auth API 验证（约 300-500ms）
    try:
        user = await asyncio.to_thread(supabase.auth.get_user, token)
        result = user.user.model_dump() if hasattr(user.user, "model_dump") else dict(user.user)
        logger.info("AUTH verify_remote user=%s email=%s", result.get("id", "?"), result.get("email", ""))
        return result
    except Exception as e:
        logger.warning("AUTH verify_remote_failed exc=%s", type(e).__name__)
        raise HTTPException(status_code=401, detail="认证令牌无效或已过期")


async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    user_id = current_user["id"]

    now = time.time()
    async with _settings_cache_lock:
        cached = _settings_cache.get(user_id)
        if cached and (now - cached[1]) < _SETTINGS_CACHE_TTL:
            logger.info("METRIC settings_cache_hit user=%s", user_id)
            return cached[0]

    response = await asyncio.to_thread(
        lambda: supabase.table("settings").select("*").eq("user_id", user_id).execute()
    )
    logger.info("SETTINGS cache_miss user=%s", user_id)
    defaults = {"api_key": "", "model": "gpt-4o", "provider": "openai", "temperature": 0.7}
    if not response.data:
        logger.info("SETTINGS no_row_found user=%s, using defaults", user_id)
        async with _settings_cache_lock:
            _settings_cache[user_id] = (defaults, now)
        return defaults

    row = response.data[0]
    from app.core.security import decrypt_api_key

    result = {
        "api_key": decrypt_api_key(row.get("api_key", "")),
        "model": row.get("model", "gpt-4o"),
        "provider": row.get("provider", "openai"),
        "temperature": row.get("temperature", 0.7),
        "theme": row.get("theme", "light"),
    }
    logger.info("SETTINGS loaded_from_db user=%s model=%s provider=%s", user_id, result["model"], result["provider"])
    async with _settings_cache_lock:
        _settings_cache[user_id] = (result, now)
    return result


async def ensure_session_owned(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    user_id = current_user["id"]
    response = await asyncio.to_thread(
        lambda: (
            supabase.table("sessions")
            .select("id,user_id")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    )
    if not response.data:
        logger.warning("AUTH session_not_owned user=%s session=%s", user_id, session_id)
        raise HTTPException(status_code=404, detail="会话不存在或无访问权限")
    logger.info("AUTH session_owned_ok user=%s session=%s", user_id, session_id)
    return response.data[0]


async def check_session_owned_cached(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> bool:
    """检查会话所有权，结果缓存 _SESSION_OWNERSHIP_TTL 秒（随 data_version 自动失效）"""
    user_id = current_user["id"]
    key = (user_id, session_id)
    now = time.time()
    version = get_user_data_version(user_id, CacheDomain.SESSIONS)
    async with _session_ownership_lock:
        cached = _session_ownership_cache.get(key)
        if cached and (now - cached[1]) < _SESSION_OWNERSHIP_TTL and cached[2] == version:
            logger.info("AUTH ownership_cache_hit user=%s session=%s", user_id, session_id)
            return cached[0]

    response = await asyncio.to_thread(
        lambda: (
            supabase.table("sessions")
            .select("id")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    )
    ok = bool(response.data)
    async with _session_ownership_lock:
        _session_ownership_cache[key] = (ok, now, version)
    logger.info("AUTH ownership_check user=%s session=%s result=%s", user_id, session_id, "owned" if ok else "denied")
    return ok


def bump_user_data_version(user_id: str, domain: CacheDomain = CacheDomain.SESSIONS) -> int:
    with _cache_versions_lock:
        user_versions = _cache_versions.get(user_id, {})
        curr = user_versions.get(domain, 0) + 1
        user_versions[domain] = curr
        _cache_versions[user_id] = user_versions
    logger.info("CACHE bump_version user=%s domain=%s new_version=%d", user_id, domain, curr)
    return curr


def get_user_data_version(user_id: str, domain: CacheDomain = CacheDomain.SESSIONS) -> int:
    with _cache_versions_lock:
        return _cache_versions.get(user_id, {}).get(domain, 0)
