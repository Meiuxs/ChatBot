import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from app.core.config import get_settings


def _build_fernet() -> Fernet:
    """
    Build a Fernet instance from configured secret material.
    Derive a stable 32-byte key from api_key_secret/supabase_key.
    """
    settings = get_settings()
    source = settings.api_key_secret or settings.supabase_key
    if not source:
        raise HTTPException(status_code=500, detail="服务端缺少 API Key 加密密钥配置")
    digest = hashlib.sha256(source.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_api_key(raw: str) -> str:
    if not raw:
        return ""
    token = _build_fernet().encrypt(raw.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_api_key(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    try:
        plain = _build_fernet().decrypt(cipher_text.encode("utf-8"))
        return plain.decode("utf-8")
    except InvalidToken:
        # Backward compatibility: allow legacy plaintext values.
        return cipher_text
